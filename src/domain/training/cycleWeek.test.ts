import { describe, expect, it } from 'vitest';
import { day, ROUTINE_ID, START } from '../../../tests/fixtures/training/mesocycle';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from './config';
import { cycleWeekMarker } from './cycleWeek';
import { anticipateDeload, closeMesocycle, createMesocycleSpec, mesocycleState, type MesocycleSpec } from './mesocycle';

/** ERGO-03 (D-297) : vecteurs du repère « Semaine N sur M » / « Décharge ». Cycles synthétiques commencés le lundi 2 novembre 2026. */
const create = (weeks: number | 'unlimited'): MesocycleSpec => {
  const spec = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks }, CONFIG);
  if (spec === null) throw new Error('spec');
  return spec;
};
const at = (spec: MesocycleSpec, n: number) => cycleWeekMarker(mesocycleState(spec, day(n), CONFIG));

describe('ERGO-03 : cycleWeekMarker', () => {
  it.each([
    [0, { week: 1, total: 4, deload: false }],
    [6, { week: 1, total: 4, deload: false }],
    [7, { week: 2, total: 4, deload: false }],
    [20, { week: 3, total: 4, deload: false }],
    [21, { week: 4, total: 4, deload: true }],
    [27, { week: 4, total: 4, deload: true }],
  ])('cycle de 4 semaines, jour %i : %o', (n, expected) => {
    expect(at(create(4), n)).toEqual(expected);
  });

  it('cycle de 6 semaines : semaine 6 sur 6 en décharge, semaine 5 de travail', () => {
    expect(at(create(6), 28)).toEqual({ week: 5, total: 6, deload: false });
    expect(at(create(6), 35)).toEqual({ week: 6, total: 6, deload: true });
  });

  it('rien hors d’un cycle en cours : pas commencé, fini, clos', () => {
    expect(at(create(4), -1)).toBeNull();
    expect(at(create(4), 28)).toBeNull();
    expect(at(closeMesocycle(create(4), 'stopped', day(3)), 3)).toBeNull();
  });

  it('état invalide : rien', () => {
    expect(cycleWeekMarker({ phase: 'invalid', week: 0, blockWeek: 0, blockLength: 0, totalWeeks: null, kind: 'work' })).toBeNull();
  });

  it('décharge anticipée en semaine 2 d’un cycle de 4 : « Semaine 2 sur 4 », décharge', () => {
    const anticipated = anticipateDeload(create(4), day(8), CONFIG);
    if (anticipated === null) throw new Error('anticipate');
    expect(at(anticipated, 8)).toEqual({ week: 2, total: 4, deload: true });
  });

  it('cycle illimité : semaine du bloc sur la longueur du bloc, décharge en fin de bloc, puis bloc suivant', () => {
    const spec = create('unlimited');
    const L = CONFIG.unlimitedBlockWeeks;
    expect(at(spec, 0)).toEqual({ week: 1, total: L, deload: false });
    expect(at(spec, (L - 1) * 7)).toEqual({ week: L, total: L, deload: true });
    expect(at(spec, L * 7)).toEqual({ week: 1, total: L, deload: false });
  });

  it('cycle en pause : la semaine reste affichée (le cycle existe)', () => {
    const spec: MesocycleSpec = { ...create(4), pauses: [{ from: day(9), to: null, lightWeek: false }] };
    expect(mesocycleState(spec, day(10), CONFIG).phase).toBe('paused');
    expect(at(spec, 10)).toEqual({ week: 2, total: 4, deload: false });
  });
});
