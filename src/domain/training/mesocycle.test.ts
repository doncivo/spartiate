import { describe, expect, it } from 'vitest';
import { day, OTHER_ROUTINE_ID, PRD_FIVE_WEEKS, ROUTINE_ID, START } from '../../../tests/fixtures/training/mesocycle';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from './config';
import {
  anticipateDeload,
  closeMesocycle,
  createMesocycleSpec,
  generationWeekOf,
  isDeloadOn,
  linePlanSets,
  mesocycleState,
  nextMesocycleSpec,
  validateMesocycleSpec,
  workWeekPlan,
  type MesocycleSpec,
} from './mesocycle';

/**
 * I3-02 (PRD § 12.2, § 12.5 ; D-73 points 3 et 8) : durée, semaines de travail (séries, RIR), deload planifié et anticipé, fin de bloc.
 */

const create = (weeks: number | 'unlimited' = 5): MesocycleSpec => {
  const spec = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks }, CONFIG);
  if (spec === null) throw new Error('spec');
  return spec;
};
const stateAt = (spec: MesocycleSpec, n: number) => mesocycleState(spec, day(n), CONFIG);

describe('création (critère 1)', () => {
  it('5 semaines par défaut, deload en dernière semaine ; 4 à 7 admis ; illimité = blocs de 5', () => {
    expect(CONFIG.mesoWeeks).toBe(5);
    expect(create()).toMatchObject({ routineId: ROUTINE_ID, startDate: START, weeks: 5, unlimited: false, deloadWeek: null, status: 'active', outcome: null, pauses: [], rotationIndex: 0 });
    for (const weeks of [4, 5, 6, 7]) {
      const spec = create(weeks);
      expect(spec.weeks).toBe(weeks);
      for (let w = 1; w < weeks; w += 1) expect(stateAt(spec, (w - 1) * 7).kind, `${weeks}/${w}`).toBe('work');
      expect(stateAt(spec, (weeks - 1) * 7)).toMatchObject({ phase: 'active', week: weeks, kind: 'deload' });
      expect(stateAt(spec, weeks * 7).phase).toBe('finished');
    }
    for (const bad of [3, 8, 0, 4.5, Number.NaN]) expect(createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks: bad }, CONFIG), String(bad)).toBeNull();
    expect(createMesocycleSpec({ routineId: '', startDate: START, weeks: 5 }, CONFIG)).toBeNull();
    expect(create('unlimited')).toMatchObject({ weeks: CONFIG.unlimitedBlockWeeks, unlimited: true });
  });

  it('illimité : blocs roulants de 5 semaines, deload en fin de chaque bloc, jamais terminé', () => {
    const spec = create('unlimited');
    const kinds = Array.from({ length: 15 }, (_, w) => stateAt(spec, w * 7).kind);
    expect(kinds).toEqual(['work', 'work', 'work', 'work', 'deload', 'work', 'work', 'work', 'work', 'deload', 'work', 'work', 'work', 'work', 'deload']);
    expect(stateAt(spec, 52 * 7)).toMatchObject({ phase: 'active', blockIndex: 10, blockWeek: 3 });
    expect([0, 5, 10].map((w) => stateAt(spec, w * 7).blockIndex)).toEqual([0, 1, 2]);
  });

  it('avant le début : pas commencé ; jours de la semaine : même semaine du lundi au dimanche', () => {
    expect(mesocycleState(create(), day(-1), CONFIG).phase).toBe('not-started');
    expect([0, 3, 6].map((n) => stateAt(create(), n).week)).toEqual([1, 1, 1]);
    expect(stateAt(create(), 7).week).toBe(2);
  });
});

describe('semaines de travail (critère 2, D-73 point 3)', () => {
  it('5 semaines : tableau du § 12.5 pour une ligne à 3 séries (2-3-3-4, RIR 3-2-1-1), deload en semaine 5', () => {
    const spec = create();
    for (const row of PRD_FIVE_WEEKS) {
      const s = stateAt(spec, (row.week - 1) * 7);
      expect(s.kind, `semaine ${row.week}`).toBe(row.kind);
      expect(s.plan).not.toBeNull();
      if (s.plan === null) continue;
      expect(linePlanSets(3, s.plan, CONFIG), `séries semaine ${row.week}`).toBe(row.sets);
      expect(s.plan.rir, `RIR semaine ${row.week}`).toBe(row.rir);
    }
  });

  it('séries : jamais plus d’une de plus d’une semaine à l’autre, dans [séries − 1, séries + 1] ; RIR de 3 à 1, jamais 0', () => {
    for (const workWeeks of [3, 4, 5, 6]) {
      const plans = Array.from({ length: workWeeks }, (_, i) => workWeekPlan(i, workWeeks, CONFIG));
      expect(plans[0]).toMatchObject({ setsOffset: -1, rir: CONFIG.rirStart, deload: false });
      expect(plans.at(-1)).toMatchObject({ setsOffset: 1, rir: CONFIG.rirEnd });
      for (let i = 1; i < plans.length; i += 1) {
        const step = (plans[i]?.setsOffset ?? 0) - (plans[i - 1]?.setsOffset ?? 0);
        expect(step === 0 || step === CONFIG.setsPerWeekIncrement, `${workWeeks}/${i}`).toBe(true);
        expect(plans[i]?.rir ?? 0).toBeLessThanOrEqual(plans[i - 1]?.rir ?? 0);
      }
      for (const p of plans) {
        expect(p.rir).toBeGreaterThanOrEqual(1);
        expect(Math.abs(p.setsOffset)).toBeLessThanOrEqual(1);
      }
    }
    expect([0, 1, 2, 3, 4, 5].map((i) => workWeekPlan(i, 6, CONFIG).setsOffset)).toEqual([-1, -1, 0, 0, 1, 1]);
    expect([0, 1, 2].map((i) => workWeekPlan(i, 3, CONFIG))).toMatchObject([{ setsOffset: -1, rir: 3 }, { setsOffset: 0, rir: 2 }, { setsOffset: 1, rir: 1 }]);
  });

  it('séries d’une ligne : au moins une, au plus 20 ; priorité +1 en semaine de travail seulement (D-73 point 8)', () => {
    const w1 = workWeekPlan(0, 4, CONFIG);
    expect(linePlanSets(1, w1, CONFIG)).toBe(1);
    expect(linePlanSets(20, workWeekPlan(3, 4, CONFIG), CONFIG)).toBe(20);
    expect(w1.priorityBonus).toBe(CONFIG.prioritySetDelta);
    expect(linePlanSets(3, w1, CONFIG, true)).toBe(3);
    expect(linePlanSets(3, workWeekPlan(3, 4, CONFIG), CONFIG, true)).toBe(5);
    const deload = stateAt(create(), 28).plan;
    if (deload === null) throw new Error('plan');
    expect(deload).toMatchObject({ deload: true, priorityBonus: 0, setsOffset: 0, rir: 4 });
    expect(linePlanSets(3, deload, CONFIG, true)).toBe(3);
  });

  it('semaine du générateur (interface I3-01) : séries, RIR, deload et rotation ; rien hors d’un cycle actif', () => {
    const spec = create();
    expect(generationWeekOf(stateAt(spec, 0))).toEqual({ workingSets: null, rir: 3, setsOffset: -1, deload: false, priorityBonus: 1 });
    expect(generationWeekOf(stateAt(spec, 28))).toEqual({ workingSets: null, rir: 4, setsOffset: 0, deload: true, priorityBonus: 0 });
    expect(generationWeekOf(stateAt(spec, 35))).toBeNull();
    expect(generationWeekOf(mesocycleState(spec, day(-3), CONFIG))).toBeNull();
    expect(stateAt({ ...spec, rotationIndex: 2 }, 0).mesocycleIndex).toBe(2);
    expect(stateAt({ ...create('unlimited'), rotationIndex: 2 }, 5 * 7).mesocycleIndex).toBe(3);
  });
});

describe('deload (critères 3 et 4)', () => {
  it('deload planifié : jour de deload vrai pendant la dernière semaine seulement', () => {
    const spec = create();
    expect(isDeloadOn(spec, day(27), CONFIG)).toBe(false);
    expect(isDeloadOn(spec, day(28), CONFIG)).toBe(true);
    expect(isDeloadOn(spec, day(34), CONFIG)).toBe(true);
    expect(isDeloadOn(spec, day(35), CONFIG)).toBe(false);
  });

  it('deload anticipé : proposé, confirmé, la semaine courante devient le deload, le cycle reste (rien effacé)', () => {
    const spec = create();
    const before = JSON.stringify(spec);
    expect(stateAt(spec, 10).canAnticipate).toBe(true);
    const early = anticipateDeload(spec, day(10), CONFIG);
    expect(JSON.stringify(spec)).toBe(before);
    if (early === null) throw new Error('early');
    expect(early).toMatchObject({ ...spec, deloadWeek: 2 });
    expect(stateAt(early, 10)).toMatchObject({ kind: 'deload', anticipated: true, canAnticipate: false, week: 2 });
    expect(stateAt(early, 3).kind).toBe('work');
    expect(stateAt(early, 14).phase).toBe('finished');
    // Jamais en semaine de deload, ni deux fois, ni hors d'un cycle actif.
    expect(anticipateDeload(spec, day(28), CONFIG)).toBeNull();
    expect(anticipateDeload(early, day(10), CONFIG)).toBeNull();
    expect(anticipateDeload(spec, day(40), CONFIG)).toBeNull();
    expect(anticipateDeload(closeMesocycle(spec, 'stopped', day(10)), day(10), CONFIG)).toBeNull();
  });

  it('illimité : un deload anticipé clôt le bloc, le suivant commence la semaine d’après (bloc + 1)', () => {
    const spec = create('unlimited');
    const early = anticipateDeload(spec, day(14), CONFIG);
    if (early === null) throw new Error('early');
    expect(stateAt(early, 14)).toMatchObject({ kind: 'deload', anticipated: true, blockIndex: 0 });
    expect(stateAt(early, 21)).toMatchObject({ kind: 'work', blockIndex: 1, blockWeek: 1 });
    expect(stateAt(early, 49)).toMatchObject({ kind: 'deload', blockIndex: 1, blockWeek: 5 });
    const again = anticipateDeload(early, day(56), CONFIG);
    if (again === null) throw new Error('again');
    expect(stateAt(again, 56)).toMatchObject({ kind: 'deload', blockIndex: 2 });
    expect(stateAt(again, 63)).toMatchObject({ kind: 'work', blockIndex: 3, blockWeek: 1 });
  });
});

describe('fin de bloc (critère 5)', () => {
  it('bilan : répéter, régénérer ou changer ; le cycle suivant repart en semaine 1, l’ancien est clos et gardé', () => {
    const spec = create(6);
    const today = day(42);
    expect(mesocycleState(spec, today, CONFIG).phase).toBe('finished');
    const repeat = nextMesocycleSpec(spec, 'repeat', today, CONFIG);
    expect(repeat).toMatchObject({ routineId: ROUTINE_ID, startDate: today, weeks: 6, unlimited: false, rotationIndex: 0, status: 'active', pauses: [], deloadWeek: null });
    const regen = nextMesocycleSpec({ ...spec, rotationIndex: 1 }, 'regenerate', today, CONFIG);
    expect(regen).toMatchObject({ routineId: ROUTINE_ID, rotationIndex: 2, weeks: 6 });
    const change = nextMesocycleSpec(spec, 'change', today, CONFIG, { routineId: OTHER_ROUTINE_ID, weeks: 'unlimited' });
    expect(change).toMatchObject({ routineId: OTHER_ROUTINE_ID, rotationIndex: 0, unlimited: true, weeks: 5 });
    expect(nextMesocycleSpec(spec, 'change', today, CONFIG)).toBeNull();
    for (const next of [repeat, regen, change]) if (next) expect(mesocycleState(next, today, CONFIG)).toMatchObject({ phase: 'active', week: 1, kind: 'work' });
    const closed = closeMesocycle(spec, 'repeat', today);
    expect(closed).toMatchObject({ status: 'completed', outcome: 'repeat', endedOn: today, startDate: START, weeks: 6 });
    expect(mesocycleState(closed, today, CONFIG)).toMatchObject({ phase: 'completed', plan: null });
  });
});

describe('validation', () => {
  it('cycle bien formé admis ; durée, semaine de deload, pauses incohérentes ou statut sans issue refusés', () => {
    const spec = create();
    expect(validateMesocycleSpec(spec, CONFIG)).toBe(true);
    expect(validateMesocycleSpec(closeMesocycle(spec, 'stopped', day(3)), CONFIG)).toBe(true);
    const bad: Partial<MesocycleSpec>[] = [
      { weeks: 9 },
      { unlimited: true, weeks: 4 },
      { deloadWeek: 0 },
      { deloadWeek: 6 },
      { rotationIndex: -1 },
      { blockOriginWeek: 0 },
      { status: 'completed' },
      { outcome: 'repeat' },
      { pauses: [{ from: day(-2), to: null, lightWeek: false }] },
      { pauses: [{ from: day(3), to: day(1), lightWeek: false }] },
      { pauses: [{ from: day(1), to: null, lightWeek: false }, { from: day(5), to: null, lightWeek: false }] },
      { pauses: [{ from: day(5), to: day(9), lightWeek: false }, { from: day(7), to: day(10), lightWeek: false }] },
      { pauses: [{ from: day(5), to: null, lightWeek: true }] },
      { startDate: 'demain' as never },
    ];
    for (const patch of bad) expect(validateMesocycleSpec({ ...spec, ...patch }, CONFIG), JSON.stringify(patch)).toBe(false);
  });
});
