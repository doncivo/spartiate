import { describe, expect, it, vi } from 'vitest';
import { createPickerShortcutFiles, createUnsupportedShortcutFiles, openShortcutFiles, SHORTCUT_FILE_NAMES } from './index';

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

  it('iPhone : lecteur à sélecteur, lecture manuelle seulement', () => {
    const reader = openShortcutFiles('tauri', 'ios');
    expect(reader.kind).toBe('picker');
    expect(reader.automatic).toBe(false);
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
