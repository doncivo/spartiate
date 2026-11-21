import { describe, expect, it } from 'vitest';
import { LIBRARY_ALL, matchesLibraryFilters, muscleOptions } from './libraryFilter';

/** MOTEUR-0281c (PRD § 14.2, C-191) : filtres de la bibliothèque par muscle et par pattern, combinables. Données SYNTHÉTIQUES. */

const RDL = { muscles: [{ id: 'hamstrings', weight: 1 }, { id: 'glutes', weight: 0.6 }], pattern: 'hinge' } as const;
const CURL = { muscles: [{ id: 'hamstrings', weight: 1 }], pattern: 'isolation' } as const;
const BENCH = { muscles: [{ id: 'chest', weight: 1 }, { id: 'triceps', weight: 0.4 }], pattern: 'push-horizontal' } as const;

describe('MOTEUR-0281c : filtres muscle et pattern', () => {
  it('C1 muscle : tout exercice qui sollicite ce muscle, quel que soit son poids', () => {
    expect([RDL, CURL, BENCH].filter((e) => matchesLibraryFilters(e, { muscle: 'glutes', pattern: LIBRARY_ALL }))).toEqual([RDL]);
    expect([RDL, CURL, BENCH].filter((e) => matchesLibraryFilters(e, { muscle: 'triceps', pattern: LIBRARY_ALL }))).toEqual([BENCH]);
  });

  it('C1 pattern : seuls les exercices de ce pattern', () => {
    expect([RDL, CURL, BENCH].filter((e) => matchesLibraryFilters(e, { muscle: LIBRARY_ALL, pattern: 'hinge' }))).toEqual([RDL]);
  });

  it('C2 combinés ; « Tous » lève le filtre', () => {
    expect([RDL, CURL, BENCH].filter((e) => matchesLibraryFilters(e, { muscle: 'hamstrings', pattern: 'isolation' }))).toEqual([CURL]);
    expect([RDL, CURL, BENCH].filter((e) => matchesLibraryFilters(e, { muscle: 'hamstrings', pattern: 'push-horizontal' }))).toEqual([]);
    expect([RDL, CURL, BENCH].filter((e) => matchesLibraryFilters(e, { muscle: LIBRARY_ALL, pattern: LIBRARY_ALL }))).toEqual([RDL, CURL, BENCH]);
  });

  it('liste des muscles groupée par région, dans l’ordre du catalogue ; seuls les muscles utilisés par au moins un exercice', () => {
    const muscles = [
      { id: 'chest', nameFr: 'Pectoraux', group: 'Torse' },
      { id: 'hamstrings', nameFr: 'Ischio-jambiers', group: 'Jambes' },
      { id: 'glutes', nameFr: 'Fessiers', group: 'Jambes' },
      { id: 'triceps', nameFr: 'Triceps', group: 'Bras' },
      { id: 'soleus', nameFr: 'Soléaire', group: 'Jambes' },
    ];
    expect(muscleOptions(muscles, [RDL, CURL, BENCH])).toEqual([
      { group: 'Torse', muscles: [{ id: 'chest', nameFr: 'Pectoraux' }] },
      { group: 'Jambes', muscles: [{ id: 'hamstrings', nameFr: 'Ischio-jambiers' }, { id: 'glutes', nameFr: 'Fessiers' }] },
      { group: 'Bras', muscles: [{ id: 'triceps', nameFr: 'Triceps' }] },
    ]);
  });
});
