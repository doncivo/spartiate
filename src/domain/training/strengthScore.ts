import type { Sex } from '../bodyProfile';
import { DEFAULT_PROGRESSION_CONFIG } from './config';
import { analyzeHistory, current1rmFromSessions, type BodyLoad } from './estimate1rm';
import type { ExerciseSession } from './types';

/**
 * Strength Score (PRD § 17.1 ; STR-01, D-310 à D-312). Module pur, importé directement par l'écran à la demande (hors de l'index du domaine).
 *
 * - Normes : centiles publiés (10, 25, 50, 75, 90, 95, 99) du 1RM par sexe et catégorie de poids de corps (content/strength/standards.json,
 *   source FitnessVolt Strength Standards, D-310). Catégorie : la première dont la borne « jusqu'à » couvre le poids de corps, sinon la
 *   catégorie ouverte ; aucune interpolation entre catégories.
 * - Score d'un mouvement : rang centile de son 1RM estimé, interpolé linéairement entre deux centiles publiés voisins, arrondi à l'entier ;
 *   sous le 10e centile « < 10 » (borne 10), au-dessus du 99e « > 99 » (borne 99) : jamais extrapolé.
 * - 1RM estimé : celui du moteur (`analyzeHistory`, `current1rmFromSessions`, § 11.3) ; les séances de décharge n'y entrent pas, d'où un
 *   score inchangé pendant une décharge (§ 12.4). Mouvements dont la norme compte la charge totale (tractions, dips) : poids de corps
 *   actuel + lest.
 * - Groupe : le meilleur score parmi ses mouvements de référence ayant un 1RM ; sinon « — » avec sa raison, jamais 0.
 * - Global : moyenne arrondie des groupes chiffrés (bornes comprises), avec leur nombre ; null sans groupe chiffré.
 */

export const STRENGTH_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes'] as const;
export type StrengthGroup = (typeof STRENGTH_GROUPS)[number];
export type StrengthTier = 'iron' | 'bronze' | 'silver' | 'gold';
export type ScoreBound = 'below' | 'above' | null;

export interface StandardClass {
  /** Borne haute incluse de la catégorie ; null : catégorie ouverte (au-delà de la précédente). */
  readonly upToKg: number | null;
  readonly sampleSize: number;
  /** Charges en kg, une par centile publié (`StrengthStandards.percentiles`). */
  readonly kg: readonly number[];
}

export interface LiftStandard {
  readonly key: string;
  readonly sourceLift: string;
  readonly groups: readonly StrengthGroup[];
  /** Vrai : la norme compte la charge totale (poids de corps + lest). */
  readonly totalLoad: boolean;
  readonly male: readonly StandardClass[];
  readonly female: readonly StandardClass[];
}

export interface StrengthStandards {
  readonly percentiles: readonly number[];
  readonly lifts: readonly LiftStandard[];
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
  readonly bodyweightKg: number | null;
  readonly standards: StrengthStandards;
  readonly exercises: readonly StrengthExercise[];
}

export interface LiftScore {
  readonly key: string;
  readonly exerciseId: string;
  readonly nameFr: string;
  readonly oneRmKg: number;
  readonly score: number;
  readonly bound: ScoreBound;
}

export type GroupNoneReason = 'noSex' | 'noBodyweight' | 'noSession' | 'noStandard';

export type GroupScore =
  | { readonly group: StrengthGroup; readonly kind: 'value'; readonly score: number; readonly bound: ScoreBound; readonly tier: StrengthTier; readonly lift: LiftScore }
  | { readonly group: StrengthGroup; readonly kind: 'none'; readonly reason: GroupNoneReason; readonly references: readonly string[] };

export interface StrengthResult {
  readonly groups: readonly GroupScore[];
  readonly global: { readonly score: number; readonly tier: StrengthTier; readonly counted: number } | null;
  /** Catégorie de poids du premier mouvement des normes (affichage) ; null sans sexe ni poids. */
  readonly weightClass: { readonly upToKg: number | null; readonly aboveKg: number | null } | null;
}

/** Rang centile d'une charge dans une ligne de la table (charges croissantes, une par centile publié). */
export function percentileOf(kg: number, standard: readonly number[], percentiles: readonly number[]): { readonly score: number; readonly bound: ScoreBound } {
  const first = standard[0];
  const lastIndex = Math.min(standard.length, percentiles.length) - 1;
  const last = standard[lastIndex];
  const lowP = percentiles[0];
  const highP = percentiles[lastIndex];
  if (first === undefined || last === undefined || lowP === undefined || highP === undefined) throw new Error('table de normes vide');
  if (kg < first) return { score: lowP, bound: 'below' };
  if (kg > last) return { score: highP, bound: 'above' };
  // Plus grand rang dont la charge publiée est atteinte : à charges égales, le centile le plus haut.
  let i = 0;
  while (i < lastIndex && (standard[i + 1] as number) <= kg) i++;
  if (i === lastIndex) return { score: highP, bound: null };
  const lo = standard[i] as number;
  const hi = standard[i + 1] as number;
  const pLo = percentiles[i] as number;
  const pHi = percentiles[i + 1] as number;
  return { score: Math.round(pLo + ((pHi - pLo) * (kg - lo)) / (hi - lo)), bound: null };
}

/** Catégorie de poids : la première dont la borne couvre le poids, sinon la catégorie ouverte (ou la dernière). */
export function classFor(bodyweightKg: number, classes: readonly StandardClass[]): StandardClass | undefined {
  return classes.find((c) => c.upToKg !== null && bodyweightKg <= c.upToKg) ?? classes.find((c) => c.upToKg === null) ?? classes.at(-1);
}

/** Paliers de la maquette PC-Progres : Fer < 25, Bronze 25–49, Argent 50–74, Or ≥ 75. */
export function tierOf(score: number): StrengthTier {
  return score >= 75 ? 'gold' : score >= 50 ? 'silver' : score >= 25 ? 'bronze' : 'iron';
}

function oneRmOf(exercise: StrengthExercise, lift: LiftStandard, bodyweightKg: number): number | null {
  const body: BodyLoad | null = lift.totalLoad ? { baseKg: bodyweightKg, sign: 1 } : null;
  return current1rmFromSessions(analyzeHistory(exercise.history, DEFAULT_PROGRESSION_CONFIG, body).estimates, DEFAULT_PROGRESSION_CONFIG);
}

export function strengthScore(input: StrengthInput): StrengthResult {
  const { sex, bodyweightKg, standards } = input;
  const liftsByKey = new Map(standards.lifts.map((l) => [l.key, l]));
  const known = input.exercises.filter((e) => liftsByKey.has(e.key));
  const referencesOf = (group: StrengthGroup): string[] => known.filter((e) => liftsByKey.get(e.key)?.groups.includes(group) === true).map((e) => e.nameFr);
  const none = (group: StrengthGroup, reason: GroupNoneReason): GroupScore => ({ group, kind: 'none', reason, references: reason === 'noStandard' ? [] : referencesOf(group) });

  if (sex === null || bodyweightKg === null || !(bodyweightKg > 0)) {
    const reason: GroupNoneReason = sex === null ? 'noSex' : 'noBodyweight';
    return { groups: STRENGTH_GROUPS.map((g) => none(g, reason)), global: null, weightClass: null };
  }

  // Meilleur score de chaque mouvement de référence (même clé sur plusieurs exercices : le meilleur 1RM).
  const scores: LiftScore[] = [];
  for (const lift of standards.lifts) {
    const cls = classFor(bodyweightKg, sex === 'male' ? lift.male : lift.female);
    if (cls === undefined) continue;
    let best: LiftScore | null = null;
    for (const exercise of known.filter((e) => e.key === lift.key)) {
      const oneRmKg = oneRmOf(exercise, lift, bodyweightKg);
      if (oneRmKg === null) continue;
      if (best === null || oneRmKg > best.oneRmKg) best = { key: lift.key, exerciseId: exercise.id, nameFr: exercise.nameFr, oneRmKg, ...percentileOf(oneRmKg, cls.kg, standards.percentiles) };
    }
    if (best !== null) scores.push(best);
  }

  const groups = STRENGTH_GROUPS.map((group): GroupScore => {
    if (!standards.lifts.some((l) => l.groups.includes(group))) return none(group, 'noStandard');
    const candidates = scores.filter((s) => liftsByKey.get(s.key)?.groups.includes(group) === true);
    const top = candidates.reduce<LiftScore | null>((t, s) => (t === null || s.score > t.score ? s : t), null);
    if (top === null) return none(group, 'noSession');
    return { group, kind: 'value', score: top.score, bound: top.bound, tier: tierOf(top.score), lift: top };
  });

  const counted = groups.flatMap((g) => (g.kind === 'value' ? [g.score] : []));
  const globalScore = counted.length > 0 ? Math.round(counted.reduce((a, b) => a + b, 0) / counted.length) : null;
  const firstLift = standards.lifts[0];
  const shown = firstLift === undefined ? undefined : sex === 'male' ? firstLift.male : firstLift.female;
  const cls = shown === undefined ? undefined : classFor(bodyweightKg, shown);
  const index = shown === undefined || cls === undefined ? -1 : shown.indexOf(cls);
  const previous = index > 0 ? shown?.[index - 1] : undefined;
  return {
    groups,
    global: globalScore === null ? null : { score: globalScore, tier: tierOf(globalScore), counted: counted.length },
    weightClass: cls === undefined ? null : { upToKg: cls.upToKg, aboveKg: cls.upToKg === null ? (previous?.upToKg ?? null) : null },
  };
}
