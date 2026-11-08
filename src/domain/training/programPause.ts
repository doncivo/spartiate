import { isLocalDate, type LocalDate } from '../types';
import type { GenerationConfig } from './config';
import type { MesocyclePause, MesocycleSpec } from './mesocycle';

/**
 * Pause et reprise du programme (PRD § 12.6 ; I3-02 ; D-73 point 9). Module pur, sans horloge : la date locale du jour est fournie.
 *
 * - Une pause va du jour où Ali la demande (`from`, compris) au jour de la reprise (`to`, exclu, ou `null` tant qu'elle dure). Ces jours ne
 *   comptent pas pour le cycle (décalage d'autant), ne sont pas des jours manqués (streak gelé, § 17.1) et n'ouvrent aucune notification de
 *   séance.
 * - Reprise après plus de `lightWeekAfterDays` jours (strictement) : une semaine allégée est PROPOSÉE ; acceptée, elle s'insère pendant
 *   `lightWeekDays` jours à partir de la reprise (le cycle reste figé, puis repart à la semaine où il s'était arrêté), avec les séries et le
 *   RIR de la semaine 1 (mesocycle.ts) ; ces jours-là sont des jours d'entraînement ordinaires (comptés). Les charges suivent le détraînement
 *   du § 11 déjà appliqué par le moteur (D-72 point 10).
 * - Les fonctions ne modifient jamais leur entrée.
 */

const DAY_MS = 86_400_000;
const utc = (date: LocalDate): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
/** Jours de `from` à `to` (négatif si `to` précède `from`). */
export const daysBetween = (from: LocalDate, to: LocalDate): number => Math.round((utc(to) - utc(from)) / DAY_MS);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Pause en cours (la dernière, sans fin), sinon `null`. */
export const openPause = (pauses: readonly MesocyclePause[]): MesocyclePause | null => {
  const last = pauses.at(-1);
  return last !== undefined && last.to === null ? last : null;
};

/** Le jour est-il dans une pause ? */
export const isPausedOn = (pauses: readonly MesocyclePause[], date: LocalDate): boolean =>
  pauses.some((p) => daysBetween(p.from, date) >= 0 && (p.to === null || daysBetween(date, p.to) > 0));

/** Le jour est-il dans une semaine allégée acceptée ? */
export function isLightWeekOn(pauses: readonly MesocyclePause[], date: LocalDate, lightWeekDays = 7): boolean {
  return pauses.some((p, i) => {
    if (!p.lightWeek || p.to === null) return false;
    const next = pauses[i + 1];
    // Une nouvelle pause pendant la semaine allégée l'interrompt.
    return daysBetween(p.to, date) >= 0 && daysBetween(p.to, date) < lightWeekDays && (next === undefined || daysBetween(date, next.from) > 0);
  });
}

/** Jours retirés du cycle jusqu'à `today` (exclu) : jours en pause et jours de semaine allégée déjà écoulés. */
export function pausedDaysUntil(pauses: readonly MesocyclePause[], today: LocalDate, lightWeekDays = 7): number {
  let total = 0;
  for (const [i, p] of pauses.entries()) {
    const end = p.to === null || daysBetween(p.to, today) < 0 ? today : p.to;
    total += Math.max(0, daysBetween(p.from, end));
    if (p.lightWeek && p.to !== null) {
      const next = pauses[i + 1];
      const stop = next !== undefined && daysBetween(next.from, today) > 0 ? next.from : today;
      total += clamp(daysBetween(p.to, stop), 0, lightWeekDays);
    }
  }
  return total;
}

/** Streak (§ 17.1) : un jour sans séance compte comme manqué, sauf en pause. */
export const countsAsMissedDay = (pauses: readonly MesocyclePause[], date: LocalDate): boolean => !isPausedOn(pauses, date);

/** Aucune notification de séance pendant une pause (§ 12.6) ; un cycle clos n'en appelle aucune non plus. */
export const sessionNotificationsAllowed = (cycle: MesocycleSpec, date: LocalDate): boolean => cycle.status === 'active' && !isPausedOn(cycle.pauses, date);

/** Met le programme en pause à `today` ; `null` si déjà en pause, cycle clos ou jour antérieur au début ou à la dernière reprise. */
export function pauseProgram(cycle: MesocycleSpec, today: LocalDate): MesocycleSpec | null {
  if (cycle.status !== 'active' || !isLocalDate(today) || daysBetween(cycle.startDate, today) < 0 || openPause(cycle.pauses) !== null) return null;
  const last = cycle.pauses.at(-1);
  if (last?.to != null && daysBetween(last.to, today) < 0) return null;
  return { ...cycle, pauses: [...cycle.pauses, { from: today, to: null, lightWeek: false }] };
}

/** Durée de la pause en cours à `today` et semaine allégée proposée ; `null` hors pause ou si `today` précède la pause. */
export function resumeProposal(cycle: MesocycleSpec, today: LocalDate, config: GenerationConfig): { readonly pausedDays: number; readonly lightWeekProposed: boolean } | null {
  const open = openPause(cycle.pauses);
  if (open === null || !isLocalDate(today)) return null;
  const pausedDays = daysBetween(open.from, today);
  if (pausedDays < 0) return null;
  return { pausedDays, lightWeekProposed: pausedDays > config.lightWeekAfterDays };
}

/** Reprend le programme à `today` ; la semaine allégée n'est insérée que si elle est proposée ET acceptée. */
export function resumeProgram(cycle: MesocycleSpec, today: LocalDate, acceptLightWeek: boolean, config: GenerationConfig): MesocycleSpec | null {
  const proposal = resumeProposal(cycle, today, config);
  if (proposal === null || cycle.status !== 'active') return null;
  const pauses = cycle.pauses.map((p, i) => (i === cycle.pauses.length - 1 ? { from: p.from, to: today, lightWeek: proposal.lightWeekProposed && acceptLightWeek } : p));
  return { ...cycle, pauses };
}
