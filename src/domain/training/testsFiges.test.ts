import { describe, expect, it } from 'vitest';

import { BENCH, CURL, FITNESS_PARK_ANTONY, input, session, set, target } from '../../../tests/fixtures/training/progression';
import type { IsoDateTime } from '../types';
import { explanationNotes } from './explain';
import { prescribe } from './prescribe';
import type { ExerciseSession } from './types';

/**
 * TESTS-FIGES (C-169, § 11.6) : fixture « nominal 8 séances » (boucle proposition → séance faite → proposition suivante) et
 * « changement de salle » avec historique. Valeurs synthétiques, vérifiables à la main.
 */
const DAY = 86_400_000;
const T0 = Date.parse('2026-09-01T18:00:00.000Z');
const iso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

describe('TESTS-FIGES nominal 8 séances (§ 11.6)', () => {
  function run(): { loads: (number | null)[]; reps: number[][]; headlines: string[] } {
    const history: ExerciseSession[] = [{ workoutId: 'w-0', endedAt: iso(T0), difficulty: null, sets: [0, 1, 2].map((p) => set(60, 8, { position: p })) }];
    const loads: (number | null)[] = [];
    const reps: number[][] = [];
    const headlines: string[] = [];
    for (let i = 1; i <= 8; i += 1) {
      const now = iso(T0 + i * 3.5 * DAY);
      const p = prescribe(input({ exercise: BENCH, history, target: target(8, 10), now }));
      loads.push(p.loadKg);
      reps.push(p.sets.map((s) => s.reps));
      headlines.push(p.headline);
      // Ali fait exactement ce qui est proposé.
      history.push({ workoutId: `w-${String(i)}`, endedAt: now, difficulty: null, sets: p.sets.map((s, pos) => set(p.loadKg, s.reps, { position: pos })) });
    }
    return { loads, reps, headlines };
  }

  it('SPA-TESTS-FIGES 8 séances enchaînées : l’échelle de répétitions monte à 10 × 3 à 60 kg, puis la charge gagne un cran de 2,5 kg', () => {
    const r = run();
    expect(r.loads).toEqual([60, 60, 60, 60, 60, 60, 62.5, 62.5]);
    expect(r.reps).toEqual([[9, 8, 8], [10, 8, 8], [10, 9, 8], [10, 10, 8], [10, 10, 9], [10, 10, 10], [8, 8, 8], [9, 8, 8]]);
    expect(r.headlines).toEqual(['rep-ladder', 'rep-ladder', 'rep-ladder', 'rep-ladder', 'rep-ladder', 'rep-ladder', 'increase', 'rep-ladder']);
  });

  it('déterminisme : la boucle rejouée donne exactement le même résultat', () => {
    expect(run()).toEqual(run());
  });
});

describe('TESTS-FIGES changement de salle avec historique (§ 11.6)', () => {
  const history = (kg: number, reps: number[]): ExerciseSession[] => [
    { workoutId: 'g', endedAt: '2026-11-01T18:00:00.000Z' as IsoDateTime, difficulty: null, sets: reps.map((r, p) => set(kg, r, { position: p })) },
  ];
  const SALLE_B = { inventory: { ...FITNESS_PARK_ANTONY.inventory, dumbbells: { minKg: 5, maxKg: 50, stepKg: 2.5 } }, increments: { barbell: 2.5, dumbbell: 2.5 } };

  it('haut de fourchette atteint à 44 kg (haltères par 2) : 46 kg dans la salle A, 45 kg dans la salle B (pas de 2,5), même référence', () => {
    const a = prescribe(input({ exercise: CURL, history: history(44, [10, 10, 10]), target: target(8, 10), equipment: FITNESS_PARK_ANTONY }));
    const b = prescribe(input({ exercise: CURL, history: history(44, [10, 10, 10]), target: target(8, 10), equipment: SALLE_B }));
    expect(a.loadKg).toBe(46);
    expect(b.loadKg).toBe(45);
    expect(a.reference?.loadKg).toBe(44);
    expect(b.reference?.loadKg).toBe(44);
    expect(b.reasons).toContain('top-reached');
  });

  it('BL-106 (D-471) : charge d’historique hors de la grille de la salle courante, prescription inchangée mais signalée', () => {
    const b = prescribe(input({ exercise: CURL, history: history(44, [8, 8, 8]), target: target(8, 10), equipment: SALLE_B }));
    expect(b.loadKg).toBe(44);
    expect(b.reasons).toContain('reference-off-grid');
    expect(explanationNotes(b)).toContainEqual({ key: 'noteReferenceOffGrid', params: { load: 44 } });
    const a = prescribe(input({ exercise: CURL, history: history(44, [8, 8, 8]), target: target(8, 10), equipment: FITNESS_PARK_ANTONY }));
    expect(a.reasons).not.toContain('reference-off-grid');
    // Au-dessus du maximum du matériel de la salle : signalée de même.
    const heavy = prescribe(input({ exercise: CURL, history: history(55, [8, 8, 8]), target: target(8, 10), equipment: SALLE_B }));
    expect(heavy.reasons).toContain('reference-off-grid');
    // Revue : proposition déjà ramenée sur un cran de la grille (haut de plage atteint : 45 kg en salle B) : rien à vérifier, aucune note.
    const up = prescribe(input({ exercise: CURL, history: history(44, [10, 10, 10]), target: target(8, 10), equipment: SALLE_B }));
    expect(up.loadKg).toBe(45);
    expect(up.reasons).not.toContain('reference-off-grid');
    // Revue 2 : contrainte active qui laisse la charge à la référence (fatigue : maintien) : signalée aussi.
    const tired = prescribe(input({ exercise: CURL, history: [session(6, 44, [10, 10, 10]), session(3, 44, [7, 7, 7])], target: target(8, 10), equipment: SALLE_B }));
    expect(tired.headline).toBe('fatigue');
    expect(tired.loadKg).toBe(44);
    expect(tired.reasons).toContain('reference-off-grid');
  });

  it('sans profil de matériel : la charge monte d’un incrément estimé (46,5) et la raison « incrément inconnu » est dite', () => {
    const p = prescribe(input({ exercise: CURL, history: history(44, [10, 10, 10]), target: target(8, 10), equipment: null }));
    expect(p.loadKg).toBe(46.5);
    expect(p.reasons).toContain('increment-unknown');
  });
});
