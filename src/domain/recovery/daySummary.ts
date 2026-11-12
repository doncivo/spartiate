import { RECOVERY_CONFIG } from './config';
import { dayExertion } from './exertion';
import { muscleRecovery } from './muscleRecovery';
import { recoveryScore, targetZone } from './recoveryScore';
import { bedtimeRegularity, debtNights, sleepNeed } from './sleepNeed';
import type { Contributor, MuscleRecoveryRow, NightRecord, RecoveryDaySummary, RecoveryExplanationKey, RecoveryLevel, RecoveryQuality, RecoveryWorkout } from './types';

export interface RecoveryDayInput {
  /** Jour local `yyyy-MM-dd` du résumé. */
  readonly today: string;
  /** Instant de calcul : le moteur ne lit jamais l'horloge. */
  readonly now: string;
  /** Fuseau IANA de l'appareil (jour local des séances). */
  readonly timeZone: string;
  readonly nights: readonly NightRecord[];
  readonly workouts: readonly RecoveryWorkout[];
}

export interface RecoveryDayOutput {
  readonly summary: RecoveryDaySummary;
  /** Lignes prêtes pour `muscle_recovery`, avec le jour du résumé. */
  readonly muscles: readonly (MuscleRecoveryRow & { readonly day: string })[];
}

/** `yyyy-MM-dd` décalé de `delta` jours (calendrier civil, sans fuseau). */
export function shiftDay(day: string, delta: number): string {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

const byDay = (a: NightRecord, b: NightRecord): number => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);

/**
 * Résumé du jour (§ 16.1, § 16.3) : niveau A / B / C, Recovery ou null avec raison, qualité, Exertion (musculation seule, D-88),
 * sommeil, régularité, contributeurs, zone cible, et récupération par muscle. Pur : mêmes entrées, mêmes sorties.
 */
export function summarizeRecoveryDay(input: RecoveryDayInput): RecoveryDayOutput {
  const cfg = RECOVERY_CONFIG;
  const nights = input.nights.filter((n) => n.day <= input.today).sort(byDay);
  const tonight = nights.find((n) => n.day === input.today);

  const exertionToday = dayExertion(input.workouts, input.today, input.timeZone);
  const exertionPrev = dayExertion(input.workouts, shiftDay(input.today, -1), input.timeZone);
  const previousAsleep = debtNights(nights, input.today).valid;
  const need = sleepNeed({ exertionPrevDay: exertionPrev.value, previousAsleepMinutes: previousAsleep });

  const sleepMinutes = tonight?.asleepMinutes ?? null;
  const ratio = sleepMinutes === null ? null : sleepMinutes / need.needMinutes;
  const sleepScore = ratio === null ? null : Math.round(Math.min(1, ratio) * 100);

  const score = recoveryScore({ today: input.today, nights, sleepRatio: ratio });
  const regularityFrom = shiftDay(input.today, -(cfg.sleep.regularityDays - 1));
  const bedtimes = nights.filter((n) => n.day >= regularityFrom && n.bedtimeMinutes !== null).map((n) => n.bedtimeMinutes as number);

  const level: RecoveryLevel = score.score !== null ? 'C' : sleepMinutes !== null && tonight?.restingHr != null ? 'B' : 'A';
  const quality: RecoveryQuality =
    score.score === null ? 'insufficient' : sleepMinutes !== null && score.baselineNights >= cfg.baselineDays ? 'good' : 'partial';

  const contributors: Contributor[] =
    score.score === null || score.zHrv === null || score.zRhr === null
      ? []
      : [
          { key: 'hrv', value: round2(score.zHrv), weight: cfg.hrvWeight },
          { key: 'resting_hr', value: round2(score.zRhr), weight: cfg.rhrWeight },
          { key: 'sleep', value: score.sleepFactor, weight: null },
        ];

  const keys: RecoveryExplanationKey[] = [...exertionToday.explanationKeys];
  if (sleepMinutes !== null && sleepMinutes < cfg.levelB.shortSleepHours * 60) keys.push('sleep_short');
  if (need.debtMinutes > 0) keys.push('sleep_debt');
  if (score.excludedOutliers > 0) keys.push('baseline_outliers_excluded');
  if (level === 'B') keys.push('level_b_absolute_thresholds');

  const summary: RecoveryDaySummary = {
    day: input.today,
    level,
    recovery: score.score,
    abstainReason: score.reason,
    quality,
    exertion: exertionToday.value,
    exertionPrevDay: exertionPrev.value,
    sleepMinutes,
    sleepNeedMinutes: need.needMinutes,
    sleepScore,
    bedtimeSigmaMinutes: bedtimeRegularity(bedtimes),
    targetZone: targetZone(score.score),
    hrvMs: tonight?.hrvMs ?? null,
    restingHr: tonight?.restingHr ?? null,
    learningNights: score.baselineNights,
    contributors,
    explanationKeys: keys,
    computedAt: input.now,
  };
  const muscles = muscleRecovery({ workouts: input.workouts, now: input.now }).map((r) => ({ day: input.today, ...r }));
  return { summary, muscles };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
