import { describe, expect, it } from 'vitest';
import { syncFolderFr } from './fr.syncFolder';

/** DATA-0293 (C-118) : oublier la clé rend les données déjà présentes dans iCloud Drive illisibles pour cet appareil : la boîte le dit avant le choix. */
describe('« Oublier le dossier de synchro ? » (C-118)', () => {
  it('le texte dit que, sans la clé, les données chiffrées d’iCloud Drive deviennent illisibles, et renvoie au clé de secours', () => {
    const text = syncFolderFr.forgetDescription;
    expect(text).toMatch(/illisibles/);
    expect(text).toMatch(/clé de secours/);
    expect(text).toMatch(/Oublier le dossier et la clé/);
    expect(text).toMatch(/restent sur l’appareil/);
  });
});
