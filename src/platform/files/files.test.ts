import { describe, expect, it, vi } from 'vitest';
import { createMemoryFiles, createTauriFiles, createUnavailableFiles, FileExportError, MAX_EXPORT_BYTES, type TauriFileApi } from './index';

const request = { suggestedName: 'spartiate-taches-2026-10-04.csv', mime: 'text/csv', data: new Uint8Array([1, 2, 3]) };

function api(overrides: Partial<TauriFileApi> = {}): TauriFileApi {
  return {
    saveFile: () => Promise.resolve('C:\\Docs\\export.csv'),
    revealExported: () => Promise.resolve(),
    pickFile: () => Promise.resolve(null),
    ...overrides,
  };
}

describe('Contrat FileExporter (H-03 D4, critères 7, 9, 10)', () => {
  it('faux en mémoire : enregistre, annule sans erreur, échoue sur demande', async () => {
    const files = createMemoryFiles();
    expect(files.canSave()).toBe(true);
    await expect(files.save(request)).resolves.toMatchObject({ saved: true });
    expect(files.saved).toHaveLength(1);
    files.cancelNext();
    await expect(files.save(request)).resolves.toEqual({ saved: false });
    files.failNext();
    await expect(files.save(request)).rejects.toBeInstanceOf(FileExportError);
    expect(files.saved).toHaveLength(1);
  });

  it('iPhone avant l’ordre 5 : canSave est faux et enregistrer échoue proprement', async () => {
    const files = createUnavailableFiles();
    expect(files.canSave()).toBe(false);
    await expect(files.save(request)).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('Tauri : la commande Rust reçoit le nom proposé et les octets, et renvoie le chemin choisi', async () => {
    const saveFile = vi.fn(() => Promise.resolve('C:\\Docs\\export.csv'));
    const files = createTauriFiles(api({ saveFile }));
    await expect(files.save(request)).resolves.toEqual({ saved: true, path: 'C:\\Docs\\export.csv' });
    expect(saveFile).toHaveBeenCalledWith(request.suggestedName, request.data);
  });

  it('Tauri : annuler la boîte ne lève aucune erreur', async () => {
    const files = createTauriFiles(api({ saveFile: () => Promise.resolve(null) }));
    await expect(files.save(request)).resolves.toEqual({ saved: false });
  });

  it('Tauri : un échec d’écriture (disque plein) lève FileExportError', async () => {
    const files = createTauriFiles(api({ saveFile: () => Promise.reject(new Error('disque plein')) }));
    await expect(files.save(request)).rejects.toMatchObject({ name: 'FileExportError', reason: 'write-failed' });
  });

  it('Tauri : « Afficher dans le dossier » appelle la commande Rust sans aucun chemin', async () => {
    const revealExported = vi.fn(() => Promise.resolve());
    const files = createTauriFiles(api({ revealExported }));
    await files.reveal?.('C:\\Docs\\export.csv');
    expect(revealExported).toHaveBeenCalledWith();
  });

  it('Tauri : un fichier de plus de 64 Mio est refusé avant tout envoi', async () => {
    const saveFile = vi.fn(() => Promise.resolve('C:\\Docs\\export.csv'));
    const files = createTauriFiles(api({ saveFile }));
    const tooBig = { ...request, data: { length: MAX_EXPORT_BYTES + 1 } as unknown as Uint8Array };
    await expect(files.save(tooBig)).rejects.toBeInstanceOf(FileExportError);
    expect(saveFile).not.toHaveBeenCalled();
  });
});

describe('Lecture d’un fichier choisi (P-07)', () => {
  const base64 = (bytes: number[]): string => btoa(String.fromCharCode(...bytes));

  it('Tauri : la commande Rust ne reçoit aucun paramètre ; le texte est décodé en UTF-8 (BOM retiré)', async () => {
    const pickFile = vi.fn(() => Promise.resolve({ name: 'taches.csv', data: base64([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('titre;date\nÉcole;')]) }));
    const files = createTauriFiles(api({ pickFile }));
    await expect(files.pickText({ accept: ['.csv'] })).resolves.toEqual({ name: 'taches.csv', text: 'titre;date\nÉcole;' });
    expect(pickFile).toHaveBeenCalledWith();
  });

  it('Tauri : repli Windows-1252 quand l’UTF-8 est invalide', async () => {
    const files = createTauriFiles(api({ pickFile: () => Promise.resolve({ name: 'x.csv', data: base64([0x74, 0x69, 0x74, 0x72, 0x65, 0x0a, 0x52, 0xe9, 0x75]) }) }));
    await expect(files.pickText({ accept: ['.csv'] })).resolves.toEqual({ name: 'x.csv', text: 'titre\nRéu' });
  });

  it('Tauri : annuler la boîte renvoie null, sans erreur', async () => {
    const files = createTauriFiles(api());
    await expect(files.pickText({ accept: ['.csv'] })).resolves.toBeNull();
  });

  it('Tauri : fichier trop gros ou illisible : FileExportError à raison stable', async () => {
    const tooLarge = createTauriFiles(api({ pickFile: () => Promise.reject({ code: 'too-large', message: 'x' }) }));
    await expect(tooLarge.pickText({ accept: ['.csv'] })).rejects.toMatchObject({ name: 'FileExportError', reason: 'too-large' });
    const unreadable = createTauriFiles(api({ pickFile: () => Promise.reject({ code: 'not-local', message: 'x' }) }));
    await expect(unreadable.pickText({ accept: ['.csv'] })).rejects.toMatchObject({ reason: 'unreadable' });
  });

  it('faux en mémoire : fichier choisi, annulation, échec programmé', async () => {
    const files = createMemoryFiles();
    await expect(files.pickText({ accept: ['.csv'] })).resolves.toBeNull();
    files.setPick({ name: 'a.csv', text: 'titre\nA' });
    await expect(files.pickText({ accept: ['.csv'] })).resolves.toEqual({ name: 'a.csv', text: 'titre\nA' });
    files.failNextPick('too-large');
    await expect(files.pickText({ accept: ['.csv'] })).rejects.toMatchObject({ reason: 'too-large' });
  });
});

describe('SPA-005 : choix d’un fichier binaire (archive zip)', () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0xe9]);

  it('PC : les octets arrivent intacts (aucun décodage texte)', async () => {
    const files = createTauriFiles(api({ pickFile: () => Promise.resolve({ name: 'spartiate-export.zip', data: btoa(String.fromCharCode(...bytes)) }) }));
    await expect(files.pickBytes({ accept: ['.zip'] })).resolves.toEqual({ name: 'spartiate-export.zip', bytes });
  });

  it('PC : annulation = null ; trop gros = too-large ; échec Rust = unreadable', async () => {
    await expect(createTauriFiles(api()).pickBytes({ accept: ['.zip'] })).resolves.toBeNull();
    const big = createTauriFiles(api({ pickFile: () => Promise.resolve({ name: 'a.zip', data: btoa(String.fromCharCode(...bytes)) }) }));
    await expect(big.pickBytes({ accept: ['.zip'], maxBytes: 3 })).rejects.toMatchObject({ reason: 'too-large' });
    const broken = createTauriFiles(api({ pickFile: () => Promise.reject(new Error('boom')) }));
    await expect(broken.pickBytes({ accept: ['.zip'] })).rejects.toMatchObject({ reason: 'unreadable' });
  });

  it('faux en mémoire et plateforme sans fichiers', async () => {
    const files = createMemoryFiles();
    files.setPickBytes({ name: 'x.zip', bytes });
    await expect(files.pickBytes({ accept: ['.zip'] })).resolves.toEqual({ name: 'x.zip', bytes });
    files.failNextPick('too-large');
    await expect(files.pickBytes({ accept: ['.zip'] })).rejects.toMatchObject({ reason: 'too-large' });
    await expect(createUnavailableFiles().pickBytes({ accept: ['.zip'] })).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
