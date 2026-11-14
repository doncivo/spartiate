import type { ProgressionConfig } from './config';
import type { SessionEstimate } from './estimate1rm';
import { snapToEquipment } from './loadGrid';
import type { ExerciseKind, ProposalOption, RecoverySnapshot } from './types';

/**
 * Contraintes de la prescription (PRD § 11.2 point 6, § 11.3, § 11.5 ; I2-02 ; D-72 points 7 à 10, qui priment). Module pur. Elles
 * maintiennent ou réduisent, jamais de bonus ; les choix (fatigue, stagnation) sont présentés, jamais appliqués d'office.
 *
 * - Fatigue : la dernière séance valide comparée à la dernière séance valide antérieure faite à la MÊME charge (charge maximale de chaque
 *   séance) ; baisse des répétitions, sur les séries communes, strictement au-delà de 20 % → maintien et deux choix (−5 % ou −2 reps).
 *   I4-08 : une séance où l'un de ces choix a été retenu (`fatigueChoice`) n'est jamais comparée ni base de comparaison.
 * - Stagnation : 3 séances valides de suite sans progrès sur la précédente (4 séances valides) → trois choix (variante, autre plage,
 *   mini-deload −10 %). Une séance ignorée (moins de 50 % faite) ou un jour sans séance n'est ni un progrès ni une régression.
 * - Inactivité : à partir de 14 jours sans le muscle, −1 % par semaine complète au-delà du seuil (première décote à J21), plancher −10 %.
 * - Deload manuel : séries ÷ 2 arrondi en dessous (au moins une), charge × 0,8, RIR cible ≥ 4 ; la séance retenue sort des statistiques.
 * - Récupération : Recovery ≤ 33, sommeil < 6 h ou FC repos > +8 % → charge × 0,95 et une série de moins sur un exercice secondaire.
 *   Journée rouge acceptée par Ali (`redDay`, D-93 révisée par Ali le 12/11, D-170) : charges × 0,95 (`lowRecoveryLoad`), séries et
 *   répétitions de la référence inchangées (aucune série retirée) ; arrondi au matériel vers le bas par l'appelant (`snapDownAtLeastMin`) ;
 *   exercice assisté : l'assistance n'est jamais réduite (la séance ne devient pas plus dure).
 *   Snapshot absent ou champ nul : aucune modulation, aucune valeur inventée.
 */

const EPS = 1e-9;
const DAY_MS = 86_400_000;

/** Performance d'une séance à charge égale : charge maximale et répétitions des séries faites à cette charge, par position. */
export interface Performance {
  readonly loadKg: number;
  readonly reps: readonly number[];
}

export function performanceOf(estimate: SessionEstimate): Performance {
  const loadKg = Math.max(...estimate.sets.map((s) => s.loadKg));
  return { loadKg, reps: estimate.sets.filter((s) => s.loadKg === loadKg).map((s) => s.reps) };
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Baisse relative des répétitions sur les séries communes (les premières) ; 0 sans série commune ou sans baisse. */
export function repsDrop(previous: readonly number[], latest: readonly number[]): number {
  const k = Math.min(previous.length, latest.length);
  const before = sum(previous.slice(0, k));
  if (k === 0 || before <= 0) return 0;
  return Math.max(0, (before - sum(latest.slice(0, k))) / before);
}

/** Progrès : charge plus haute, ou même charge et plus de répétitions sur les séries communes. */
export function progressed(latest: Performance, previous: Performance): boolean {
  if (latest.loadKg > previous.loadKg + EPS) return true;
  if (Math.abs(latest.loadKg - previous.loadKg) > EPS) return false;
  const k = Math.min(latest.reps.length, previous.reps.length);
  return sum(latest.reps.slice(0, k)) > sum(previous.reps.slice(0, k));
}

/** Fatigue : la dernière séance comparée à la dernière séance antérieure à même charge (`estimates` de la plus récente à la plus ancienne). */
export function isFatigued(estimates: readonly SessionEstimate[], config: ProgressionConfig): boolean {
  const [last, ...earlier] = estimates;
  // I4-08 : une séance où Ali a retenu un choix de fatigue (−5 % ou −2 reps) a baissé volontairement : ni comparée, ni base de comparaison.
  if (last === undefined || last.fatigueChoice === true) return false;
  const latest = performanceOf(last);
  const comparable = earlier
    .filter((e) => e.fatigueChoice !== true)
    .map(performanceOf).find((p) => Math.abs(p.loadKg - latest.loadKg) <= EPS);
  return comparable !== undefined && repsDrop(comparable.reps, latest.reps) > config.fatigueDrop + EPS;
}

export function isStalled(estimates: readonly SessionEstimate[], config: ProgressionConfig): boolean {
  const n = config.stallSessions;
  if (estimates.length < n + 1) return false;
  const perf = estimates.slice(0, n + 1).map(performanceOf);
  for (let i = 0; i < n; i += 1) if (progressed(perf[i] as Performance, perf[i + 1] as Performance)) return false;
  return true;
}

/** Décote d'inactivité (fraction) après `daysOff` jours sans le muscle : semaines complètes au-delà du seuil, plafonnées au plancher. */
export function inactivityCut(daysOff: number, config: ProgressionConfig): number {
  if (!(daysOff >= config.detrainStartDays)) return 0;
  const weeks = Math.floor((daysOff - config.detrainStartDays) / 7 + EPS);
  return Math.min(config.detrainFloor, Math.round(weeks * config.detrainWeeklyCut * 1e6) / 1e6);
}

export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / DAY_MS;
}

/** Séries de deload : moitié arrondie en dessous, au moins une (D-72 point 9). */
export const deloadSetCount = (sets: number): number => Math.max(1, Math.floor(sets / 2));

/** Récupération basse si UNE donnée présente franchit son seuil ; une donnée nulle ne compte jamais. */
export function isLowRecovery(snapshot: RecoverySnapshot | null | undefined, config: ProgressionConfig): boolean {
  if (snapshot === null || snapshot === undefined) return false;
  const { recovery, sleepHours, restingHrDelta } = snapshot;
  return (
    (recovery !== null && Number.isFinite(recovery) && recovery <= config.lowRecovery) ||
    (sleepHours !== null && Number.isFinite(sleepHours) && sleepHours < config.lowSleepHours) ||
    (restingHrDelta !== null && Number.isFinite(restingHrDelta) && restingHrDelta > config.highRestingHrDelta + EPS)
  );
}

/** Contraintes actives pour une prescription avec référence. */
export interface ActiveConstraints {
  readonly fatigue: boolean;
  readonly stall: boolean;
  /** 0 : aucune décote. */
  readonly inactivityCut: number;
  readonly deload: boolean;
  readonly lowRecovery: boolean;
  /** Journée rouge acceptée (D-170) : charges × 0,95 sans série retirée, au lieu de la réduction générale de la récupération basse. */
  readonly redDay: boolean;
  /** PROG-01 (D-267) : décharge d'un cycle de 4 ou 6 semaines (séries, facteur de charge) ; absents : deload I2 (D-72 point 9). */
  readonly deloadSets?: number;
  readonly deloadLoad?: number;
}

export interface ConstraintContext {
  readonly estimates: readonly SessionEstimate[];
  readonly lastWorkedAt: string | null;
  readonly now: string;
  readonly deload: boolean;
  readonly recovery: RecoverySnapshot | null | undefined;
  readonly config: ProgressionConfig;
}

export function activeConstraints(ctx: ConstraintContext): ActiveConstraints {
  const { config } = ctx;
  return {
    fatigue: isFatigued(ctx.estimates, config),
    stall: isStalled(ctx.estimates, config),
    inactivityCut: ctx.lastWorkedAt === null ? 0 : inactivityCut(daysBetween(ctx.lastWorkedAt, ctx.now), config),
    deload: ctx.deload,
    lowRecovery: isLowRecovery(ctx.recovery, config),
    redDay: ctx.recovery?.redDay === true && isLowRecovery(ctx.recovery, config),
  };
}

/** Une contrainte qui maintient ou réduit : la progression (cran, échelle, recalibrage) est suspendue. */
export const reduces = (c: ActiveConstraints): boolean => c.fatigue || c.inactivityCut > 0 || c.deload || c.lowRecovery;

/** Proposition réduite : charge de référence × facteurs, séries réduites ; arrondie au matériel par l'appelant (`snapToEquipment`). */
export function reducedTarget(
  c: ActiveConstraints,
  reference: Performance,
  kind: ExerciseKind | undefined,
  config: ProgressionConfig,
  assisted = false,
): { readonly targetKg: number; readonly reps: readonly number[]; readonly recoverySetRemoved: boolean } {
  let sets = reference.reps.length;
  if (c.deload) sets = c.deloadSets !== undefined ? Math.max(1, Math.min(sets, c.deloadSets)) : deloadSetCount(sets);
  const beforeRecovery = sets;
  const recoveryCuts = c.lowRecovery && !c.redDay;
  if (recoveryCuts && kind === 'isolation') sets = Math.max(1, sets - 1);
  // Journée rouge (D-170) : même facteur, aucune série retirée ; assistance jamais réduite (la charge saisie est l'assistance).
  const redDayCuts = c.redDay && !assisted;
  // D-273 (constat 6 de Codex) : exercice assisté, la charge saisie est l'assistance ; la réduire alourdirait l'exercice : en décharge, elle est gardée.
  const deloadCut = c.deload && !assisted ? (c.deloadLoad ?? config.deloadLoad) : 1;
  const factor = (1 - c.inactivityCut) * deloadCut * (recoveryCuts || redDayCuts ? config.lowRecoveryLoad : 1);
  return { targetKg: reference.loadKg * factor, reps: reference.reps.slice(0, sets), recoverySetRemoved: sets < beforeRecovery };
}

/**
 * Choix facultatifs, dans l'ordre stable fatigue (charge, répétitions) puis stagnation (variante, plage, mini-deload). Base : la
 * proposition si elle est réduite, sinon la référence (un choix ne part jamais d'une hausse). Un choix qui ne réduit rien est omis.
 */
export function proposalOptions(c: ActiveConstraints, base: Performance, available: readonly number[] | null, config: ProgressionConfig): ProposalOption[] {
  const options: ProposalOption[] = [];
  const lighter = (cut: number): { loadKg: number; reps: readonly number[] } | null => {
    const snapped = snapToEquipment(base.loadKg * (1 - cut), base.reps, available, config);
    return snapped.loadKg < base.loadKg - EPS ? { loadKg: snapped.loadKg, reps: snapped.reps } : null;
  };
  if (c.fatigue) {
    const load = lighter(config.fatigueLoadCut);
    if (load !== null) options.push({ kind: 'fatigue-load', ...load });
    const reps = base.reps.map((r) => Math.max(1, r - config.fatigueRepsCut));
    if (reps.some((r, i) => r < (base.reps[i] ?? r))) options.push({ kind: 'fatigue-reps', loadKg: base.loadKg, reps });
  }
  if (c.stall) {
    options.push({ kind: 'stall-variant', loadKg: null, reps: null }, { kind: 'stall-range', loadKg: null, reps: null });
    const mini = lighter(config.miniDeloadCut);
    if (mini !== null) options.push({ kind: 'stall-mini-deload', ...mini });
  }
  return options;
}
