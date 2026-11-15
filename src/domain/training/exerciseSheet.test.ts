import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '../types';
import { DEFAULT_PROGRESSION_CONFIG } from './config';
import { analyzeHistory, current1rmFromSessions } from './estimate1rm';
import { sheetRecord, sheetStats, TREND_DAYS } from './exerciseSheet';
import type { ExerciseSession, HistorySet } from './types';

/**
 * ERGO-02b (critère 2, revue d'ERGO-02 point 4) : chiffres de la fiche exercice, règles pures du domaine (l'écran ExerciseSheetStats les
 * importe, comportement identique à ERGO-02). Record : charge la plus lourde d'une série de travail validée, puis le plus de répétitions à
 * cette charge ; à égalité, la séance la plus ancienne l'a établi ; échauffement, série non validée, charge nulle ou absente : jamais un record.
 * Données SYNTHÉTIQUES.
 */
const LOAD = { metric: 'load-reps', bodyweightFraction: null } as const;
const day = (n: number): IsoDateTime => `2026-10-${String(n).padStart(2, '0')}T18:00:00.000Z` as IsoDateTime;
const NOW = day(31);
const set = (position: number, loadKg: number | null, reps: number | null, over: Partial<HistorySet> = {}): HistorySet => ({ position, setKind: 'work', done: true, reps, loadKg, rir: null, ...over });
const session = (n: number, sets: readonly HistorySet[], over: Partial<ExerciseSession> = {}): ExerciseSession => ({ workoutId: `w${String(n)}`, endedAt: day(n), difficulty: null, sets, ...over });
const straight = (n: number, loadKg: number, reps: readonly number[]): ExerciseSession => session(n, reps.map((r, i) => set(i + 1, loadKg, r)));

describe('record de la fiche (sheetRecord)', () => {
  it('aucune séance : null', () => {
    expect(sheetRecord([])).toBeNull();
  });

  it('charge la plus lourde l’emporte sur plus de répétitions à une charge moindre', () => {
    expect(sheetRecord([straight(10, 60, [12, 12, 12]), straight(12, 62.5, [6, 5, 5])])).toEqual({ loadKg: 62.5, reps: 6, endedAt: day(12) });
  });

  it('à charge égale : le plus de répétitions ; à égalité, la séance la plus ancienne l’a établi (ordre reçu indifférent)', () => {
    const a = straight(10, 60, [8, 8, 7]);
    const b = straight(14, 60, [9, 8, 8]);
    const c = straight(20, 60, [9, 9, 9]);
    expect(sheetRecord([a, b])).toEqual({ loadKg: 60, reps: 9, endedAt: day(14) });
    expect(sheetRecord([c, b, a])).toEqual({ loadKg: 60, reps: 9, endedAt: day(14) });
  });

  it('échauffement, série non validée, répétitions absentes, charge nulle ou absente : ignorés', () => {
    const history = [
      session(10, [
        set(1, 100, 5, { setKind: 'warmup' }),
        set(2, 90, 5, { done: false }),
        set(3, 80, null),
        set(4, 0, 20),
        set(5, null, 15),
        set(6, 50, 10),
      ]),
    ];
    expect(sheetRecord(history)).toEqual({ loadKg: 50, reps: 10, endedAt: day(10) });
    expect(sheetRecord([session(11, [set(1, 0, 20), set(2, null, 15)])])).toBeNull();
  });

  it('sheetStats rend le même record', () => {
    const history = [straight(10, 60, [8, 8, 8]), straight(14, 62.5, [8, 7, 6])];
    expect(sheetStats(history, LOAD, NOW).record).toEqual(sheetRecord(history));
  });
});

describe('séances de la fiche (sheetStats.sessions)', () => {
  it('plus récente d’abord ; séries de travail validées groupées par charge consécutive, dans l’ordre des séries ; séance sans travail validé absente', () => {
    const history = [
      session(10, [set(3, 65, 7), set(1, 67.5, 8), set(2, 67.5, 8), set(4, 67.5, 6), set(0, 40, 10, { setKind: 'warmup' })], { difficulty: 'hard' }),
      session(12, [set(1, 60, 8, { done: false })]),
      session(14, [set(1, null, 12), set(2, null, 10)], { deload: true }),
    ];
    expect(sheetStats(history, LOAD, NOW).sessions).toEqual([
      { workoutId: 'w14', endedAt: day(14), difficulty: null, deload: true, groups: [{ loadKg: null, reps: [12, 10] }] },
      {
        workoutId: 'w10',
        endedAt: day(10),
        difficulty: 'hard',
        deload: false,
        groups: [
          { loadKg: 67.5, reps: [8, 8] },
          { loadKg: 65, reps: [7] },
          { loadKg: 67.5, reps: [6] },
        ],
      },
    ]);
  });
});

describe('1RM estimé et 8 semaines de la fiche', () => {
  it('raisons d’absence : métrique sans charge, poids du corps, aucun historique', () => {
    expect(sheetStats([], { metric: 'time', bodyweightFraction: null }, NOW).oneRm).toEqual({ kind: 'none', reason: 'notLoad' });
    expect(sheetStats([], { metric: 'load-reps', bodyweightFraction: 1 }, NOW).oneRm).toEqual({ kind: 'none', reason: 'bodyweight' });
    expect(sheetStats([], LOAD, NOW)).toEqual({ oneRm: { kind: 'none', reason: 'noHistory' }, record: null, trend: null, sessions: [] });
  });

  it('historique sans séance valide : noValid, aucune évolution', () => {
    const stats = sheetStats([session(10, [set(1, 60, 8, { done: false })])], LOAD, NOW);
    expect(stats.oneRm).toEqual({ kind: 'none', reason: 'noValid' });
    expect(stats.trend).toBeNull();
  });

  it('1RM et nombre de séances : ceux du moteur (analyzeHistory, current1rmFromSessions) ; une seule séance : pas d’évolution', () => {
    const history = [straight(20, 60, [8, 8, 8])];
    const { estimates } = analyzeHistory(history, DEFAULT_PROGRESSION_CONFIG);
    const stats = sheetStats(history, LOAD, NOW);
    expect(stats.oneRm).toMatchObject({ kind: 'value', kg: current1rmFromSessions(estimates, DEFAULT_PROGRESSION_CONFIG), sessions: 1 });
    expect(stats.trend).toBeNull();
  });

  it(`évolution : séances valides des ${String(TREND_DAYS)} derniers jours, de la plus ancienne à la plus récente ; écart dernière − première`, () => {
    const old = straight(1, 40, [8, 8, 8]);
    const history = [straight(28, 62.5, [8, 8, 8]), old, straight(20, 60, [8, 8, 8])];
    const late = (day(1).replace('2026-10', '2026-12') as IsoDateTime);
    const stats = sheetStats(history, LOAD, late);
    const values = analyzeHistory(history, DEFAULT_PROGRESSION_CONFIG)
      .estimates.filter((e) => Date.parse(e.endedAt) >= Date.parse(late) - TREND_DAYS * 86_400_000)
      .map((e) => e.e1rmKg)
      .reverse();
    expect(values).toHaveLength(2);
    expect(stats.trend).toEqual({ values, deltaKg: (values[1] as number) - (values[0] as number) });
    expect((stats.trend?.deltaKg ?? 0) > 0).toBe(true);
  });
});
