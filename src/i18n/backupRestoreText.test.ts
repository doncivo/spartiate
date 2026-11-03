import { describe, expect, it } from 'vitest';
import { backupRestoreFr } from './fr.backupRestore';
import { tBackupRestore } from './backupRestoreText';

describe('textes de la restauration (P-04-iOS)', () => {
  it('aucun paramètre dans le catalogue', () => {
    for (const text of Object.values(backupRestoreFr)) expect(text).not.toMatch(/{w+}/);
  });
  it('lit le français', () => {
    expect(tBackupRestore('retry')).toBe('Réessayer');
  });
});
