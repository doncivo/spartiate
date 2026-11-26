import type { Sex } from '../bodyProfile';
import type { WeighIn } from '../nutrition/types';
import type { IsoDateTime } from '../types';
import { currentBodyweightKg } from './bodyweight';
import {
  DEFAULT_PROGRESSION_CONFIG,
  STRENGTH_BODYWEIGHT_EXPONENT,
  STRENGTH_GROUPS,
  STRENGTH_LEVEL_SCORES,
  STRENGTH_LEVELS,
  STRENGTH_LIFT_THRESHOLDS,
  STRENGTH_NORMALIZED_BODYWEIGHT_KG,
  STRENGTH_SCORE_VERSION,
  type StrengthGroup,
  type StrengthLevel,
  type StrengthThresholds,
} from './config';
import { analyzeHistory, compareInstants, current1rmFromSessions, type BodyLoad } from './estimate1rm';
import type { ExerciseSession } from './types';

export { STRENGTH_GROUPS, type StrengthGroup, type StrengthLevel };

/**
 * Strength Score maison (PRD § 17.1 ; STR-0300, BL-174 ; D-675, D-741, D-742). Module pur, importé par l'écran à la demande (hors de
 * l'index du domaine).
 *
 * - e1RM d'un mouvement : celui du moteur de prescription (Epley, `analyzeHistory` puis `current1rmFromSessions`, § 11.3) ; tractions et
 *   dips (charge totale) : poids de corps + lest. Même clé sur plusieurs exercices : le meilleur e1RM.
 * - Force relative = e1RM × (80 / poids de corps)^(2/3) à la barre ; charge totale (tractions, dips) : e1RM × 80 / poids de corps, simple
 *   proportion (Q-42, D-744 : à une traction chacun, 100 kg et 60 kg de poids de corps sont à égalité). Sans poids de corps connu ni sexe : aucun score, jamais 0.
 * - Score 0–100 : interpolation linéaire entre deux seuils du mouvement pour le sexe (config.ts, repères 20, 40, 60, 80, 100), arrondi vers
 *   le bas pour rester dans le niveau atteint ; sous Débutant, de 0 kg à 20 points (au moins 1) ; au-delà d'Élite, 100.
 * - Groupe : meilleur score parmi ses mouvements chiffrés (à égalité, le premier des mouvements de référence) ; sinon « inconnu » avec sa
 *   raison. Global : moyenne des groupes connus, arrondie vers le bas, avec leur nombre ; null sans groupe connu.
 * - Figé en décharge (D-742) : si la séance la plus récente des mouvements de référence est une décharge, le poids de corps est lu sur les
 *   pesées d'avant la première séance de cette décharge (les séances de décharge n'entrent déjà pas dans l'e1RM).
 */

/** Mouvement de référence (content/strength/standards.json) : groupes chiffrés, charge totale (poids de corps + lest). */
export interface ReferenceLift {
  readonly key: string;
  readonly groups: readonly StrengthGroup[];
  readonly totalLoad: boolean;
}

/** Exercice du catalogue qui porte une `strengthStandardKey`, avec son historique clos. */
export interface StrengthExercise {
  readonly id: string;
  readonly nameFr: string;
  readonly key: string;
  readonly history: readonly ExerciseSession[];
}

export interface StrengthInput {
  readonly sex: Sex | null;
  readonly weighIns: readonly WeighIn[];
  readonly lifts: readonly ReferenceLift[];
  readonly exercises: readonly StrengthExercise[];
  /** Seuils par mouvement ; défaut : le tableau de config.ts (validé par Ali, Q-42, D-744). */
  readonly thresholds?: StrengthThresholds;
}

export interface LiftScore {
  readonly key: string;
  readonly exerciseId: string;
  readonly nameFr: string;
  readonly groups: readonly StrengthGroup[];
  readonly e1rmKg: number;
  readonly relativeKg: number;
  readonly score: number;
  readonly level: StrengthLevel;
}

export type UnknownReason = 'noSex' | 'noBodyweight' | 'noSession' | 'noReference';

export type GroupScore =
  | { readonly group: StrengthGroup; readonly kind: 'value'; readonly score: number; readonly level: StrengthLevel; readonly lift: LiftScore }
  | { readonly group: StrengthGroup; readonly kind: 'unknown'; readonly reason: UnknownReason; readonly references: readonly string[] };

export interface StrengthResult {
  readonly version: number;
  /** Poids de corps retenu (celui d'avant la décharge si figé) ; null : inconnu. */
  readonly bodyweightKg: number | null;
  /** Début de la décharge en cours qui fige le score ; null : pas figé. */
  readonly frozenSince: IsoDateTime | null;
  /** Vrai : le poids de corps retenu est celui d'avant la décharge ; faux : pas de décharge, ou aucune pesée d'avant (poids courant). */
  readonly bodyweightFrozen: boolean;
  readonly lifts: readonly LiftScore[];
  readonly groups: readonly GroupScore[];
  readonly global: { readonly score: number; readonly level: StrengthLevel; readonly counted: number } | null;
}

/** Force relative : barre, e1RM × (80 / poids de corps)^(2/3) ; charge totale (tractions, dips), e1RM × 80 / poids de corps (Q-42, D-744). */
export const relativeStrength = (e1rmKg: number, bodyweightKg: number, totalLoad = false): number =>
  e1rmKg * (STRENGTH_NORMALIZED_BODYWEIGHT_KG / bodyweightKg) ** (totalLoad ? 1 : STRENGTH_BODYWEIGHT_EXPONENT);

/** Niveau d'un score : la bande de repères atteinte (< 40 Débutant … 100 Élite). */
export function levelOfScore(score: number): StrengthLevel {
  let level: StrengthLevel = 'beginner';
  STRENGTH_LEVELS.forEach((l, i) => {
    if (score >= (STRENGTH_LEVEL_SCORES[i] as number) && i > 0) level = l;
  });
  return level;
}

/** Score 0–100 et niveau d'une force relative face aux 5 seuils croissants d'un mouvement. */
export function scoreFromThresholds(relativeKg: number, thresholds: readonly number[]): { readonly score: number; readonly level: StrengthLevel } {
  const first = thresholds[0];
  const last = thresholds[thresholds.length - 1];
  const increasing = thresholds.every((v, i) => Number.isFinite(v) && v > 0 && (i === 0 || v > (thresholds[i - 1] as number)));
  if (first === undefined || last === undefined || thresholds.length !== STRENGTH_LEVELS.length || !increasing) throw new Error('seuils : 5 valeurs finies, positives, strictement croissantes attendues');
  if (!Number.isFinite(relativeKg)) throw new Error('force relative non finie');
  const firstScore = STRENGTH_LEVEL_SCORES[0];
  if (relativeKg >= last) return { score: STRENGTH_LEVEL_SCORES[4], level: 'elite' };
  if (relativeKg < first) return { score: Math.max(1, Math.floor((firstScore * relativeKg) / first)), level: 'beginner' };
  let i = 0;
  while (i < thresholds.length - 2 && (thresholds[i + 1] as number) <= relativeKg) i++;
  const lo = thresholds[i] as number;
  const hi = thresholds[i + 1] as number;
  const sLo = STRENGTH_LEVEL_SCORES[i] as number;
  const sHi = STRENGTH_LEVEL_SCORES[i + 1] as number;
  return { score: Math.floor(sLo + ((sHi - sLo) * (relativeKg - lo)) / (hi - lo)), level: STRENGTH_LEVELS[i] as StrengthLevel };
}

/** Début de la décharge en cours : la séance la plus récente est une décharge → la première de la suite de décharges qui la précède. */
export function deloadFreeze(exercises: readonly StrengthExercise[]): IsoDateTime | null {
  const sessions = exercises.flatMap((e) => e.history).sort((a, b) => compareInstants(a.endedAt, b.endedAt));
  let since: IsoDateTime | null = null;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i] as ExerciseSession;
    if (s.deload !== true) break;
    since = s.endedAt;
  }
  return since;
}

const validWeighIns = (weighIns: readonly WeighIn[]): WeighIn[] => weighIns.filter((w) => Number.isFinite(w.kg) && w.kg > 0);

function bodyweightOf(weighIns: readonly WeighIn[], frozenSince: IsoDateTime | null): { readonly kg: number | null; readonly frozen: boolean } {
  const valid = validWeighIns(weighIns);
  const before = frozenSince === null ? [] : valid.filter((w) => w.date < frozenSince.slice(0, 10));
  const frozen = before.length > 0;
  const kg = currentBodyweightKg(frozen ? before : valid);
  return { kg: kg !== null && Number.isFinite(kg) && kg > 0 ? kg : null, frozen };
}

function e1rmOf(exercise: StrengthExercise, lift: ReferenceLift, bodyweightKg: number): number | null {
  const body: BodyLoad | null = lift.totalLoad ? { baseKg: bodyweightKg, sign: 1 } : null;
  return current1rmFromSessions(analyzeHistory(exercise.history, DEFAULT_PROGRESSION_CONFIG, body).estimates, DEFAULT_PROGRESSION_CONFIG);
}

export function strengthScore(input: StrengthInput): StrengthResult {
  const { sex, lifts } = input;
  const thresholds = input.thresholds ?? STRENGTH_LIFT_THRESHOLDS;
  const liftsByKey = new Map(lifts.map((l) => [l.key, l]));
  const known = input.exercises.filter((e) => liftsByKey.has(e.key));
  const frozenSince = deloadFreeze(known);
  const body = bodyweightOf(input.weighIns, frozenSince);
  const bodyweightKg = body.kg;
  // Relecture M2 : un mouvement sans seuil pour le sexe n'est pas une référence du groupe (jamais « Aucune séance de » à tort).
  const scorable = (e: StrengthExercise): boolean => sex !== null && thresholds[e.key]?.[sex] !== undefined;
  const referencesOf = (group: StrengthGroup): string[] =>
    known.filter((e) => liftsByKey.get(e.key)?.groups.includes(group) === true && (sex === null || scorable(e))).map((e) => e.nameFr);
  const unknown = (group: StrengthGroup, reason: UnknownReason): GroupScore => ({ group, kind: 'unknown', reason, references: reason === 'noReference' ? [] : referencesOf(group) });
  const base = { version: STRENGTH_SCORE_VERSION, bodyweightKg, frozenSince, bodyweightFrozen: body.frozen };

  if (sex === null || bodyweightKg === null) {
    const reason: UnknownReason = sex === null ? 'noSex' : 'noBodyweight';
    return { ...base, lifts: [], groups: STRENGTH_GROUPS.map((g) => unknown(g, reason)), global: null };
  }

  const scored: LiftScore[] = [];
  for (const lift of lifts) {
    const t = thresholds[lift.key]?.[sex];
    if (t === undefined) continue;
    let best: { readonly exercise: StrengthExercise; readonly e1rmKg: number } | null = null;
    for (const exercise of known.filter((e) => e.key === lift.key)) {
      const e1rmKg = e1rmOf(exercise, lift, bodyweightKg);
      if (e1rmKg !== null && (best === null || e1rmKg > best.e1rmKg)) best = { exercise, e1rmKg };
    }
    if (best === null) continue;
    const relativeKg = relativeStrength(best.e1rmKg, bodyweightKg, lift.totalLoad);
    scored.push({ key: lift.key, exerciseId: best.exercise.id, nameFr: best.exercise.nameFr, groups: lift.groups, e1rmKg: best.e1rmKg, relativeKg, ...scoreFromThresholds(relativeKg, t) });
  }

  const groups = STRENGTH_GROUPS.map((group): GroupScore => {
    if (!lifts.some((l) => l.groups.includes(group))) return unknown(group, 'noReference');
    const top = scored.filter((s) => s.groups.includes(group)).reduce<LiftScore | null>((t, s) => (t === null || s.score > t.score ? s : t), null);
    return top === null ? unknown(group, 'noSession') : { group, kind: 'value', score: top.score, level: top.level, lift: top };
  });

  const counted = groups.flatMap((g) => (g.kind === 'value' ? [g.score] : []));
  const globalScore = counted.length > 0 ? Math.floor(counted.reduce((a, b) => a + b, 0) / counted.length) : null;
  return { ...base, lifts: scored, groups, global: globalScore === null ? null : { score: globalScore, level: levelOfScore(globalScore), counted: counted.length } };
}
