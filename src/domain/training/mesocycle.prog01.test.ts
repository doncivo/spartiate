import { describe, expect, it } from 'vitest';
import { day, ROUTINE_ID, START } from '../../../tests/fixtures/training/mesocycle';
import { DEFAULT_GENERATION_CONFIG as CONFIG, DEFAULT_PROGRESSION_CONFIG as PCONFIG } from './config';
import { activeConstraints, reducedTarget } from './constraints';
import { snapToEquipment } from './loadGrid';
import { changeNextWeeks, createMesocycleSpec, generationWeekOf, linePlanSets, mesocycleState, nextMesocycleSpec, type MesocycleSpec } from './mesocycle';

/**
 * PROG-01 (D-267, D-269, D-273) : mésocycle de 4 ou 6 semaines, décharge à 90 % au cran du matériel, semaine de reprise, durée du cycle suivant ;
 * 5 semaines : table d'avant PROG-01 inchangée ; exercice assisté jamais plus lourd en décharge. Valeurs synthétiques.
 */
const create = (weeks: number, rampUp = false): MesocycleSpec => {
  const spec = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks, ...(rampUp ? { rampUp } : {}) }, CONFIG);
  if (spec === null) throw new Error('spec');
  return spec;
};
const plans = (spec: MesocycleSpec, closedBefore = 0) => Array.from({ length: spec.weeks }, (_, w) => mesocycleState(spec, day(w * 7), CONFIG, { closedBefore }).plan);

describe('PROG-01 : 5 semaines, table d’avant PROG-01 (non-régression)', () => {
  it('RIR 3, 2, 1, 1, séries 2-3-3-4 pour une ligne à 3, deload I2 en semaine 5 (sans décharge à 90 %)', () => {
    const p = plans(create(5));
    expect(p.map((x) => x?.rir)).toEqual([3, 2, 1, 1, 4]);
    expect(p.slice(0, 4).map((x) => (x === null ? null : linePlanSets(3, x, CONFIG)))).toEqual([2, 3, 3, 4]);
    expect(p[4]).toEqual({ setsOffset: 0, rir: 4, deload: true, priorityBonus: 0 });
    expect(p.slice(0, 4).every((x) => x !== null && x.rirLow === undefined && x.isolationRir === undefined)).toBe(true);
  });
});

describe('PROG-01 : 4 semaines (D-267)', () => {
  it('RIR 3, 2-3, 2 (moteur : borne haute), séries de la routine, décharge en semaine 4', () => {
    const p = plans(create(4));
    expect(p.map((x) => [x?.rirLow ?? x?.rir, x?.rir])).toEqual([[3, 3], [2, 3], [2, 2], [3, 4]]);
    expect(p.slice(0, 3).map((x) => (x === null ? null : linePlanSets(4, x, CONFIG)))).toEqual([4, 4, 4]);
    expect(p[3]).toMatchObject({ deload: true, deloadSets: 2, deloadLoad: 0.9, rir: 4, rirLow: 3 });
    expect(p.every((x) => x !== null && x.rir > 0)).toBe(true);
  });
  it('à partir du 2e cycle : RIR 1 sur l’isolation en dernière semaine de travail seulement ; jamais au 1er cycle', () => {
    expect(plans(create(4), 1).map((x) => x?.isolationRir ?? null)).toEqual([null, null, 1, null]);
    expect(plans(create(4), 0).map((x) => x?.isolationRir ?? null)).toEqual([null, null, null, null]);
    const week = generationWeekOf(mesocycleState(create(4), day(14), CONFIG, { closedBefore: 2 }));
    expect(week).toMatchObject({ rir: 2, isolationRir: 1 });
  });
});

describe('PROG-01 : 6 semaines (D-267)', () => {
  it('RIR 3, 3, 2-3, 2, 1-2, décharge en semaine 6 ; isolation RIR 1 en semaine 5 à partir du 2e cycle', () => {
    const p = plans(create(6));
    expect(p.map((x) => [x?.rirLow ?? x?.rir, x?.rir])).toEqual([[3, 3], [3, 3], [2, 3], [2, 2], [1, 2], [3, 4]]);
    expect(p[5]).toMatchObject({ deload: true, deloadSets: 2, deloadLoad: 0.9 });
    expect(plans(create(6), 1).map((x) => x?.isolationRir ?? null)).toEqual([null, null, null, null, 1, null]);
  });
});

describe('PROG-01 : semaine de reprise (D-267 (4))', () => {
  it('désactivée par défaut : semaine 1 avec toutes les séries, RIR 3', () => {
    const spec = create(4);
    expect(spec.rampUp).toBe(false);
    const w1 = plans(spec)[0];
    expect(w1 && linePlanSets(4, w1, CONFIG)).toBe(4);
    expect(w1?.rir).toBe(3);
  });
  it('activée : semaine 1 seulement, lignes à 4 séries ou plus −1, les autres intactes', () => {
    const p = plans(create(4, true));
    expect(p[0] && [linePlanSets(4, p[0], CONFIG), linePlanSets(5, p[0], CONFIG), linePlanSets(3, p[0], CONFIG)]).toEqual([3, 4, 3]);
    expect(p[1] && linePlanSets(4, p[1], CONFIG)).toBe(4);
  });
  it('le cycle suivant ne reprend jamais la semaine de reprise', () => {
    expect(nextMesocycleSpec(create(4, true), 'repeat', day(28), CONFIG)?.rampUp).toBe(false);
  });
});

describe('PROG-01 : durée changée en cours de cycle (D-267 (3))', () => {
  it('5 → 4 en semaine 2 : le cycle en cours garde 5 semaines et ses plans, le suivant en a 4', () => {
    const spec = create(5);
    const before = mesocycleState(spec, day(9), CONFIG);
    const changed = changeNextWeeks(spec, 4, CONFIG);
    expect(changed).toMatchObject({ weeks: 5, nextWeeks: 4 });
    expect(changed && mesocycleState(changed, day(9), CONFIG)).toEqual(before);
    const next = changed && nextMesocycleSpec(changed, 'repeat', day(35), CONFIG);
    expect(next).toMatchObject({ weeks: 4, nextWeeks: null });
  });
  it('durée hors 4 / 5 / 6 refusée', () => {
    expect(changeNextWeeks(create(5), 3, CONFIG)).toBeNull();
    expect(changeNextWeeks(create(5), 7, CONFIG)).toBeNull();
  });
});

describe('PROG-01 : pause (D-73 (9))', () => {
  it('4 semaines, reprise après plus de 21 jours avec semaine allégée : plan de la semaine 1 avec l’allègement de reprise', () => {
    const spec: MesocycleSpec = { ...create(4), pauses: [{ from: day(9), to: day(31), lightWeek: true }] };
    const s = mesocycleState(spec, day(33), CONFIG);
    expect(s.kind).toBe('light');
    expect(s.plan && [s.plan.rir, linePlanSets(4, s.plan, CONFIG), s.plan.priorityBonus]).toEqual([3, 3, 0]);
  });
});

describe('PROG-01 : décharge à 90 %, arrondie vers le bas au cran du matériel (D-267)', () => {
  const deloaded = (refKg: number, sets: number, loads: readonly number[] | null, assisted = false, redDay = false) => {
    const c = { ...activeConstraints({ estimates: [], lastWorkedAt: null, now: '2026-11-16T08:00:00.000Z', deload: true, recovery: null, config: PCONFIG }), deloadSets: 2, deloadLoad: 0.9, redDay, lowRecovery: redDay };
    const r = reducedTarget(c, { loadKg: refKg, reps: Array.from({ length: sets }, () => 8) }, 'compound', PCONFIG, assisted);
    return { sets: r.reps.length, kg: snapToEquipment(r.targetKg, r.reps, loads, PCONFIG).loadKg, targetKg: r.targetKg };
  };
  it('cran de 2,5 kg : 100 → 90, 87,5 → 77,5, 52,5 → 45 (47,25 arrondi vers le bas) ; 2 séries', () => {
    const bar = Array.from({ length: 73 }, (_, i) => 20 + i * 2.5); // barre : 20 à 200 kg au cran de 2,5 kg
    expect([100, 87.5, 52.5].map((kg) => deloaded(kg, 4, bar).kg)).toEqual([90, 77.5, 45]);
    expect(deloaded(100, 4, null).sets).toBe(2);
    expect(deloaded(100, 1, null).sets).toBe(1);
  });
  it('paires d’haltères (charge par haltère, grille 2 kg) : 26 → 22, 30 → 26', () => {
    const grid = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
    expect([26, 30].map((kg) => deloaded(kg, 3, grid).kg)).toEqual([22, 26]);
  });
  it('tractions assistées (D-273) : l’assistance est gardée, jamais réduite ; en décharge seule puis avec la journée rouge', () => {
    expect(deloaded(30, 4, null, true)).toEqual({ sets: 2, kg: 30, targetKg: 30 });
    expect(deloaded(30, 4, null, true, true)).toEqual({ sets: 2, kg: 30, targetKg: 30 });
  });
});
