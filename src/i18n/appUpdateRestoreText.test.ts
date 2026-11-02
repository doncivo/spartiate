import { describe, expect, it } from 'vitest';
import { tUpdateRestore } from './appUpdateRestoreText';

describe('textes de la restauration d’avant la mise à jour (I-06)', () => {
  it('lit le français et remplace les paramètres', () => {
    expect(tUpdateRestore('restoreConfirm')).toBe('Restaurer');
    expect(tUpdateRestore('restoreFailed', { reason: 'Raison.' })).toBe('La restauration n’a pas abouti. Raison.');
  });
});
