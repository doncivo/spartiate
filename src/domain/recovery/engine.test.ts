import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baselineStats, buildBaseline } from './baseline';
import { RECOVERY_CONFIG, STRENGTH_SCALE } from './config';
import { summarizeRecoveryDay } from './daySummary';
import { dayExertion } from './exertion';
import { muscleRecovery } from './muscleRecovery';
import { recoveryScore, targetZone } from './recoveryScore';
import { bedtimeRegularity, bedtimeTarget, sleepNeed } from './sleepNeed';
import type { NightRecord, RecoverySet, RecoveryWorkout } from './types';

/** Fixtures § 16.6 : 30 nuits, du 2026-10-10 au 2026-11-08. HRV alternée 48 / 52 (μ 50), FC repos alternée 54 / 56 (μ 55). */
const TZ = 'Europe/Paris';
const TODAY = '2026-11-08';
const NOW = '2026-11-08T08:00:00.000Z';

function dayOf(i: number): string {
  const d = new Date(Date.UTC(2026, 9, 10 + i));
  return d.toISOString().slice(0, 10);
}

function night(i: number, over: Partial<NightRecord> = {}): NightRecord {
  return { day: dayOf(i), hrvMs: i % 2 === 0 ? 48 : 52, restingHr: i % 2 === 0 ? 54 : 56, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390, ...over };
}

/** 29 nuits de base (i = 0..28 → 10 oct. … 7 nov.) puis la nuit du jour (i = 29 → 8 nov.). */
function thirty(today: Partial<NightRecord> = {}, patch: (n: NightRecord, i: number) => NightRecord = (n) => n): NightRecord[] {
  return Array.from({ length: 30 }, (_, i) => patch(night(i, i === 29 ? { hrvMs: 50, restingHr: 55, ...today } : {}), i));
}

const set = (over: Partial<RecoverySet> = {}): RecoverySet => ({ kg: 100, reps: 10, difficulty: 'ok', isWarmup: false, completed: true, muscles: [{ id: 'chest', weight: 1 }], ...over });

describe('baselineStats : moyenne, σ échantillon, valeurs aberrantes > 2,5 σ exclues', () => {
  it('14 valeurs alternées 48 / 52 : μ 50, σ 2,0755', () => {
    const s = baselineStats([...Array(7).fill(48), ...Array(7).fill(52)] as number[]);
    expect(s.mean).toBeCloseTo(50, 10);
    expect(s.sd).toBeCloseTo(2.0755, 4);
    expect(s.excluded).toBe(0);
  });

  it('une valeur aberrante (90) est exclue de la baseline', () => {
    const s = baselineStats([...Array(6).fill(48), ...Array(7).fill(52), 90] as number[]);
    expect(s.excluded).toBe(1);
    expect(s.used).toBe(13);
    expect(s.mean).toBeCloseTo(50.1538, 3);
    expect(s.sd).toBeCloseTo(2.0757, 3);
  });

  it('une seule valeur ou liste vide : pas de σ défini', () => {
    expect(baselineStats([])).toMatchObject({ used: 0, mean: null, sd: null });
    expect(baselineStats([5])).toMatchObject({ used: 1, mean: 5, sd: null });
  });
});

describe('buildBaseline : 14 dernières nuits VALIDES avant le jour', () => {
  it('prend 14 nuits, ignore le jour courant, les nuits sans mesure et les nuits trop courtes', () => {
    const nights = thirty({}, (n, i) => (i === 27 ? { ...n, hrvMs: null } : i === 26 ? { ...n, asleepMinutes: 100 } : n));
    const b = buildBaseline(nights, TODAY, 'hrvMs');
    expect(b.validNights).toBe(RECOVERY_CONFIG.baselineDays);
    expect(b.stats.used).toBe(14);
  });

  it('historique vide : aucune nuit', () => {
    expect(buildBaseline([], TODAY, 'hrvMs')).toMatchObject({ validNights: 0, stats: { mean: null } });
  });
});

describe('recoveryScore (§ 16.3)', () => {
  it('nominal : HRV 54 (z 1,93) et FC 53 (z 1,93) → raw 1,93 → 98', () => {
    const r = recoveryScore({ today: TODAY, nights: thirty({ hrvMs: 54, restingHr: 53 }), sleepRatio: 1 });
    expect(r.score).toBe(98);
    expect(r.reason).toBeNull();
    expect(r.raw).toBeCloseTo(1.927, 2);
    expect(r.sleepFactor).toBe(1);
    expect(r.baselineNights).toBe(14);
  });

  it('valeurs à la moyenne → 50', () => {
    expect(recoveryScore({ today: TODAY, nights: thirty(), sleepRatio: 1 }).score).toBe(50);
  });

  it('raw borné à [−2, 2] : valeur extrême = 100 au plus', () => {
    expect(recoveryScore({ today: TODAY, nights: thirty({ hrvMs: 120, restingHr: 30 }), sleepRatio: 1 }).score).toBe(100);
    expect(recoveryScore({ today: TODAY, nights: thirty({ hrvMs: 10, restingHr: 120 }), sleepRatio: 1 }).score).toBe(0);
  });

  it('nuit courte : facteur sommeil 0,8 (ratio 0,667) → 79', () => {
    const r = recoveryScore({ today: TODAY, nights: thirty({ hrvMs: 54, restingHr: 53 }), sleepRatio: 300 / 450 });
    expect(r.sleepFactor).toBe(0.8);
    expect(r.score).toBe(79);
  });

  it('facteur sommeil = ratio borné à [0,8 ; 1]', () => {
    const f = (ratio: number | null): number =>
      recoveryScore({ today: TODAY, nights: thirty(), sleepRatio: ratio }).sleepFactor;
    expect(f(0.9)).toBe(0.9);
    expect(f(1.4)).toBe(1);
    expect(f(0.1)).toBe(0.8);
    expect(f(null)).toBe(1);
  });

  it('FC élevée (58) avec HRV normale → 28, zone basse', () => {
    const r = recoveryScore({ today: TODAY, nights: thirty({ restingHr: 58 }), sleepRatio: 1 });
    expect(r.score).toBe(28);
    expect(targetZone(r.score)).toEqual({ from: 0, to: 3 });
  });

  it('abstention : 6 nuits de baseline seulement → null « baseline_incomplete », jamais 0', () => {
    const nights = thirty().slice(-7);
    const r = recoveryScore({ today: TODAY, nights, sleepRatio: 1 });
    expect(r.score).toBeNull();
    expect(r.reason).toBe('baseline_incomplete');
    expect(r.baselineNights).toBe(6);
  });

  it('7 nuits de baseline : le score existe (minNights)', () => {
    expect(recoveryScore({ today: TODAY, nights: thirty().slice(-8), sleepRatio: 1 }).score).not.toBeNull();
  });

  it('σ = 0 (HRV constante) → null « zero_variance »', () => {
    const r = recoveryScore({ today: TODAY, nights: thirty({}, (n, i) => (i < 29 ? { ...n, hrvMs: 50 } : n)), sleepRatio: 1 });
    expect(r.score).toBeNull();
    expect(r.reason).toBe('zero_variance');
  });

  it('3 jours sans montre : mesure du jour absente → null « measure_missing_hrv »', () => {
    const nights = thirty({ hrvMs: null, restingHr: null }, (n, i) => (i === 27 || i === 28 ? { ...n, hrvMs: null, restingHr: null } : n));
    const r = recoveryScore({ today: TODAY, nights, sleepRatio: 1 });
    expect(r.score).toBeNull();
    expect(r.reason).toBe('measure_missing_hrv');
  });

  it('FC repos absente seule → « measure_missing_rhr » ; aucune nuit du jour → mesure absente', () => {
    expect(recoveryScore({ today: TODAY, nights: thirty({ restingHr: null }), sleepRatio: 1 }).reason).toBe('measure_missing_rhr');
    expect(recoveryScore({ today: TODAY, nights: thirty().slice(0, 29), sleepRatio: 1 }).reason).toBe('measure_missing_hrv');
  });

  it('correction de revue 4 : sans durée de sommeil valide, pas de score (jamais un facteur neutre) → « measure_missing_sleep »', () => {
    const r = recoveryScore({ today: TODAY, nights: thirty({ hrvMs: 54, restingHr: 53 }), sleepRatio: null });
    expect(r).toMatchObject({ score: null, reason: 'measure_missing_sleep' });
    expect(recoveryScore({ today: TODAY, nights: thirty({ hrvMs: 54, restingHr: 53 }), sleepRatio: 0 }).reason).toBe('measure_missing_sleep');
    expect(recoveryScore({ today: TODAY, nights: thirty({ restingHr: null }), sleepRatio: null }).reason).toBe('measure_missing_rhr');
  });

  it('valeur aberrante dans la baseline : exclue, le score reste celui de la baseline propre', () => {
    const nights = thirty({ hrvMs: 54, restingHr: 53 }, (n, i) => (i === 20 ? { ...n, hrvMs: 90 } : n));
    const r = recoveryScore({ today: TODAY, nights, sleepRatio: 1 });
    expect(r.excludedOutliers).toBe(1);
    expect(r.score).toBe(97);
  });

  it('déterminisme : même entrée, même sortie', () => {
    const input = { today: TODAY, nights: thirty({ hrvMs: 53 }), sleepRatio: 0.9 };
    expect(recoveryScore(input)).toEqual(recoveryScore(input));
  });
});

describe('targetZone (§ 16.3)', () => {
  it.each([
    [100, 6, 8], [66, 6, 8], [65, 4, 6], [34, 4, 6], [33, 0, 3], [0, 0, 3],
  ])('score %i → %i–%i', (score, from, to) => {
    expect(targetZone(score)).toEqual({ from, to });
  });
  it('null → aucune zone', () => {
    expect(targetZone(null)).toBeNull();
  });
});

describe('dayExertion : musculation seule, cardio à zéro (D-88)', () => {
  const workout = (sets: RecoverySet[], endedAt = '2026-11-07T17:00:00.000Z'): RecoveryWorkout => ({ endedAt, sets });

  it('points muscu = tonnes × facteur de difficulté × échelle, puis 10 × (1 − e^(−points/300))', () => {
    const sets = [set({ difficulty: 'easy' }), set({ difficulty: 'ok' }), set({ difficulty: 'hard' }), set({ difficulty: null })];
    const x = (1000 * 0.8 + 1000 + 1000 * 1.2 + 1000) / 1000;
    const e = dayExertion([workout(sets)], '2026-11-07', TZ);
    expect(e.muscuLoad).toBeCloseTo(x * STRENGTH_SCALE, 10);
    expect(e.value).toBeCloseTo(10 * (1 - Math.exp(-(x * STRENGTH_SCALE) / 300)), 2);
    expect(e.cardioLoad).toBe(0);
  });

  // D-88 révisée : une séance lourde doit atteindre la zone cible et le supplément de sommeil (> 5). Échelle de départ : 20.
  it.each([
    [6, 3.3, 'séance légère'],
    [12, 5.51, 'séance normale : environ 5,5'],
    [20, 7.36, 'très grosse séance : environ 7,5'],
  ])('%i t à difficulté normale → Exertion %f (%s)', (tonnes, expected) => {
    const sets = Array.from({ length: tonnes }, () => set({ kg: 100, reps: 10, difficulty: 'ok' }));
    expect(dayExertion([workout(sets)], '2026-11-07', TZ).value).toBeCloseTo(expected, 2);
  });

  it('l’échelle de départ vaut 20 (choix prudent, révisable par Ali)', () => {
    expect(STRENGTH_SCALE).toBe(20);
  });

  it('12 t donnent plus de 5 : le supplément de besoin de sommeil joue le lendemain', () => {
    const sets = Array.from({ length: 12 }, () => set({ kg: 100, reps: 10, difficulty: 'ok' }));
    const { summary } = summarizeRecoveryDay({ ...base, nights: thirty(), workouts: [{ endedAt: '2026-11-07T17:00:00.000Z', sets }] });
    expect(summary.exertionPrevDay).toBeGreaterThan(5);
    expect(summary.sleepNeedMinutes).toBeGreaterThan(450);
  });

  it('l’explication dit que le cardio n’est pas compté (clé dédiée), même sans séance', () => {
    expect(dayExertion([workout([set()])], '2026-11-07', TZ).explanationKeys).toContain('exertion_cardio_not_counted');
    const none = dayExertion([], '2026-11-07', TZ);
    expect(none.value).toBe(0);
    expect(none.explanationKeys).toContain('exertion_cardio_not_counted');
  });

  it('échauffements, séries non terminées, charge absente exclus ; autre jour local exclu', () => {
    const sets = [set({ isWarmup: true }), set({ completed: false }), set({ kg: null }), set({ reps: null })];
    expect(dayExertion([workout(sets)], '2026-11-07', TZ).muscuLoad).toBe(0);
    expect(dayExertion([workout([set()], '2026-11-07T23:30:00.000Z')], '2026-11-07', TZ).muscuLoad).toBe(0);
  });

  it('borné à 10', () => {
    const huge = Array.from({ length: 10 }, () => set({ kg: 1_000_000, reps: 1000 }));
    expect(dayExertion([workout(huge)], '2026-11-07', TZ).value).toBeLessThanOrEqual(10);
  });
});

describe('sleepNeed (§ 16.3)', () => {
  it('7 h 30 + 0,2 h × max(0, Exertion veille − 5) : veille à 8 → 8 h 06', () => {
    const n = sleepNeed({ exertionPrevDay: 8, previousAsleepMinutes: Array(7).fill(450) as number[] });
    expect(n.needMinutes).toBe(486);
    expect(n.debtMinutes).toBe(0);
  });

  it('Exertion ≤ 5 : pas de supplément', () => {
    expect(sleepNeed({ exertionPrevDay: 3, previousAsleepMinutes: [] }).needMinutes).toBe(450);
  });

  it('dette 7 j (déficit par rapport à 7 h 30) plafonnée à 3 h ; nuits absentes comptées pour rien', () => {
    const n = sleepNeed({ exertionPrevDay: 0, previousAsleepMinutes: Array(7).fill(420) as number[] });
    expect(n.debtMinutes).toBe(180);
    expect(n.needMinutes).toBe(630);
    expect(sleepNeed({ exertionPrevDay: 0, previousAsleepMinutes: [420, 420] }).debtMinutes).toBe(60);
  });
});

describe('bedtimeRegularity et heure de coucher cible', () => {
  it('σ du coucher sur 7 jours ; 23 h et 1 h = 2 h d’écart, pas 22 h (minuit franchi)', () => {
    expect(bedtimeRegularity([1380, 1380, 1380])).toBe(0);
    expect(bedtimeRegularity([1380, 60, 1380])).toBeCloseTo(69.28, 1);
  });
  it('moins de 3 couchers : null', () => {
    expect(bedtimeRegularity([1380, 1380])).toBeNull();
  });
  it('besoin − médiane du lever : lever 6 h 30, besoin 7 h 30 → 23 h 00 ; 8 h 06 → 22 h 24', () => {
    const wakes = Array(14).fill(390) as number[];
    expect(bedtimeTarget({ needMinutes: 450, wakeMinutes: wakes })).toEqual({ time: '23:00', reason: null });
    expect(bedtimeTarget({ needMinutes: 486, wakeMinutes: wakes }).time).toBe('22:24');
  });
  it('moins de 7 levers connus : null avec raison', () => {
    expect(bedtimeTarget({ needMinutes: 450, wakeMinutes: Array(6).fill(390) as number[] })).toEqual({ time: null, reason: 'wake_history_incomplete' });
  });
});

describe('muscleRecovery (§ 16.3, approximation)', () => {
  const now = '2026-11-08T10:00:00.000Z';
  const w = (sets: RecoverySet[], endedAt: string): RecoveryWorkout => ({ endedAt, sets });
  const six = (over: Partial<RecoverySet> = {}): RecoverySet[] => Array.from({ length: 6 }, () => set(over));

  it('0 % à la fin de séance, linéaire jusqu’à 100 % sur 72 h (torse) : 24 h → 33 %', () => {
    const rows = muscleRecovery({ workouts: [w(six(), '2026-11-07T10:00:00.000Z')], now });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ muscleId: 'chest', group: 'Torse', percent: 33, hours: 72, lastWorkedAt: '2026-11-07T10:00:00.000Z', readyAt: '2026-11-10T10:00:00.000Z' });
    expect(muscleRecovery({ workouts: [w(six(), now)], now })[0]?.percent).toBe(0);
    expect(muscleRecovery({ workouts: [w(six(), '2026-11-03T10:00:00.000Z')], now })[0]?.percent).toBe(100);
  });

  it('séries × difficulté × poids du muscle règlent la durée (jambes 96 h, poids 0,5, 6 séries → 48 h)', () => {
    const legs = six({ muscles: [{ id: 'quads', weight: 0.5 }] });
    expect(muscleRecovery({ workouts: [w(legs, '2026-11-07T10:00:00.000Z')], now })[0]).toMatchObject({ group: 'Jambes', hours: 48, percent: 50 });
    const hard = six({ difficulty: 'hard' });
    expect(muscleRecovery({ workouts: [w(hard, '2026-11-07T10:00:00.000Z')], now })[0]?.hours).toBeCloseTo(72 * 1.2, 5);
  });

  it('la durée est bornée à [0,5 ; 1,5] × nominal', () => {
    expect(muscleRecovery({ workouts: [w([set()], '2026-11-07T10:00:00.000Z')], now })[0]?.hours).toBe(36);
    expect(muscleRecovery({ workouts: [w(Array.from({ length: 30 }, () => set()), '2026-11-07T10:00:00.000Z')], now })[0]?.hours).toBe(108);
  });

  it('deux séances : la moins récupérée l’emporte ; échauffement, série non terminée et muscle inconnu ignorés', () => {
    const rows = muscleRecovery({
      workouts: [
        w(six(), '2026-11-05T10:00:00.000Z'),
        w([...six(), set({ isWarmup: true, muscles: [{ id: 'biceps', weight: 1 }] }), set({ muscles: [{ id: 'inconnu', weight: 1 }] }), set({ completed: false, muscles: [{ id: 'triceps', weight: 1 }] })], '2026-11-08T04:00:00.000Z'),
      ],
      now,
    });
    expect(rows.map((r) => r.muscleId)).toEqual(['chest']);
    expect(rows[0]?.percent).toBe(Math.round((6 / 72) * 100));
  });

  it('muscle sans séance dans la fenêtre : aucune ligne (inconnu ≠ 100 %) ; historique vide : tableau vide', () => {
    expect(muscleRecovery({ workouts: [w(six(), '2026-10-01T10:00:00.000Z')], now })).toEqual([]);
    expect(muscleRecovery({ workouts: [], now })).toEqual([]);
  });

  it('chaque muscle du catalogue a un groupe connu de la config', () => {
    const catalogue = JSON.parse(readFileSync(new URL('../../../content/exercises/muscles.json', import.meta.url), 'utf8')) as { muscles: { id: string; group: string }[] };
    for (const m of catalogue.muscles) {
      expect(Object.keys(RECOVERY_CONFIG.groupRecoveryClass)).toContain(m.group);
      expect(RECOVERY_CONFIG.muscleGroups[m.id]).toBe(m.group);
    }
    expect(Object.keys(RECOVERY_CONFIG.muscleGroups)).toHaveLength(catalogue.muscles.length);
  });
});

describe('summarizeRecoveryDay : résumé du jour (§ 16.4)', () => {
  const base = { today: TODAY, now: NOW, timeZone: TZ, workouts: [] as RecoveryWorkout[] };

  it('niveau C nominal : score, qualité good, zone cible, sommeil, contributeurs, explication cardio', () => {
    const { summary, muscles } = summarizeRecoveryDay({ ...base, nights: thirty({ hrvMs: 54, restingHr: 53 }) });
    expect(summary).toMatchObject({
      day: TODAY, level: 'C', recovery: 98, abstainReason: null, quality: 'good', targetZone: { from: 6, to: 8 },
      learningNights: 14, sleepMinutes: 450, sleepNeedMinutes: 450, sleepScore: 100, bedtimeSigmaMinutes: 0,
    });
    expect(summary.explanationKeys).toContain('exertion_cardio_not_counted');
    expect(summary.contributors.map((c) => c.key)).toEqual(['hrv', 'resting_hr', 'sleep']);
    expect(summary.computedAt).toBe(NOW);
    expect(muscles).toEqual([]);
  });

  it('apprentissage : 3 nuits → niveau B, recovery null avec raison, qualité insufficient, J+3/14', () => {
    const { summary } = summarizeRecoveryDay({ ...base, nights: thirty().slice(-4) });
    expect(summary).toMatchObject({ level: 'B', recovery: null, abstainReason: 'baseline_incomplete', quality: 'insufficient', learningNights: 3, targetZone: null });
  });

  it('nuit courte de 4 h avec baseline : sommeil sous le seuil absolu signalé, facteur appliqué', () => {
    const { summary } = summarizeRecoveryDay({ ...base, nights: thirty({ hrvMs: 54, restingHr: 53, asleepMinutes: 240 }) });
    expect(summary.recovery).toBe(Math.round(98.18 * 0.8));
    expect(summary.explanationKeys).toContain('sleep_short');
  });

  it('baseline à 7 nuits (< 14) : score calculé mais qualité partial', () => {
    const { summary } = summarizeRecoveryDay({ ...base, nights: thirty().slice(-8) });
    expect(summary.recovery).not.toBeNull();
    expect(summary.quality).toBe('partial');
  });

  it('correction de revue 4 : niveau C sans sommeil → recovery null « measure_missing_sleep », niveau A (B exige sommeil ET FC repos)', () => {
    const { summary } = summarizeRecoveryDay({ ...base, nights: thirty({ hrvMs: 54, restingHr: 53, asleepMinutes: null }) });
    expect(summary).toMatchObject({ level: 'A', recovery: null, abstainReason: 'measure_missing_sleep', quality: 'insufficient', targetZone: null, sleepMinutes: null });
    expect(summary.contributors).toEqual([]);
  });

  it('correction de revue 4 : niveau B = sommeil ET FC repos ; l’un sans l’autre reste niveau A', () => {
    const only = (over: Partial<NightRecord>) => summarizeRecoveryDay({ ...base, nights: [night(29, { hrvMs: null, ...over })] }).summary.level;
    expect(only({ asleepMinutes: 420, restingHr: 55 })).toBe('B');
    expect(only({ asleepMinutes: 420, restingHr: null })).toBe('A');
    expect(only({ asleepMinutes: null, restingHr: 55 })).toBe('A');
  });

  it('aucune donnée du tout : niveau A, rien d’inventé', () => {
    const { summary, muscles } = summarizeRecoveryDay({ ...base, nights: [] });
    expect(summary).toMatchObject({ level: 'A', recovery: null, quality: 'insufficient', sleepMinutes: null, sleepScore: null, bedtimeSigmaMinutes: null, exertion: 0 });
    expect(muscles).toEqual([]);
  });

  it('la dette et le supplément d’Exertion de la veille entrent dans le besoin ; les muscles sortent en tableau prêt à écrire', () => {
    const sets = Array.from({ length: 6 }, () => set());
    const { summary, muscles } = summarizeRecoveryDay({
      ...base,
      nights: thirty(),
      workouts: [{ endedAt: '2026-11-07T17:00:00.000Z', sets }],
    });
    expect(summary.exertionPrevDay).toBeCloseTo(10 * (1 - Math.exp(-(6 * STRENGTH_SCALE) / 300)), 2);
    expect(summary.sleepNeedMinutes).toBe(450);
    expect(muscles[0]).toMatchObject({ day: TODAY, muscleId: 'chest' });
  });

  it('nuits postérieures au jour ignorées', () => {
    const nights = [...thirty(), night(31)];
    expect(summarizeRecoveryDay({ ...base, nights }).summary.recovery).toBe(50);
  });
});
