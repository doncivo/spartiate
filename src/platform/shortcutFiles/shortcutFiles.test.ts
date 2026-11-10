import { describe, expect, it, vi } from 'vitest';
import { createFolderShortcutFiles, createPickerShortcutFiles, createUnsupportedShortcutFiles, openShortcutFiles, openShortcutPicker, SHORTCUT_FILE_NAMES, ShortcutFolderError } from './index';

const file = (name: string, text: string): File => new File([text], name, { type: 'text/csv' });

describe('lecture des fichiers Raccourcis (I5-01 point 1.3)', () => {
  it('PC et navigateur : lecteur « unsupported », jamais automatique, aucune lecture', async () => {
    for (const [runtime, os] of [['tauri', 'windows'], ['web', 'other']] as const) {
      const reader = openShortcutFiles(runtime, os);
      expect(reader.kind).toBe('unsupported');
      expect(reader.automatic).toBe(false);
    }
    expect(await createUnsupportedShortcutFiles().read(SHORTCUT_FILE_NAMES)).toBeNull();
  });

  it('iPhone : lecteur de dossier automatique (D-90, H-26) ; le sélecteur reste en secours', () => {
    const reader = openShortcutFiles('tauri', 'ios');
    expect(reader.kind).toBe('folder');
    expect(reader.automatic).toBe(true);
    const picker = openShortcutPicker('tauri', 'ios');
    expect(picker.kind).toBe('picker');
    expect(picker.automatic).toBe(false);
    expect(openShortcutPicker('tauri', 'windows').kind).toBe('unsupported');
  });

  it('sélecteur : fichiers choisis lus, fichiers non choisis « absent », nom insensible à la casse, annulation = null', async () => {
    const pick = vi.fn(async () => [file('HRV.csv', 'a;1'), file('autre.txt', 'x')]);
    const reader = createPickerShortcutFiles(pick);
    const reads = await reader.read(SHORTCUT_FILE_NAMES);
    expect(reads).toEqual([
      { name: 'hrv.csv', state: 'ok', text: 'a;1' },
      { name: 'fc-repos.csv', state: 'absent' },
      { name: 'sommeil.csv', state: 'absent' },
      { name: 'pas.csv', state: 'absent' },
    ]);
    expect(await createPickerShortcutFiles(async () => null).read(SHORTCUT_FILE_NAMES)).toBeNull();
  });

  it('sélecteur : un fichier trop gros ou illisible est « unreadable » sans empêcher les autres', async () => {
    const big = file('hrv.csv', 'x'.repeat(3 * 1024 * 1024));
    const broken = file('pas.csv', 'x');
    vi.spyOn(broken, 'arrayBuffer').mockRejectedValue(new Error('boom'));
    const reads = await createPickerShortcutFiles(async () => [big, broken, file('sommeil.csv', 's')]).read(SHORTCUT_FILE_NAMES);
    expect(reads?.map((r) => [r.name, r.state])).toEqual([
      ['hrv.csv', 'unreadable'],
      ['fc-repos.csv', 'absent'],
      ['sommeil.csv', 'ok'],
      ['pas.csv', 'unreadable'],
    ]);
  });
});

const b64 = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

const folder = (files: unknown[], extra: Record<string, unknown> = {}) => ({
  folder: { rootListed: true, santePresent: true, santeListed: true, devicesPresent: true, rootEntries: 2, santeEntries: files.length, ...extra },
  files,
});

describe('lecteur de dossier iCloud Drive › Spartiate › sante (I5-03, I5-04, D-90, H-26)', () => {
  it('un seul appel health_files_read avec les quatre noms ; ok / absent / illisible / à télécharger dans l’ordre demandé, avec la taille', async () => {
    const invoke = vi.fn(async () =>
      folder([
        { name: 'hrv.csv', state: 'ok', size: 29, bytes: b64('2026-11-08T06:41:03+01:00;42\n') },
        { name: 'fc-repos.csv', state: 'absent' },
        { name: 'sommeil.csv', state: 'cloud', size: 4096 },
        { name: 'pas.csv', state: 'unreadable', size: 7 },
      ]),
    );
    const reader = createFolderShortcutFiles(invoke);
    expect(reader.kind).toBe('folder');
    expect(reader.automatic).toBe(true);
    const reads = await reader.read(SHORTCUT_FILE_NAMES);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('health_files_read', { names: [...SHORTCUT_FILE_NAMES] });
    expect(reads).toEqual([
      { name: 'hrv.csv', state: 'ok', text: '2026-11-08T06:41:03+01:00;42\n', size: 29 },
      { name: 'fc-repos.csv', state: 'absent' },
      { name: 'sommeil.csv', state: 'unreadable', cloud: true, size: 4096 },
      { name: 'pas.csv', state: 'unreadable', size: 7 },
    ]);
  });

  it('la sonde du dernier appel donne le dossier atteint, sante présent et les comptes', async () => {
    const reader = createFolderShortcutFiles(async () => folder([{ name: 'hrv.csv', state: 'absent' }], { santePresent: false, santeListed: false, santeEntries: 0, rootEntries: 5 }));
    expect(reader.probe?.()).toBeNull();
    await reader.read(SHORTCUT_FILE_NAMES);
    expect(reader.probe?.()).toEqual({ rootListed: true, santePresent: false, santeListed: false, devicesPresent: true, rootEntries: 5, santeEntries: 0 });
  });

  it('réponse incomplète, état inconnu ou octets invalides : « unreadable » pour ce fichier, les autres sont lus', async () => {
    const invoke = vi.fn(async () =>
      folder([
        { name: 'hrv.csv', state: 'ok', bytes: '%%%pas-du-base64%%%' },
        { name: 'sommeil.csv', state: 'bizarre' },
        { name: 'autre.csv', state: 'ok', bytes: b64('x') },
      ]),
    );
    const reads = await createFolderShortcutFiles(invoke).read(SHORTCUT_FILE_NAMES);
    expect(reads?.map((r) => [r.name, r.state])).toEqual([
      ['hrv.csv', 'unreadable'],
      ['fc-repos.csv', 'unreadable'],
      ['sommeil.csv', 'unreadable'],
      ['pas.csv', 'unreadable'],
    ]);
  });

  it('dossier de synchro non lié ou injoignable : ShortcutFolderError, jamais un chemin ni le texte de l’erreur', async () => {
    const invoke = vi.fn(async () => {
      throw { code: 'not-configured', message: '/private/var/mobile/secret' };
    });
    const error = await createFolderShortcutFiles(invoke).read(SHORTCUT_FILE_NAMES).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShortcutFolderError);
    expect((error as ShortcutFolderError).code).toBe('not-configured');
    expect(String((error as Error).message)).not.toContain('/private');
    const other = await createFolderShortcutFiles(async () => {
      throw new Error('boom');
    })
      .read(SHORTCUT_FILE_NAMES)
      .catch((e: unknown) => e);
    expect((other as ShortcutFolderError).code).toBe('failed');
  });

  it('ne demande que des noms de la liste fermée', async () => {
    const invoke = vi.fn(async () => folder([]));
    await createFolderShortcutFiles(invoke).read(['hrv.csv', 'state.spx' as never]);
    expect(invoke).toHaveBeenCalledWith('health_files_read', { names: ['hrv.csv'] });
  });
});
