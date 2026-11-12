import { sdOf } from './baseline';
import { RECOVERY_CONFIG } from './config';

export interface SleepNeed {
  readonly baseMinutes: number;
  readonly exertionMinutes: number;
  readonly debtMinutes: number;
  readonly needMinutes: number;
}

/**
 * Apport d'une nuit à la dette (D-130, décision d'Ali du 12/11/2026, compensation partielle) : nuit courte = + (7 h 30 − dormi) ;
 * nuit longue = − min(dormi − 7 h 30, `surplusCreditCapMinutes`) ; nuit de 7 h 30 pile = 0.
 */
export function nightDebtMinutes(asleepMinutes: number, baseMinutes: number): number {
  return asleepMinutes < baseMinutes ? baseMinutes - asleepMinutes : -Math.min(asleepMinutes - baseMinutes, RECOVERY_CONFIG.sleep.surplusCreditCapMinutes);
}

/**
 * Besoin de sommeil (§ 16.3) : 7 h 30 + 0,2 h × max(0, Exertion veille − 5) + dette.
 * Dette (D-130, compensation partielle) : somme, sur les nuits valides CONNUES des 7 jours avant aujourd'hui, de `nightDebtMinutes`
 * (une nuit longue ne rembourse qu'1 h au plus), bornée à [0, 3 h] ; une nuit absente n'ajoute rien (jamais un faux zéro de sommeil).
 * `previousAsleepMinutes` : de la plus ancienne à la plus récente (l'ordre ne change pas la somme).
 */
export function sleepNeed(input: { readonly exertionPrevDay: number; readonly previousAsleepMinutes: readonly number[] }): SleepNeed {
  const cfg = RECOVERY_CONFIG.sleep;
  const baseMinutes = Math.round(cfg.baseSleepHours * 60);
  const exertionMinutes = Math.round(cfg.hoursPerExertionPoint * 60 * Math.max(0, input.exertionPrevDay - cfg.exertionBaseline));
  const net = input.previousAsleepMinutes.slice(-cfg.debtDays).reduce((s, m) => s + nightDebtMinutes(m, baseMinutes), 0);
  const debtMinutes = Math.min(Math.round(cfg.debtCapHours * 60), Math.max(0, net));
  return { baseMinutes, exertionMinutes, debtMinutes, needMinutes: baseMinutes + exertionMinutes + debtMinutes };
}

const DAY = 1440;

/** Minutes depuis midi de la veille : 23 h → 1380, 1 h → 1500 (un coucher après minuit ne casse pas l'écart-type). */
export const shiftedBedtime = (minutes: number): number => (minutes < DAY / 2 ? minutes + DAY : minutes);

/** Régularité du coucher : σ (minutes) des couchers donnés ; null sous `regularityMinNights` valeurs. */
export function bedtimeRegularity(bedtimeMinutes: readonly number[]): number | null {
  if (bedtimeMinutes.length < RECOVERY_CONFIG.sleep.regularityMinNights) return null;
  return sdOf(bedtimeMinutes.map(shiftedBedtime));
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** Heure de coucher cible (§ 16.7) : besoin − médiane de l'heure de lever (14 j) ; null avec raison sous 7 levers connus. */
export function bedtimeTarget(input: {
  readonly needMinutes: number;
  readonly wakeMinutes: readonly number[];
}): { readonly time: string | null; readonly reason: 'wake_history_incomplete' | null } {
  const cfg = RECOVERY_CONFIG.bedtime;
  const wakes = input.wakeMinutes.filter((m) => Number.isFinite(m)).slice(-cfg.wakeDays);
  if (wakes.length < cfg.minWakeNights || !Number.isFinite(input.needMinutes)) return { time: null, reason: 'wake_history_incomplete' };
  const target = Math.round((((median(wakes) - input.needMinutes) % DAY) + DAY) % DAY) % DAY;
  const hh = String(Math.floor(target / 60)).padStart(2, '0');
  const mm = String(target % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, reason: null };
}

/** Nuits de la dette (FIX-0115) : fenêtre de `debtDays` jours avant `today` (aujourd'hui exclu) ; `valid` = minutes dormies des nuits d'au moins `validNightMinAsleepMinutes`. Source unique du résumé du jour et du diagnostic. */
export function debtNights<N extends { readonly day: string; readonly asleepMinutes: number | null }>(nights: readonly N[], today: string): { readonly window: readonly N[]; readonly valid: readonly number[] } {
  const cfg = RECOVERY_CONFIG;
  const from = new Date(Date.parse(`${today}T12:00:00Z`) - cfg.sleep.debtDays * 86_400_000).toISOString().slice(0, 10);
  const window = nights.filter((n) => n.day >= from && n.day < today);
  return { window, valid: window.flatMap((n) => (n.asleepMinutes !== null && n.asleepMinutes >= cfg.validNightMinAsleepMinutes ? [n.asleepMinutes] : [])) };
}

export interface SleepDebtDiagnostic {
  /** Nuits comptées dans la dette (sur `debtDays` jours, hors aujourd'hui). */
  readonly retained: number;
  /** Nuits de la fenêtre sans sommeil mesuré. */
  readonly excludedNoAsleep: number;
  /** Nuits de la fenêtre sous `validNightMinAsleepMinutes` : jamais une dette. */
  readonly excludedShort: number;
}

/**
 * Diagnostic de la dette (FIX-0115) : mêmes nuits que `summarizeRecoveryDay` (fenêtre de `debtDays` jours avant `today`, nuits valides seules),
 * avec le décompte des nuits écartées par raison. Des compteurs seulement (§ 22) : ni durée de nuit, ni date, ni dette.
 */
export function sleepDebtDiagnostic(nights: readonly { readonly day: string; readonly asleepMinutes: number | null }[], today: string): SleepDebtDiagnostic {
  const { window, valid } = debtNights(nights, today);
  const noAsleep = window.filter((n) => n.asleepMinutes === null).length;
  return { retained: valid.length, excludedNoAsleep: noAsleep, excludedShort: window.length - valid.length - noAsleep };
}
