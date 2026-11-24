import { describe, expect, it } from 'vitest';

import { CURL, KETTLEBELL_GYM, PLANK, PUSH_UP, bwSession, input, session, target, timedSession } from '../../../tests/fixtures/training/progression';
import { explanationNotes } from './explain';
import { prescribe } from './prescribe';
import type { ProgressionEquipment } from './types';

/**
 * SEANCE-0292b (lot 0.29.2, suite de séance et moteur) : une section par ligne du registre (docs/SEANCE-0292b.md). Fixtures synthétiques,
 * valeurs vérifiables à la main.
 */

/** Salle B : haltères 5 à 50 kg par 2,5 (la salle par défaut : 2 à 50 par 2). */
const SALLE_B: ProgressionEquipment = { inventory: { ...KETTLEBELL_GYM.inventory, dumbbells: { minKg: 5, maxKg: 50, stepKg: 2.5 } }, increments: { barbell: 2.5, dumbbell: 2.5 } };
const onGrid = (kg: number | null): boolean => kg !== null && kg >= 5 && kg <= 50 && Math.abs(kg / 2.5 - Math.round(kg / 2.5)) < 1e-9;

describe('SEANCE-0292b BL-106 / § 12.4 (D-496) : charge d’historique hors du matériel arrondie vers le bas et plafonnée, avec la note', () => {
  it('44 kg × 8-8-8 en salle B (pas de 2,5) : 42,5 kg, échelle de répétitions, note « ramenée à 42,5 kg »', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 44, [8, 8, 8])], target: target(8, 10), equipment: SALLE_B }));
    expect(p.loadKg).toBe(42.5);
    expect(p.sets.every((s) => s.loadKg === 42.5)).toBe(true);
    expect(p.sets.map((s) => s.reps)).toEqual([9, 8, 8]);
    expect(p.reference?.loadKg).toBe(44);
    expect(p.reasons).toContain('reference-off-grid');
    expect(explanationNotes(p)).toContainEqual({ key: 'noteReferenceOffGrid', params: { load: 44, kept: 42.5 } });
  });

  it('au-dessus du maximum du matériel (55 kg, haltères jusqu’à 50) : plafonnée à 50 kg, note', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 55, [8, 8, 8])], target: target(8, 10), equipment: SALLE_B }));
    expect(p.loadKg).toBe(50);
    expect(explanationNotes(p)).toContainEqual({ key: 'noteReferenceOffGrid', params: { load: 55, kept: 50 } });
  });

  it('haut de plage atteint : le cran de la grille (45 kg) reste la proposition, aucune note', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 44, [10, 10, 10])], target: target(8, 10), equipment: SALLE_B }));
    expect(p.loadKg).toBe(45);
    expect(p.reasons).not.toContain('reference-off-grid');
  });

  it('contrainte qui maintient la référence (fatigue) : ramenée à 42,5 kg aussi, et les choix proposés restent sur la grille', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(6, 44, [10, 10, 10]), session(3, 44, [7, 7, 7])], target: target(8, 10), equipment: SALLE_B }));
    expect(p.headline).toBe('fatigue');
    expect(p.loadKg).toBe(42.5);
    expect(p.reasons).toContain('reference-off-grid');
    for (const o of p.options ?? []) if (o.loadKg !== null) expect(onGrid(o.loadKg)).toBe(true);
  });

  it('paire de 9 kg dans la salle par défaut (2 à 50 par 2) : 8 kg ; une charge de la grille (44 kg) n’est jamais signalée', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 9, [8, 8, 8])], target: target(8, 12), equipment: KETTLEBELL_GYM }));
    expect(p.loadKg).toBe(8);
    expect(p.reasons).toContain('reference-off-grid');
    const a = prescribe(input({ exercise: CURL, history: [session(3, 44, [8, 8, 8])], target: target(8, 10), equipment: KETTLEBELL_GYM }));
    expect(a.loadKg).toBe(44);
    expect(a.reasons).not.toContain('reference-off-grid');
  });

  it('sous le minimum du matériel (4 kg, haltères à partir de 5) : rien n’est proposé au-dessus (« à saisir »), note (D-536)', () => {
    // Passe module : la charge minimale (5 kg, +25 %) violait le plafond de +10 % (propriétés du moteur) ; vecteur révisé, D-536.
    const p = prescribe(input({ exercise: CURL, history: [session(3, 4, [8, 8, 8])], target: target(8, 10), equipment: SALLE_B }));
    expect(p.status).toBe('to-enter');
    expect(p.loadKg).toBeNull();
    expect(p.sets.every((s) => s.loadKg === null)).toBe(true);
    expect(explanationNotes(p)).toContainEqual({ key: 'noteReferenceBelowGrid', params: { load: 4 } });
  });

  it('monotonie et déterminisme : de 30 à 60 kg par 0,1, la proposition est toujours sur la grille et ne dépasse jamais la référence hors hausse', () => {
    for (let tenth = 300; tenth <= 600; tenth += 1) {
      const kg = tenth / 10;
      const p = prescribe(input({ exercise: CURL, history: [session(3, kg, [8, 8, 8])], target: target(8, 10), equipment: SALLE_B }));
      expect(onGrid(p.loadKg)).toBe(true);
      expect(p.loadKg ?? 0).toBeLessThanOrEqual(Math.max(kg, 5) + 1e-9);
    }
  });
});

describe('SEANCE-0292b § 12.3 (D-497) : modes Variable, Fixe et Statique retirés', () => {
  it('le domaine ne nomme plus de variantes de Libre (aucune option à afficher) ; les modes restent Guidé, Libre, Maison, Importé', async () => {
    const types: Record<string, unknown> = await import('./generationTypes');
    expect(types['LIBRE_VARIANTS']).toBeUndefined();
    expect(types['PROGRAM_MODES']).toEqual(['guide', 'libre', 'maison', 'importe']);
  });
});

describe('SEANCE-0292b BL-112 (D-539) : exercices sans charge, fatigue, stagnation et décote de position', () => {
  it('fatigue : pompes 12-12-12 puis 9-9-8 (−28 %) → valeurs maintenues, choix « −2 reps » proposé (jamais appliqué)', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: [bwSession(6, null, [12, 12, 12]), bwSession(3, null, [9, 9, 8])], target: target(8, 15) }));
    expect(p.headline).toBe('fatigue');
    expect(p.reasons).toContain('fatigue-drop');
    expect(p.sets.map((s) => s.reps)).toEqual([9, 9, 8]);
    expect(p.options).toContainEqual({ kind: 'fatigue-reps', loadKg: 0, reps: [7, 7, 6] });
  });

  it('fatigue : planche 60-60-60 puis 40-40-40 → durées maintenues, aucun choix de répétitions', () => {
    const p = prescribe(input({ exercise: PLANK, history: [timedSession(6, [60, 60, 60]), timedSession(3, [40, 40, 40])], target: target(30, 90) }));
    expect(p.headline).toBe('fatigue');
    expect(p.sets.map((s) => s.reps)).toEqual([40, 40, 40]);
    expect(p.options ?? []).toEqual([]);
  });

  it('stagnation : 4 séances à 10-10-10 → alerte et deux choix (variante, autre plage), la progression continue (11-10-10)', () => {
    const history = [12, 9, 6, 3].map((d) => bwSession(d, null, [10, 10, 10]));
    const p = prescribe(input({ exercise: PUSH_UP, history, target: target(8, 15) }));
    expect(p.reasons).toContain('stall');
    expect(p.headline).toBe('rep-ladder');
    expect(p.sets.map((s) => s.reps)).toEqual([11, 10, 10]);
    expect((p.options ?? []).map((o) => o.kind)).toEqual(['stall-variant', 'stall-range']);
  });

  it('décote de position : 2ᵉ exercice du muscle (× 0,93) → 11-10-10 devient 10-9-9, note dédiée aux répétitions', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: [bwSession(3, null, [10, 10, 10])], target: target(8, 15), positionRank: 2, lastPositionRank: 1 }));
    expect(p.reasons).toContain('position-discount');
    expect(p.sets.map((s) => s.reps)).toEqual([10, 9, 9]);
    expect(p.positionRank).toBe(2);
    expect(explanationNotes(p)).toContainEqual({ key: 'notePositionValues', params: { rank: 2, cut: 7 } });
    // Même rang que la séance de référence : aucune décote.
    const same = prescribe(input({ exercise: PUSH_UP, history: [bwSession(3, null, [10, 10, 10])], target: target(8, 15), positionRank: 2, lastPositionRank: 2 }));
    expect(same.reasons).not.toContain('position-discount');
  });

  // Relecture (F) : la décote de position des valeurs vaut aussi sur les chemins de contrainte (comme pour un exercice chargé, où `positioned`
  // suit les réductions) : inactivité, récupération basse, décharge et fatigue ; jamais une hausse, lest inchangé, note dite.
  it('décote de position sur les chemins inactivité, récupération basse, décharge et fatigue (2ᵉ rang, × 0,93)', () => {
    const base = { exercise: PUSH_UP, target: target(8, 15), positionRank: 2, lastPositionRank: 1 } as const;
    const paused = prescribe(input({ ...base, history: [bwSession(40, null, [10, 10, 10])] }));
    expect(paused.headline).toBe('inactivity');
    expect(paused.reasons).toEqual(expect.arrayContaining(['inactivity-discount', 'position-discount']));
    expect(paused.sets.map((s) => s.reps)).toEqual([9, 9, 9]);
    expect(paused.loadKg).toBe(0);
    expect(explanationNotes(paused)).toContainEqual({ key: 'notePositionValues', params: { rank: 2, cut: 7 } });

    const low = prescribe(input({ ...base, history: [bwSession(3, null, [10, 10, 10])], recovery: { recovery: 20, sleepHours: null, restingHrDelta: null } }));
    expect(low.headline).toBe('recovery-low');
    expect(low.reasons).toEqual(expect.arrayContaining(['recovery-low', 'position-discount']));
    expect(low.sets.map((s) => s.reps)).toEqual([9, 9, 9]);
    expect(explanationNotes(low)).toContainEqual({ key: 'notePositionValues', params: { rank: 2, cut: 7 } });

    const deload = prescribe(input({ ...base, history: [bwSession(3, null, [10, 10, 10])], deload: true }));
    expect(deload.headline).toBe('deload');
    expect(deload.reasons).toContain('position-discount');
    expect(deload.sets.every((s) => s.reps === 9)).toBe(true);

    const fatigue = prescribe(input({ ...base, history: [bwSession(6, null, [12, 12, 12]), bwSession(3, null, [9, 9, 8])] }));
    expect(fatigue.headline).toBe('fatigue');
    expect(fatigue.sets.map((s) => s.reps)).toEqual([8, 8, 7]);
    // Le choix « −2 répétitions » part des valeurs de référence (9-9-8), jamais au-dessus de la proposition décotée.
    for (const o of fatigue.options ?? []) for (const [i, r] of (o.reps ?? []).entries()) expect(r).toBeLessThanOrEqual(fatigue.sets[i]?.reps ?? 0);
  });
});
