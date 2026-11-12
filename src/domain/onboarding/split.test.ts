import { describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_CONFIG } from '../training/config';
import { capLinesToDuration, proposeSplit } from './split';

describe('Split proposé selon la fréquence (§ 10.1 écran 7)', () => {
  it.each([
    { sessions: 2, split: 'full-body', programId: 'full-body-3j', matches: false },
    { sessions: 3, split: 'full-body', programId: 'full-body-3j', matches: true },
    { sessions: 4, split: 'upper-lower', programId: 'haut-bas-4j', matches: true },
    { sessions: 5, split: 'ppl', programId: 'ppl-6j', matches: false },
    { sessions: 6, split: 'ppl', programId: 'ppl-6j', matches: true },
  ] as const)('salle, $sessions séances : $split, programme $programId', ({ sessions, split, programId, matches }) => {
    const proposal = proposeSplit({ sessionsPerWeek: sessions, equipmentKind: 'salle' });
    expect(proposal.split).toBe(split);
    expect(proposal.programId).toBe(programId);
    expect(proposal.matchesFrequency).toBe(matches);
  });

  it('maison ou voyage : le seul programme à domicile, même sans correspondance de fréquence', () => {
    for (const kind of ['maison', 'voyage'] as const) {
      const proposal = proposeSplit({ sessionsPerWeek: 4, equipmentKind: kind });
      expect(proposal.programId).toBe('maison-halteres-3j');
      expect(proposal.split).toBe('full-body');
      expect(proposal.matchesFrequency).toBe(false);
    }
  });

  it('fréquence ou matériel non choisis : prudent, 3 séances en salle (corps entier)', () => {
    const proposal = proposeSplit({ sessionsPerWeek: null, equipmentKind: null });
    expect(proposal.programId).toBe('full-body-3j');
    expect(proposal.split).toBe('full-body');
  });
});

describe('La durée plafonne les séries (§ 10.1 écran 4)', () => {
  const lines = [
    { sets: 4, restSec: 120 },
    { sets: 3, restSec: 90 },
    { sets: 3, restSec: 90 },
    { sets: 3, restSec: 60 },
  ];

  it('tout tient : rien n’est retiré', () => {
    const result = capLinesToDuration(lines, 90, DEFAULT_GENERATION_CONFIG);
    expect(result.keptCount).toBe(4);
    expect(result.droppedCount).toBe(0);
    expect(result.estimatedMin).toBeLessThanOrEqual(90);
  });

  it('trop long : les dernières lignes sont retirées jusqu’à tenir, la première reste', () => {
    const result = capLinesToDuration(lines, 20, DEFAULT_GENERATION_CONFIG);
    expect(result.keptCount).toBeLessThan(4);
    expect(result.keptCount).toBeGreaterThanOrEqual(1);
    expect(result.keptCount + result.droppedCount).toBe(4);
    expect(result.estimatedMin).toBeLessThanOrEqual(20);
  });

  it('durée non choisie : aucun plafond', () => {
    expect(capLinesToDuration(lines, null, DEFAULT_GENERATION_CONFIG).droppedCount).toBe(0);
  });

  it('aucune ligne : zéro, sans erreur', () => {
    expect(capLinesToDuration([], 45, DEFAULT_GENERATION_CONFIG)).toEqual({ keptCount: 0, droppedCount: 0, estimatedMin: 0 });
  });
});
