import { describe, expect, it } from 'vitest';
import { CARRY_REPORT_TABLES } from '../domain/sync/epochCarryReportView';
import { syncCarryReportFr } from './fr.syncCarryReport';
import { tCarry } from './syncCarryReportText';

describe('textes du compte rendu du changement d’époque (Y-TECH-05)', () => {
  it('lit le français', () => {
    expect(tCarry('seen')).toBe('J’ai vu');
  });

  it('chaque type d’élément de la correspondance table → libellé a son nom au singulier', () => {
    const kinds = new Set(Object.values(CARRY_REPORT_TABLES).map((entry) => entry.kind));
    kinds.add('other');
    for (const kind of kinds) expect(`kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}` in syncCarryReportFr, kind).toBe(true);
  });

  it('aucun pluriel automatique : formulations « Éléments rétablis : 3 »', () => {
    expect(tCarry('summary', { count: 3 })).toBe('Éléments rétablis : 3');
    expect(tCarry('banner', { count: 1 })).toBe('Changement d’époque : éléments rétablis : 1. Voir le compte rendu');
    expect(tCarry('bannerNoRestored', { count: 2 })).toBe('Changement d’époque : aucun élément supprimé rétabli, autres éléments nommés : 2. Voir le compte rendu');
    expect(tCarry('summaryRecreated', { count: 2 })).toBe('Recréés : 2');
    expect(tCarry('summaryOthers', { count: 3 })).toBe('Rattachés ou mis de côté : 3');
    expect(tCarry('more', { count: 12 })).toBe('Autres éléments : 12');
  });

});
