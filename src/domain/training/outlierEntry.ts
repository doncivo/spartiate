import { isAssistedEquipment } from './assisted';
import { PLAUSIBILITY_CONFIG, type PlausibilityClass, type PlausibilityConfig, type ProgressionConfig } from './config';
import { analyzeHistory, current1rmFromSessions, isEligibleSet, totalLoad, type BodyLoad } from './estimate1rm';
import type { SetKind } from './session';
import type { ExerciseBase, ExercisePattern, ExerciseSession, MuscleWeight } from './types';

/**
 * FIX-ABERR (C-005 ; PRD § 11.5 « aberrantes signalées avant enregistrement ») : contrôle d'une série de travail saisie, AVANT son écriture.
 * Module pur, chargé avec la séance active (jamais dans le départ).
 *
 * - Référence : le 1RM courant du moteur (`analyzeHistory`, séries aberrantes non confirmées écartées) ramené aux répétitions saisies (Epley
 *   inverse) ; à défaut (aucune séance valide : partielles ou décharges seulement), la plus grande charge de travail validée de l'historique.
 * - Signalée : charge (totale pour un exercice au poids du corps de poids connu) > `outlierRatio` × référence ; seuil inclus non signalé.
 * - Rien sans historique (bornes absolues de `validateSetBounds` seules), sans charge ou répétitions, hors série de travail, ni pour une charge
 *   déjà validée dans la séance (une question par charge).
 * - Assisté : la charge saisie est l'assistance ; poids de corps connu, une assistance anormalement BASSE (charge totale trop haute) est
 *   signalée ; inconnu, aucun contrôle relatif (une assistance haute allège l'exercice, une basse ne se chiffre pas sans le poids du corps).
 */

export interface EntryOutlier {
  /** Charge saisie (lest ou assistance pour un exercice au poids du corps). */
  readonly loadKg: number;
  /** Charge habituelle pour ces répétitions, dans la même unité que la saisie, arrondie au demi-kilo. */
  readonly usualKg: number;
  /** Charge (totale) saisie en % de la référence, arrondi à l'entier. */
  readonly percent: number;
}

export interface EntryOutlierOptions {
  readonly config: ProgressionConfig;
  readonly bodyweightKg?: number | null;
  readonly bodyweightFraction?: number | null;
  readonly assisted?: boolean;
  /** Charge la plus « lourde » déjà validée pour cet exercice dans la séance en cours (la plus basse pour un assisté) ; null : aucune. */
  readonly doneInSessionKg?: number | null;
}

const EPS = 1e-9;
const halfKg = (kg: number): number => Math.round(kg * 2) / 2;

export function entryOutlier(entry: { readonly loadKg: number | null; readonly reps: number | null }, kind: SetKind, history: readonly ExerciseSession[], options: EntryOutlierOptions): EntryOutlier | null {
  const { loadKg, reps } = entry;
  const { config } = options;
  if (kind !== 'work' || loadKg === null || reps === null || !Number.isFinite(loadKg) || !Number.isInteger(reps) || reps < 1) return null;
  const assisted = options.assisted === true;
  const done = options.doneInSessionKg ?? null;
  if (done !== null && (assisted ? loadKg >= done : loadKg <= done)) return null;
  const fraction = options.bodyweightFraction ?? null;
  const bodyKg = options.bodyweightKg ?? null;
  const body: BodyLoad | null = fraction !== null && fraction > 0 && bodyKg !== null && bodyKg > 0 ? { baseKg: bodyKg * fraction, sign: assisted ? -1 : 1 } : null;
  if (assisted && body === null) return null;
  if (body === null && !(loadKg > 0)) return null;
  const total = totalLoad(loadKg, body);
  if (!(total > 0) || history.length === 0) return null;
  const current = current1rmFromSessions(analyzeHistory(history, config, body).estimates, config);
  let usual: number;
  if (current !== null) usual = current / (1 + reps / 30);
  else {
    const loads = history.flatMap((s) => s.sets.filter((x) => isEligibleSet(x, body)).map((x) => totalLoad(x.loadKg ?? 0, body)));
    if (loads.length === 0) return null;
    usual = Math.max(...loads);
  }
  if (!(usual > 0) || total <= config.outlierRatio * usual + EPS) return null;
  const usualKg = body === null ? usual : Math.max(0, (usual - body.baseKg) / body.sign);
  return { loadKg, usualKg: halfKg(usualKg), percent: Math.round((total / usual) * 100) };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Vraisemblance à la première séance (FIX-ABERR suite, décision d'Ali du 20/11 ; plafonds `PLAUSIBILITY_CONFIG`, proposition D-325)
// -----------------------------------------------------------------------------------------------------------------------------------

/** Muscles du bas du corps (catalogue fermé `content/exercises/muscles.json`). */
const LOWER_BODY_MUSCLES: ReadonlySet<string> = new Set([
  'quads',
  'hamstrings',
  'glutes',
  'gluteus-medius',
  'gluteus-minimus',
  'adductors',
  'hip-flexors',
  'calves',
  'gastrocnemius',
  'soleus',
  'tibialis-anterior',
  'toe-extensors',
]);
const LOWER_BODY_PATTERNS: ReadonlySet<ExercisePattern> = new Set(['squat', 'hinge', 'lunge']);

/** Champs d'un exercice (embarqué ou personnalisé) qui fixent son type. */
export type PlausibilityExercise = Pick<ExerciseBase, 'kind' | 'pattern' | 'muscles' | 'equipment'>;

/**
 * Type d'un exercice : assisté (matériel d'assistance, prioritaire) ; isolation (`kind`) ; composé du bas du corps si son muscle principal
 * (poids le plus fort, le premier à égalité) est du bas du corps ou son pattern squat / hinge / lunge (rack pull, good morning) ; sinon haut.
 */
export function plausibilityClass(exercise: PlausibilityExercise): PlausibilityClass {
  if (isAssistedEquipment(exercise.equipment)) return 'assisted';
  if (exercise.kind === 'isolation') return 'isolation';
  let primary: MuscleWeight | null = null;
  for (const m of exercise.muscles) if (primary === null || m.weight > primary.weight) primary = m;
  return LOWER_BODY_PATTERNS.has(exercise.pattern) || (primary !== null && LOWER_BODY_MUSCLES.has(primary.id)) ? 'lower-compound' : 'upper-compound';
}

export interface PlausibilityOptions {
  readonly exerciseClass: PlausibilityClass;
  readonly plausibility?: PlausibilityConfig;
  readonly bodyweightKg?: number | null;
  /** Exercice au poids du corps (lesté) : part du poids de corps soulevée ; la charge saisie est le lest. */
  readonly bodyweightFraction?: number | null;
  /** Charge saisie par haltère : plafond × `dumbbellShare`. */
  readonly perDumbbell?: boolean;
  /** Plus forte charge (plus forte assistance pour un assisté) déjà validée pour cet exercice dans la séance ; null : aucune. */
  readonly doneInSessionKg?: number | null;
}

export interface EntryImplausible {
  /** Charge saisie (par haltère, lest ou assistance). */
  readonly loadKg: number;
  /** Plafond dans l'unité de la saisie (par haltère, lest ou assistance). */
  readonly capKg: number;
  /** Multiple du poids de corps appliqué (part par haltère comprise) ; null : poids de corps inconnu, plafond absolu. */
  readonly multiple: number | null;
  readonly bodyweightKg: number | null;
  readonly perDumbbell: boolean;
  readonly exerciseClass: PlausibilityClass;
}

/**
 * Première séance d'un exercice (aucune série de travail retenue dans `history`) : une série de travail au-delà du plafond de son type est
 * signalée avant l'écriture. Plafond : multiple × poids de corps (× `dumbbellShare` par haltère), sinon plafond absolu. Comparé à la charge
 * totale (poids de corps × fraction + lest) pour un lesté de poids de corps connu, à la saisie sinon ; seuil inclus non signalé. Assisté :
 * l'assistance est comparée, et l'atteinte du plafond (assistance ≥ poids de corps) est déjà absurde. Rien avec un historique (le contrôle
 * relatif `entryOutlier` s'applique), hors série de travail, sans charge ou répétitions, ni pour une charge déjà validée dans la séance.
 */
export function entryImplausible(entry: { readonly loadKg: number | null; readonly reps: number | null }, kind: SetKind, history: readonly ExerciseSession[], options: PlausibilityOptions): EntryImplausible | null {
  const { loadKg, reps } = entry;
  if (kind !== 'work' || loadKg === null || reps === null || !Number.isFinite(loadKg) || !(loadKg > 0) || !Number.isInteger(reps) || reps < 1) return null;
  const done = options.doneInSessionKg ?? null;
  if (done !== null && loadKg <= done) return null;
  const cls = options.exerciseClass;
  const assisted = cls === 'assisted';
  const bodyKg = options.bodyweightKg != null && options.bodyweightKg > 0 ? options.bodyweightKg : null;
  const fraction = options.bodyweightFraction ?? null;
  const body: BodyLoad | null = !assisted && bodyKg !== null && fraction !== null && fraction > 0 ? { baseKg: bodyKg * fraction, sign: 1 } : null;
  if (history.some((s) => s.sets.some((x) => isEligibleSet(x, assisted && bodyKg !== null ? { baseKg: bodyKg, sign: -1 } : body)))) return null;
  const config = options.plausibility ?? PLAUSIBILITY_CONFIG;
  const perDumbbell = options.perDumbbell === true && !assisted;
  const share = perDumbbell ? config.dumbbellShare : 1;
  const multiple = bodyKg === null ? null : config.bodyweightMultiple[cls] * share;
  const capTotal = multiple === null || bodyKg === null ? config.absoluteKg[cls] * share : multiple * bodyKg;
  const capKg = Math.max(0, capTotal - (body?.baseKg ?? 0));
  const flagged = assisted && multiple !== null ? loadKg >= capKg - EPS : totalLoad(loadKg, body) > capTotal + EPS;
  if (!flagged) return null;
  return { loadKg, capKg: halfKg(capKg), multiple: multiple === null ? null : Math.round(multiple * 100) / 100, bodyweightKg: bodyKg, perDumbbell, exerciseClass: cls };
}
