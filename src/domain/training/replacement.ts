import { isAssistedEquipment } from './assisted';
import { REPLACEMENT_LOAD_FACTORS, type ReplacementImplement } from './config';
import { dumbbellsHeld } from './dumbbellPair';
import { isExerciseCompatible } from './equipment';
import { FALLBACK_LOAD_STEP_KG, loadGrid, roundKg } from './loadGrid';
import { primaryMuscle } from './prescribe';
import type { WorkoutSet } from './session';
import type { EquipmentInventory, Exercise, ProgressionEquipment } from './types';

/**
 * SESS-01a (§ 13.2 « Remplacer », § 14.1 alternatives, § 11.3 arrondi ; règle proposée en décision) : candidats de remplacement d'un exercice en
 * séance et charge de départ estimée depuis l'exercice remplacé quand le nouveau n'a aucun historique. Module pur.
 *
 * Conversion : charge TOTALE de l'exercice remplacé (deux haltères comptés) × facteur prudent de `REPLACEMENT_LOAD_FACTORS`, puis charge par
 * unité du nouvel exercice (un haltère s'il en tient deux), arrondie au cran INFÉRIEUR de sa grille (sans grille : cran de repli de 2,5 kg vers
 * le bas). Aucune estimation hors règle : métriques ou patterns différents, même matériel, kettlebell, poids du corps, lesté, assisté.
 */

const BARBELL_IDS: ReadonlySet<string> = new Set(['barbell', 'ez-bar', 'trap-bar']);
const CABLE_IDS: ReadonlySet<string> = new Set(['low-pulley', 'high-pulley', 'cable-machine']);
const EPS = 1e-9;

export type ReplacementExercise = Pick<Exercise, 'id' | 'equipment' | 'metric' | 'pattern' | 'bodyweightFraction'>;

/** Premier matériel porteur de charge de l'exercice : barre, haltères, machine (charges guidées, poulie) ; sinon null. */
export function implementOf(exercise: Pick<Exercise, 'equipment'>): ReplacementImplement | null {
  for (const id of exercise.equipment) {
    if (BARBELL_IDS.has(id)) return 'barbell';
    if (id === 'dumbbell') return 'dumbbell';
    if (CABLE_IDS.has(id) || id.endsWith('-machine') || id === 'machine') return 'machine';
    if (id === 'kettlebell') return null;
  }
  return null;
}

export interface ReplacementLoad {
  /** Charge cible par unité (un haltère s'il en tient deux), dans la grille du matériel. */
  readonly loadKg: number;
  /** Haltères tenus (affichage « 2 × 30 kg ») ; null hors haltères. */
  readonly held: 1 | 2 | null;
  readonly from: ReplacementImplement;
  readonly to: ReplacementImplement;
  readonly factor: number;
  /** Estimation par unité avant arrondi (au centième). */
  readonly rawKg: number;
}

export interface ReplacementLoadInput {
  readonly from: ReplacementExercise;
  /** Charge de référence de l'exercice remplacé (par unité, `replacementSourceLoad`) ; null : aucune estimation. */
  readonly fromLoadKg: number | null;
  readonly to: ReplacementExercise;
  readonly profile: ProgressionEquipment | null;
}

const loadable = (e: ReplacementExercise): boolean => e.metric === 'load-reps' && !e.bodyweightFraction && !isAssistedEquipment(e.equipment);

export function estimateReplacementLoad({ from, fromLoadKg, to, profile }: ReplacementLoadInput): ReplacementLoad | null {
  if (fromLoadKg === null || !(fromLoadKg > 0) || !Number.isFinite(fromLoadKg)) return null;
  if (!loadable(from) || !loadable(to) || from.pattern !== to.pattern) return null;
  const a = implementOf(from);
  const b = implementOf(to);
  if (a === null || b === null) return null;
  const factor = REPLACEMENT_LOAD_FACTORS[`${a}>${b}`];
  if (factor === undefined) return null;
  const fromGrid = loadGrid(from.equipment, profile);
  const toGrid = loadGrid(to.equipment, profile);
  const fromHeld = a === 'dumbbell' ? dumbbellsHeld(from, fromGrid?.source ?? null) : null;
  const held = b === 'dumbbell' ? dumbbellsHeld(to, toGrid?.source ?? null) : null;
  const totalKg = fromLoadKg * (fromHeld ?? 1) * factor;
  const rawKg = roundKg(totalKg / (held ?? 1));
  let loadKg: number | null;
  if (toGrid !== null) {
    loadKg = null;
    for (const kg of toGrid.loads) if (kg <= rawKg + EPS && (loadKg === null || kg > loadKg)) loadKg = kg;
  } else {
    loadKg = roundKg(Math.floor(rawKg / FALLBACK_LOAD_STEP_KG + EPS) * FALLBACK_LOAD_STEP_KG);
  }
  if (loadKg === null || !(loadKg > 0)) return null;
  return { loadKg, held, from: a, to: b, factor, rawKg };
}

/**
 * Charge de référence de l'exercice remplacé, par unité : dernière série de travail validée, sinon première charge saisie, sinon première charge
 * cible ; l'échauffement n'est jamais une référence. Null : rien à convertir.
 */
export function replacementSourceLoad(sets: readonly WorkoutSet[]): number | null {
  const work = sets.filter((s) => s.setKind !== 'warmup' && (s.deletedAt ?? null) === null).sort((x, y) => x.position - y.position);
  const done = work.filter((s) => s.done && s.loadKg !== null && s.loadKg > 0).at(-1);
  if (done !== undefined) return done.loadKg;
  const entered = work.find((s) => s.loadKg !== null && s.loadKg > 0);
  if (entered !== undefined) return entered.loadKg;
  return work.find((s) => s.targetLoadKg !== null && s.targetLoadKg > 0)?.targetLoadKg ?? null;
}

export interface ReplacementCandidatesInput<T extends Exercise> {
  readonly of: T;
  readonly library: readonly T[];
  readonly profile: { readonly inventory: EquipmentInventory } | null;
  /** « Ne plus proposer » (SESS-01b). */
  readonly excluded: ReadonlySet<string>;
  /** Exercices déjà dans la séance (l'exercice remplacé compris). */
  readonly present: ReadonlySet<string>;
  /** Groupe musculaire d'affichage (`exerciseGroup`). */
  readonly groupOf: (exercise: T) => string | null;
  /** Nombre de semblables au plus (défaut 12). */
  readonly limit?: number;
}

const byName = (a: Exercise, b: Exercise): number => a.nameFr.localeCompare(b.nameFr, 'fr') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Alternatives de la fiche d'abord (ordre du JSON), puis exercices du même groupe musculaire (même pattern, puis même type, puis le reste ; par
 * nom) ; tous compatibles avec le profil, ni écartés ni déjà dans la séance. Sans groupe connu : même muscle principal.
 */
export function replacementCandidates<T extends Exercise>(input: ReplacementCandidatesInput<T>): { readonly alternatives: readonly T[]; readonly similar: readonly T[] } {
  const { of, library, profile, excluded, present, groupOf } = input;
  const byId = new Map(library.map((e) => [e.id, e]));
  const usable = (e: T): boolean => e.id !== of.id && !excluded.has(e.id) && !present.has(e.id) && isExerciseCompatible(e, profile);
  const alternativeIds = of.origin === 'embedded' ? (of.alternatives ?? []) : [];
  const alternatives = [...new Set(alternativeIds)].map((id) => byId.get(id)).filter((e): e is T => e !== undefined && usable(e));
  const taken = new Set(alternatives.map((e) => e.id));
  const group = groupOf(of);
  const muscle = primaryMuscle(of.muscles);
  const sameGroup = (e: T): boolean => (group !== null ? groupOf(e) === group : muscle !== null && primaryMuscle(e.muscles) === muscle);
  const rank = (e: T): number => (e.pattern === of.pattern ? 0 : e.kind === of.kind ? 1 : 2);
  const similar = library
    .filter((e) => !taken.has(e.id) && usable(e) && sameGroup(e))
    .sort((a, b) => rank(a) - rank(b) || byName(a, b))
    .slice(0, input.limit ?? 12);
  return { alternatives, similar };
}

