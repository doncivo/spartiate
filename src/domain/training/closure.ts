import type { IsoDateTime } from '../types';
import { CATALOG_ASSISTED_IDS, CATALOG_BODYWEIGHT_LOAD_IDS } from './assisted';
import { DEFAULT_PROGRESSION_CONFIG } from './config';
import { analyzeHistory, isUnconfirmedOutlier } from './estimate1rm';
import type { ExerciseSession, RoutineDay } from './types';
import type { WorkoutSet, WorkoutWithSets } from './session';

/**
 * Clôture d'une séance (I1-03 ; PRD § 13.5, § 13.8) : résumé (durée, séries, tonnage, records), écarts avec la routine d'origine
 * (« Mettre à jour la routine ? »). Règles pures ; seul le repérage des charges aberrantes (FIX-ABERR) reprend celui du moteur.
 *
 * Tonnage (§ 13.5 « volume hors drop / partielles / chrono ») : somme charge × répétitions des séries de TRAVAIL (`work`) validées qui
 * portent une charge et des répétitions. Échauffement, séries dégressives (`drop`), partielles et chronométrées sont exclus ; une série
 * au poids du corps sans charge saisie compte 0.
 *
 * Records (PR) d'une séance, par exercice, contre l'historique des séances closes antérieures (séries de travail validées) :
 * - `load` : charge la plus lourde jamais soulevée (au moins une répétition) ;
 * - `set-volume` : meilleure série (charge × répétitions).
 * Un exercice sans historique ne donne pas de record (une première fois n'est pas un record ; règle à confirmer par le rôle training).
 * FIX-ABERR (C-005, § 11.5) : une série aberrante non confirmée (> 150 % du 1RM courant, `analyzeHistory`) n'est jamais un record, ni dans
 * la séance, ni comme meilleure valeur antérieure. Les séances de décharge ne sont pas connues ici : elles comptent comme ordinaires.
 */

export interface PersonalRecord {
  readonly exerciseId: string;
  /** Nom figé de la série (D-71, P-09) : affichable même si l'exercice n'existe plus. */
  readonly exerciseName: string;
  readonly kind: 'load' | 'set-volume';
  /** Nouvelle valeur (kg, ou kg × répétitions). */
  readonly value: number;
  /** Meilleure valeur antérieure. */
  readonly previous: number;
  /** Série qui établit le record. */
  readonly setId: string;
}

export interface WorkoutSummary {
  /** Secondes entre le début et la fin ; null tant que la séance est ouverte ou si une date est invalide. */
  readonly durationSec: number | null;
  /** Séries validées, échauffements compris. */
  readonly validatedSets: number;
  /** Séries validées hors échauffement. */
  readonly validatedWorkSets: number;
  /** Séries prévues (non supprimées), échauffements compris. */
  readonly plannedSets: number;
  /** Tonnage en kg (séries `work` validées seulement). */
  readonly tonnageKg: number;
  readonly records: readonly PersonalRecord[];
}

/**
 * Série comptée dans le tonnage : travail, validée, charge et répétitions renseignées, exercice non assisté. FIX-ASSIST (audit C-011) : la charge
 * saisie d'un assisté est l'assistance, jamais une charge soulevée : hors tonnage et hors records (catalogue toujours ; `assisted` : exercices
 * personnalisés assistés passés par l'appelant).
 */
export function countsInTonnage(set: WorkoutSet): boolean {
  return countsWith(set, NONE);
}

const NONE: ReadonlySet<string> = new Set();

function countsWith(set: WorkoutSet, assisted: ReadonlySet<string>): boolean {
  return !CATALOG_ASSISTED_IDS.has(set.exerciseId) && !assisted.has(set.exerciseId) && set.done && set.setKind === 'work' && set.loadKg !== null && set.reps !== null && set.deletedAt === null;
}

/** Tonnage d'une série (0 hors du tonnage). */
export function setTonnageKg(set: WorkoutSet, assisted: ReadonlySet<string> = NONE): number {
  return countsWith(set, assisted) ? (set.loadKg as number) * (set.reps as number) : 0;
}

/** Tonnage d'une liste de séries, arrondi au centième (somme de flottants). */
export function tonnageKg(sets: readonly WorkoutSet[], assisted: ReadonlySet<string> = NONE): number {
  return Math.round(sets.reduce((sum, s) => sum + setTonnageKg(s, assisted), 0) * 100) / 100;
}

export function workoutDurationSec(workout: { readonly startedAt: string; readonly endedAt: string | null }): number | null {
  if (workout.endedAt === null) return null;
  const start = Date.parse(workout.startedAt);
  const end = Date.parse(workout.endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

const best = (sets: readonly WorkoutSet[], value: (s: WorkoutSet) => number): { value: number; set: WorkoutSet } | null => {
  let out: { value: number; set: WorkoutSet } | null = null;
  for (const s of sets) {
    const v = value(s);
    if (out === null || v > out.value || (v === out.value && s.position < out.set.position)) out = { value: v, set: s };
  }
  return out;
};

/** Séance la plus récente : après toute séance close (ordre de `analyzeHistory`). */
const LIVE_END = '9999-12-31T23:59:59.999Z' as IsoDateTime;

/** Séances d'un exercice (antérieures puis la séance en cours), pour `analyzeHistory` ; fin d'une séance passée : sa dernière série validée. */
function sessionsOf(exerciseId: string, mine: readonly WorkoutSet[], past: readonly WorkoutSet[]): ExerciseSession[] {
  const groups = new Map<string, WorkoutSet[]>();
  for (const s of [...past, ...mine]) if (s.exerciseId === exerciseId && s.deletedAt === null) groups.set(s.workoutId, [...(groups.get(s.workoutId) ?? []), s]);
  const liveId = mine[0]?.workoutId;
  return [...groups].map(([workoutId, list]) => ({
    workoutId,
    endedAt: workoutId === liveId ? LIVE_END : (list.reduce<string>((max, s) => { const at = s.doneAt ?? s.updatedAt; return at > max ? at : max; }, '') as IsoDateTime),
    difficulty: null,
    sets: list.map((s) => ({ position: s.position, setKind: s.setKind, done: s.done, reps: s.reps, loadKg: s.loadKg, rir: s.rir })),
  }));
}

/**
 * Records de `sets` (une séance) contre `history` (séries des séances closes ANTÉRIEURES, tous exercices confondus ; seules les séries de
 * travail validées avec charge comptent). Un record est strictement supérieur à la meilleure valeur antérieure.
 */
export function personalRecords(sets: readonly WorkoutSet[], history: readonly WorkoutSet[], assisted: ReadonlySet<string> = NONE, bodyweighted: ReadonlySet<string> = NONE): PersonalRecord[] {
  const counted = (s: WorkoutSet): boolean => countsWith(s, assisted);
  const records: PersonalRecord[] = [];
  const exercises = [...new Set(sets.filter(counted).map((s) => s.exerciseId))];
  for (const exerciseId of exercises) {
    // FIX-ABERR revue 1 : exercice lesté (catalogue ou `bodyweighted` de l'appelant), aucun repérage sur le lest seul (la saisie, elle, compare
    // la charge totale) : un vrai progrès de lest n'est jamais écarté sans signal.
    const weighted = CATALOG_BODYWEIGHT_LOAD_IDS.has(exerciseId) || bodyweighted.has(exerciseId);
    const outlier = isUnconfirmedOutlier(analyzeHistory(sessionsOf(exerciseId, sets, history), DEFAULT_PROGRESSION_CONFIG, null, { outliers: !weighted }));
    const eligible = (s: WorkoutSet): boolean => counted(s) && !outlier(s.workoutId, s.position);
    const mine = sets.filter((s) => eligible(s) && s.exerciseId === exerciseId);
    const past = history.filter((s) => eligible(s) && s.exerciseId === exerciseId);
    if (past.length === 0) continue;
    const kinds: readonly [PersonalRecord['kind'], (s: WorkoutSet) => number][] = [
      ['load', (s) => s.loadKg as number],
      ['set-volume', (s) => (s.loadKg as number) * (s.reps as number)],
    ];
    for (const [kind, value] of kinds) {
      const now = best(mine, value);
      const before = best(past, value);
      if (now && before && now.value > before.value) records.push({ exerciseId, exerciseName: now.set.exerciseName, kind, value: now.value, previous: before.value, setId: now.set.id });
    }
  }
  return records;
}

export function summarizeWorkout(workout: WorkoutWithSets, history: readonly WorkoutSet[] = [], assisted: ReadonlySet<string> = NONE, bodyweighted: ReadonlySet<string> = NONE): WorkoutSummary {
  const live = workout.sets.filter((s) => s.deletedAt === null);
  return {
    durationSec: workoutDurationSec(workout),
    validatedSets: live.filter((s) => s.done).length,
    validatedWorkSets: live.filter((s) => s.done && s.setKind !== 'warmup').length,
    plannedSets: live.length,
    tonnageKg: tonnageKg(live, assisted),
    records: personalRecords(live, history, assisted, bodyweighted),
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// « Mettre à jour la routine ? » (§ 13.8)
// -----------------------------------------------------------------------------------------------------------------------------------

export interface RoutineDiffAdded {
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** Séries hors échauffement de la séance. */
  readonly sets: number;
  /** Cibles reprises de la première série de la séance (null : celles par défaut de la routine). */
  readonly repMin: number | null;
  readonly repMax: number | null;
  readonly restSec: number | null;
}

export interface RoutineDiffRemoved {
  readonly lineId: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
}

export interface RoutineDiffSets {
  readonly lineId: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly from: number;
  readonly to: number;
}

export interface RoutineDiff {
  readonly added: readonly RoutineDiffAdded[];
  readonly removed: readonly RoutineDiffRemoved[];
  readonly setsChanged: readonly RoutineDiffSets[];
  /** Vrai s'il y a au moins un écart : la question n'est posée qu'alors. */
  readonly hasChanges: boolean;
}

const NO_DIFF: RoutineDiff = { added: [], removed: [], setsChanged: [], hasChanges: false };

/**
 * Écarts entre la séance et le jour de routine dont elle est partie : exercices ajoutés (dans la séance, absents du jour), retirés (dans
 * le jour, sans aucune série dans la séance ; un remplacement apparaît comme un retrait plus un ajout) et nombre de séries différent. On
 * compare la STRUCTURE de la séance (séries non supprimées hors échauffement, validées ou non) : ce que l'utilisateur a ajouté ou retiré.
 * Séance sans routine, jour absent ou supprimé : aucun écart (la question n'est pas posée).
 */
export function routineDiff(workout: WorkoutWithSets, day: RoutineDay | null): RoutineDiff {
  if (workout.routineDayId === null || day === null || day.id !== workout.routineDayId || day.deletedAt !== null) return NO_DIFF;
  const lines = day.exercises.filter((l) => l.deletedAt === null);
  const counts = new Map<string, { name: string; count: number; first: WorkoutSet }>();
  for (const s of [...workout.sets].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
    if (s.deletedAt !== null || s.setKind === 'warmup') continue;
    const entry = counts.get(s.exerciseId);
    if (entry) entry.count += 1;
    else counts.set(s.exerciseId, { name: s.exerciseName, count: 1, first: s });
  }
  const inRoutine = new Set(lines.map((l) => l.exerciseId));
  const added: RoutineDiffAdded[] = [...counts]
    .filter(([id]) => !inRoutine.has(id))
    .map(([exerciseId, e]) => ({ exerciseId, exerciseName: e.name, sets: e.count, repMin: e.first.targetRepsMin, repMax: e.first.targetRepsMax, restSec: e.first.targetRestSec }));
  const removed: RoutineDiffRemoved[] = lines.filter((l) => !counts.has(l.exerciseId)).map((l) => ({ lineId: l.id, exerciseId: l.exerciseId, exerciseName: l.exerciseName }));
  const setsChanged: RoutineDiffSets[] = lines.flatMap((l) => {
    const e = counts.get(l.exerciseId);
    return e && e.count !== l.sets ? [{ lineId: l.id, exerciseId: l.exerciseId, exerciseName: l.exerciseName, from: l.sets, to: e.count }] : [];
  });
  return { added, removed, setsChanged, hasChanges: added.length + removed.length + setsChanged.length > 0 };
}
