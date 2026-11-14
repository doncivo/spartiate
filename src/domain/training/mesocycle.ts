import { isLocalDate, type LocalDate } from '../types';
import type { GenerationConfig } from './config';
import type { GenerationWeek } from './generationTypes';
import { daysBetween, isLightWeekOn, openPause, pausedDaysUntil } from './programPause';

/**
 * Mésocycle (PRD § 12.2, § 12.5 ; I3-02 ; D-73 points 3 et 8 ; choix prudents consignés dans docs/I3-02.md). Module pur, sans horloge : la
 * date locale du jour est fournie ; aucune fonction ne modifie son entrée.
 *
 * - Durée : 4 à 7 semaines (défaut `mesoWeeks` = 5), la dernière est le deload ; illimité : blocs roulants de `unlimitedBlockWeeks` semaines,
 *   deload en fin de bloc, jamais terminé.
 * - Semaines de travail : la ligne de la routine vaut la semaine 2 du § 12.5 ; l'écart de séries monte de −1 à +1 (`mesoSetsOffsetRange`,
 *   arrondi au plus proche : jamais plus d'une série de plus d'une semaine à l'autre) et le RIR descend de `rirStart` à `rirEnd` (arrondi en
 *   dessous, jamais sous `rirEnd`, donc jamais 0 par défaut). Pour 5 semaines : −1 / 0 / 0 / +1, RIR 3 / 2 / 1 / 1 (tableau du § 12.5).
 * - Deload : volume de la routine ; la proposition de chaque exercice applique le deload I2 (séries ÷ 2, charge × 0,8, RIR ≥ 4, D-72 point 9).
 * - Deload anticipé : proposé, jamais déclenché seul ; la semaine courante devient le deload (illimité : le bloc suivant commence après).
 * - Semaine allégée (reprise après plus de 21 jours, programPause.ts) : séries et RIR de la semaine 1, sans priorité.
 * - Rotation Varied : `rotationIndex` + index du bloc.
 */

export const MESOCYCLE_STATUSES = ['active', 'completed'] as const;
export const MESOCYCLE_OUTCOMES = ['repeat', 'regenerate', 'change', 'stopped'] as const;
export type MesocycleStatus = (typeof MESOCYCLE_STATUSES)[number];
export type MesocycleOutcome = (typeof MESOCYCLE_OUTCOMES)[number];

/** Pause : `from` compris, `to` (jour de la reprise) exclu, `null` tant qu'elle dure ; `lightWeek` : semaine allégée acceptée à la reprise. */
export interface MesocyclePause {
  readonly from: LocalDate;
  readonly to: LocalDate | null;
  readonly lightWeek: boolean;
}

/** Valeurs d'un cycle (colonnes publiées de la table `mesocycle`, hors métadonnées). */
export interface MesocycleSpec {
  /** Routine suivie (référence logique). */
  readonly routineId: string;
  /** Premier jour de la semaine 1. */
  readonly startDate: LocalDate;
  /** Durée (4 à 7) ou longueur d'un bloc illimité. */
  readonly weeks: number;
  readonly unlimited: boolean;
  /** Semaine (effective, depuis le début) du deload anticipé ; `null` : deload planifié seulement. */
  readonly deloadWeek: number | null;
  /** Illimité : première semaine et index du bloc courant après un deload anticipé (1 et 0 sinon). */
  readonly blockOriginWeek: number;
  readonly blockOriginIndex: number;
  /** Rotation Varied du premier bloc (incrémentée par « Régénérer »). */
  readonly rotationIndex: number;
  readonly pauses: readonly MesocyclePause[];
  readonly status: MesocycleStatus;
  /** Issue du bilan (cycle clos) ; `null` tant qu'il est actif. */
  readonly outcome: MesocycleOutcome | null;
  readonly endedOn: LocalDate | null;
  /** PROG-01 (D-267 (3)) : durée choisie pendant le cycle, appliquée au cycle suivant (`null` : même durée). */
  readonly nextWeeks?: number | null;
  /** PROG-01 (D-267 (4)) : semaine de reprise (semaine 1, −1 série sur les lignes à 4 séries ou plus). */
  readonly rampUp?: boolean;
  /** Faux : ligne reçue illisible (repository) ; le cycle est alors invalide, jamais suivi en silence. */
  readonly readable?: boolean;
}

export type WeekKind = 'work' | 'deload' | 'light';
export type MesocyclePhase = 'not-started' | 'active' | 'paused' | 'finished' | 'completed' | 'invalid';

/** Plan d'une semaine pour une ligne de routine : écart de séries, RIR, deload, séries de priorité. */
export interface WeekPlan {
  readonly setsOffset: number;
  /** RIR visé par le moteur (borne haute d'une plage, D-269 (3)). */
  readonly rir: number;
  readonly deload: boolean;
  readonly priorityBonus: number;
  /** PROG-01 (cycles de 4 et 6 semaines) : borne basse de la plage affichée (« RIR 2-3 ») ; absente : RIR unique. */
  readonly rirLow?: number;
  /** PROG-01 : RIR des exercices d'isolation (dernière semaine de travail, à partir du 2e cycle). */
  readonly isolationRir?: number;
  /** PROG-01 : semaine de reprise (−1 série sur les lignes à 4 séries ou plus). */
  readonly rampUp?: boolean;
  /** PROG-01 : décharge d'un cycle de 4 ou 6 semaines : séries et facteur de charge (absents : deload I2, D-72 point 9). */
  readonly deloadSets?: number;
  readonly deloadLoad?: number;
}

/** PROG-01 (D-267, D-269) : plages de RIR [basse, haute] des semaines de travail, cycles de 4 et 6 semaines ; 5 et 7 : table d'avant. */
const PROGRAM_RIR: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  4: [[3, 3], [2, 3], [2, 2]],
  6: [[3, 3], [3, 3], [2, 3], [2, 2], [1, 2]],
};
/** Durées proposées à l'écran (D-267) ; 7 reste lisible pour un cycle existant. */
export const MESO_WEEK_CHOICES = [4, 5, 6] as const;
const RAMP_UP_MIN_SETS = 4;
const ISOLATION_LAST_WEEK_RIR = 1;
const PROGRAM_DELOAD_SETS = 2;
const PROGRAM_DELOAD_LOAD = 0.9;
const PROGRAM_DELOAD_RIR: readonly [number, number] = [3, 4];

/** Plan d'une semaine de travail d'un cycle de 4 ou 6 semaines (`index` 0 = première) ; `second` : au moins un cycle clos avant celui-ci. */
function programWorkPlan(index: number, table: readonly (readonly [number, number])[], config: GenerationConfig, second: boolean): WeekPlan {
  const i = Math.min(table.length - 1, Math.max(0, index));
  const [low, high] = table[i] as readonly [number, number];
  const last = i === table.length - 1;
  return {
    setsOffset: 0,
    rir: Math.max(1, high),
    deload: false,
    priorityBonus: config.prioritySetDelta,
    ...(low !== high ? { rirLow: Math.max(1, low) } : {}),
    ...(last && second ? { isolationRir: ISOLATION_LAST_WEEK_RIR } : {}),
  };
}
const programDeloadPlan = (): WeekPlan => ({
  setsOffset: 0,
  rir: PROGRAM_DELOAD_RIR[1],
  rirLow: PROGRAM_DELOAD_RIR[0],
  deload: true,
  priorityBonus: 0,
  deloadSets: PROGRAM_DELOAD_SETS,
  deloadLoad: PROGRAM_DELOAD_LOAD,
});

export interface MesocycleState {
  readonly phase: MesocyclePhase;
  /** Semaine effective depuis le début (jours en pause et semaine allégée retirés), à partir de 1. */
  readonly week: number;
  readonly blockIndex: number;
  /** Semaine dans le bloc (cycle fini : = `week`). */
  readonly blockWeek: number;
  readonly blockLength: number;
  /** Durée d'un cycle fini ; `null` en illimité. */
  readonly totalWeeks: number | null;
  readonly kind: WeekKind;
  readonly anticipated: boolean;
  /** Plan de la semaine ; `null` hors d'un cycle actif (pas commencé, en pause, terminé, clos, illisible). */
  readonly plan: WeekPlan | null;
  /** Rotation Varied (`mesocycleIndex` du générateur). */
  readonly mesocycleIndex: number;
  readonly pausedDays: number;
  readonly pausedSince: LocalDate | null;
  readonly canAnticipate: boolean;
}

const SETS_MAX = 20;
const ID_MAX = 128;
const isInt = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Plan de la semaine de travail `index` (0 = première) sur `workWeeks` semaines de travail. */
export function workWeekPlan(index: number, workWeeks: number, config: GenerationConfig): WeekPlan {
  const t = workWeeks <= 1 ? 1 : clamp(index, 0, workWeeks - 1) / (workWeeks - 1);
  const [lo, hi] = config.mesoSetsOffsetRange;
  const rir = Math.floor(config.rirStart - (config.rirStart - config.rirEnd) * t + 1e-9);
  return { setsOffset: lo + Math.round((hi - lo) * t), rir: Math.max(config.rirEnd, rir), deload: false, priorityBonus: config.prioritySetDelta };
}

const deloadPlan = (config: GenerationConfig): WeekPlan => ({ setsOffset: 0, rir: config.deloadWeekRir, deload: true, priorityBonus: 0 });

/** Séries d'une ligne de routine (`sets`) pour la semaine ; `priority` : groupe prioritaire, premier exercice du groupe. Bornées à 1–20. */
export function linePlanSets(sets: number, plan: WeekPlan, config: GenerationConfig, priority = false): number {
  const bonus = priority ? Math.min(plan.priorityBonus, config.prioritySetDelta) : 0;
  const rampCut = plan.rampUp === true && Math.round(sets) >= RAMP_UP_MIN_SETS ? 1 : 0;
  return clamp(Math.round(sets) + plan.setsOffset + bonus - rampCut, 1, SETS_MAX);
}

/** Le cycle est-il bien formé (domaine, repository et lecture d'une ligne reçue) ? */
export function validateMesocycleSpec(spec: MesocycleSpec, config: GenerationConfig): boolean {
  if (spec.readable === false) return false;
  if (typeof spec.routineId !== 'string' || spec.routineId.length < 1 || spec.routineId.length > ID_MAX) return false;
  if (typeof spec.startDate !== 'string' || !isLocalDate(spec.startDate) || typeof spec.unlimited !== 'boolean') return false;
  const [min, max] = config.mesoWeeksRange;
  if (spec.unlimited ? spec.weeks !== config.unlimitedBlockWeeks : !(isInt(spec.weeks, min) && spec.weeks <= max)) return false;
  if (spec.deloadWeek !== null && !(isInt(spec.deloadWeek, 1) && (spec.unlimited || spec.deloadWeek <= spec.weeks))) return false;
  if (!isInt(spec.blockOriginWeek, 1) || !isInt(spec.blockOriginIndex, 0) || !isInt(spec.rotationIndex, 0)) return false;
  if (!(MESOCYCLE_STATUSES as readonly string[]).includes(spec.status)) return false;
  if (spec.outcome !== null && !(MESOCYCLE_OUTCOMES as readonly string[]).includes(spec.outcome)) return false;
  const closed = spec.status === 'completed';
  if (closed !== (spec.outcome !== null) || closed !== (spec.endedOn !== null)) return false;
  if (spec.endedOn !== null && (typeof spec.endedOn !== 'string' || !isLocalDate(spec.endedOn))) return false;
  if (spec.nextWeeks !== undefined && spec.nextWeeks !== null && !(isInt(spec.nextWeeks, min) && spec.nextWeeks <= max)) return false;
  if (spec.rampUp !== undefined && typeof spec.rampUp !== 'boolean') return false;
  if (!Array.isArray(spec.pauses)) return false;
  let previousEnd: LocalDate = spec.startDate;
  for (const [i, p] of spec.pauses.entries()) {
    if (p === null || typeof p !== 'object' || typeof p.from !== 'string' || !isLocalDate(p.from) || typeof p.lightWeek !== 'boolean') return false;
    if (daysBetween(previousEnd, p.from) < 0) return false;
    if (p.to === null) {
      if (i !== spec.pauses.length - 1 || p.lightWeek) return false;
      continue;
    }
    if (typeof p.to !== 'string' || !isLocalDate(p.to) || daysBetween(p.from, p.to) < 0) return false;
    previousEnd = p.to;
  }
  return true;
}

export interface CreateMesocycleInput {
  readonly routineId: string;
  readonly startDate: LocalDate;
  readonly weeks: number | 'unlimited';
  readonly rotationIndex?: number;
  /** PROG-01 : semaine de reprise (désactivée par défaut). */
  readonly rampUp?: boolean;
}

/** Nouveau cycle actif ; `null` si la durée, la routine ou la date ne sont pas admises. */
export function createMesocycleSpec(input: CreateMesocycleInput, config: GenerationConfig): MesocycleSpec | null {
  const unlimited = input.weeks === 'unlimited';
  const spec: MesocycleSpec = {
    routineId: input.routineId,
    startDate: input.startDate,
    weeks: unlimited ? config.unlimitedBlockWeeks : (input.weeks as number),
    unlimited,
    deloadWeek: null,
    blockOriginWeek: 1,
    blockOriginIndex: 0,
    rotationIndex: input.rotationIndex ?? 0,
    nextWeeks: null,
    rampUp: input.rampUp === true,
    pauses: [],
    status: 'active',
    outcome: null,
    endedOn: null,
  };
  return validateMesocycleSpec(spec, config) ? spec : null;
}

const INVALID: MesocycleState = Object.freeze({
  phase: 'invalid',
  week: 0,
  blockIndex: 0,
  blockWeek: 0,
  blockLength: 0,
  totalWeeks: null,
  kind: 'work',
  anticipated: false,
  plan: null,
  mesocycleIndex: 0,
  pausedDays: 0,
  pausedSince: null,
  canAnticipate: false,
});

/** État du cycle à la date `today`. */
/** `options.closedBefore` (PROG-01) : nombre de cycles clos avant le début de celui-ci (RIR 1 sur l'isolation à partir du 2e cycle). */
export function mesocycleState(spec: MesocycleSpec, today: LocalDate, config: GenerationConfig, options?: { readonly closedBefore?: number }): MesocycleState {
  if (!validateMesocycleSpec(spec, config) || typeof today !== 'string' || !isLocalDate(today)) return INVALID;
  const L = spec.weeks;
  const pausedDays = pausedDaysUntil(spec.pauses, today, config.lightWeekDays);
  const elapsed = daysBetween(spec.startDate, today);
  const week = Math.floor(Math.max(0, elapsed - pausedDays) / 7) + 1;
  const open = openPause(spec.pauses);
  const pausedSince = open !== null && daysBetween(open.from, today) >= 0 ? open.from : null;

  let blockIndex = 0;
  let blockWeek = week;
  let kind: WeekKind = 'work';
  let anticipated = false;
  let finished = false;
  if (!spec.unlimited) {
    const deloadAt = spec.deloadWeek ?? L;
    anticipated = spec.deloadWeek !== null && spec.deloadWeek < L;
    finished = week > deloadAt;
    if (week === deloadAt) kind = 'deload';
  } else if (week >= spec.blockOriginWeek) {
    const rel = week - spec.blockOriginWeek;
    blockIndex = spec.blockOriginIndex + Math.floor(rel / L);
    blockWeek = (rel % L) + 1;
    if (blockWeek === L) kind = 'deload';
  } else if (spec.deloadWeek === week) {
    blockIndex = Math.max(0, spec.blockOriginIndex - 1);
    blockWeek = L;
    kind = 'deload';
    anticipated = true;
  } else {
    blockIndex = Math.floor((week - 1) / L);
    blockWeek = ((week - 1) % L) + 1;
    if (blockWeek === L) kind = 'deload';
  }
  if (isLightWeekOn(spec.pauses, today, config.lightWeekDays)) kind = 'light';

  const phase: MesocyclePhase =
    spec.status === 'completed' ? 'completed' : elapsed < 0 ? 'not-started' : pausedSince !== null ? 'paused' : finished ? 'finished' : 'active';
  // PROG-01 (D-267, D-269) : cycles de 4 et 6 semaines ; semaine allégée après une pause = semaine 1 avec l'allègement de la reprise.
  const table = spec.unlimited ? undefined : PROGRAM_RIR[L];
  const second = (options?.closedBefore ?? 0) > 0;
  const rampUp = spec.rampUp === true;
  let plan: WeekPlan | null = null;
  if (phase === 'active' && table !== undefined) {
    if (kind === 'deload') plan = programDeloadPlan();
    else if (kind === 'light') plan = { ...programWorkPlan(0, table, config, second), priorityBonus: 0, rampUp: true };
    else plan = { ...programWorkPlan(blockWeek - 1, table, config, second), ...(rampUp && blockWeek === 1 ? { rampUp: true } : {}) };
  } else if (phase === 'active') {
    plan = kind === 'deload' ? deloadPlan(config) : kind === 'light' ? { ...workWeekPlan(0, L - 1, config), priorityBonus: 0 } : workWeekPlan(blockWeek - 1, L - 1, config);
  }
  const canAnticipate = phase === 'active' && kind === 'work' && (spec.unlimited || spec.deloadWeek === null);
  return {
    phase,
    week,
    blockIndex,
    blockWeek,
    blockLength: L,
    totalWeeks: spec.unlimited ? null : L,
    kind,
    anticipated,
    plan,
    mesocycleIndex: spec.rotationIndex + blockIndex,
    pausedDays,
    pausedSince,
    canAnticipate,
  };
}

/** Semaine du générateur (interface I3-01) ; `null` hors d'un cycle actif : la routine s'applique telle quelle. */
export function generationWeekOf(state: MesocycleState): GenerationWeek | null {
  if (state.phase !== 'active' || state.plan === null) return null;
  const { setsOffset, rir, deload, priorityBonus, isolationRir, rampUp, deloadSets, deloadLoad } = state.plan;
  return {
    workingSets: null,
    rir,
    setsOffset,
    deload,
    priorityBonus,
    ...(isolationRir !== undefined ? { isolationRir } : {}),
    ...(rampUp === true ? { rampUp } : {}),
    ...(deloadSets !== undefined ? { deloadSets } : {}),
    ...(deloadLoad !== undefined ? { deloadLoad } : {}),
  };
}

/** Le jour est-il en semaine de deload (planifié ou anticipé) d'un cycle actif ? */
export const isDeloadOn = (spec: MesocycleSpec, date: LocalDate, config: GenerationConfig): boolean => {
  const s = mesocycleState(spec, date, config);
  return s.phase === 'active' && s.kind === 'deload';
};

/** Deload anticipé accepté par Ali à `today` ; `null` s'il n'est pas proposable (hors semaine de travail, déjà anticipé, cycle inactif). */
export function anticipateDeload(spec: MesocycleSpec, today: LocalDate, config: GenerationConfig): MesocycleSpec | null {
  const s = mesocycleState(spec, today, config);
  if (!s.canAnticipate) return null;
  return spec.unlimited ? { ...spec, deloadWeek: s.week, blockOriginWeek: s.week + 1, blockOriginIndex: s.blockIndex + 1 } : { ...spec, deloadWeek: s.week };
}

/** Cycle clos à `today` avec l'issue du bilan ; une pause en cours se termine le même jour. Rien n'est effacé. */
export function closeMesocycle(spec: MesocycleSpec, outcome: MesocycleOutcome, today: LocalDate): MesocycleSpec {
  const pauses = spec.pauses.map((p) => (p.to === null ? { ...p, to: daysBetween(p.from, today) >= 0 ? today : p.from } : p));
  return { ...spec, pauses, status: 'completed', outcome, endedOn: today };
}

/**
 * Cycle suivant du bilan (critère 5), qui commence à `today` en semaine 1 : répéter (même routine, même rotation), régénérer (rotation
 * suivante), changer (`change.routineId` obligatoire, durée au choix). Les charges viennent du moteur (1RM à jour).
 */
export function nextMesocycleSpec(
  previous: MesocycleSpec,
  outcome: Exclude<MesocycleOutcome, 'stopped'>,
  today: LocalDate,
  config: GenerationConfig,
  change?: { readonly routineId: string; readonly weeks?: number | 'unlimited' },
): MesocycleSpec | null {
  // PROG-01 (D-267 (3)) : une durée choisie pendant le cycle s'applique au suivant ; la semaine de reprise ne se reprend jamais.
  const sameWeeks = previous.unlimited ? 'unlimited' : (previous.nextWeeks ?? previous.weeks);
  if (outcome === 'change') {
    if (change === undefined) return null;
    return createMesocycleSpec({ routineId: change.routineId, startDate: today, weeks: change.weeks ?? sameWeeks }, config);
  }
  const state = mesocycleState(previous, today, config);
  const current = state.phase === 'invalid' ? previous.rotationIndex : state.mesocycleIndex;
  return createMesocycleSpec({ routineId: previous.routineId, startDate: today, weeks: sameWeeks, rotationIndex: outcome === 'regenerate' ? current + 1 : current }, config);
}

/** PROG-01 (D-267 (3)) : durée du cycle suivant choisie pendant le cycle (4, 5 ou 6) ; le cycle en cours ne change pas. `null` si refusée. */
export function changeNextWeeks(spec: MesocycleSpec, weeks: number, config: GenerationConfig): MesocycleSpec | null {
  if (!(MESO_WEEK_CHOICES as readonly number[]).includes(weeks)) return null;
  const next = { ...spec, nextWeeks: weeks };
  return validateMesocycleSpec(next, config) ? next : null;
}
