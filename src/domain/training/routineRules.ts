import { isId } from '../types';
import { EQUIPMENT_ID_RE } from './equipment';
import { EXERCISE_KINDS, EXERCISE_METRICS, EXERCISE_PATTERNS, ROUTINE_MODES, type CustomExerciseInput, type RoutineDaySpec, type RoutineExerciseSpec, type RoutineSpec } from './types';

/**
 * Règles pures des routines et des exercices personnalisés (I1-01 critère 5). Elles servent à l'interface (saisie), aux repositories
 * (écriture) et à la réception (programme chargé). Un jour sans exercice, une routine sans jour : admis (brouillon). Pas de règle de
 * progression ici (I2).
 */

export const SETS_MAX = 20;
export const REPS_MAX = 999;
export const RIR_MAX = 5;
export const REST_MAX_SEC = 900;
const NAME_MAX = 120;

export type RoutineIssueCode =
  | 'name-empty'
  | 'mode'
  | 'day-name-empty'
  | 'day-order'
  | 'day-order-duplicate'
  | 'exercise-id'
  | 'exercise-name'
  | 'sets'
  | 'rep-range'
  | 'rir'
  | 'rest'
  | 'position'
  | 'position-duplicate';

export interface RoutineIssue {
  readonly code: RoutineIssueCode;
  /** Absent : problème de la routine elle-même. */
  readonly dayIndex?: number;
  /** Absent : problème du jour lui-même. */
  readonly lineIndex?: number;
}

const isCount = (n: number, min: number, max: number): boolean => Number.isInteger(n) && n >= min && n <= max;
const blank = (s: string): boolean => s.trim() === '';

/** Problèmes d'une ligne de routine (sans localisation). */
export function validateRoutineLine(line: RoutineExerciseSpec): RoutineIssueCode[] {
  const codes: RoutineIssueCode[] = [];
  if (blank(line.exerciseId) || line.exerciseId.length > 128) codes.push('exercise-id');
  if (blank(line.exerciseName) || line.exerciseName.length > NAME_MAX) codes.push('exercise-name');
  if (!isCount(line.sets, 1, SETS_MAX)) codes.push('sets');
  if (!isCount(line.repMin, 1, REPS_MAX) || !isCount(line.repMax, 1, REPS_MAX) || line.repMax < line.repMin) codes.push('rep-range');
  if (line.rir !== null && !isCount(line.rir, 0, RIR_MAX)) codes.push('rir');
  if (!isCount(line.restSec, 0, REST_MAX_SEC)) codes.push('rest');
  if (!Number.isInteger(line.position) || line.position < 0) codes.push('position');
  return codes;
}

/** Problèmes d'un jour : son nom, son ordre, ses lignes (positions distinctes). */
export function validateRoutineDay(day: RoutineDaySpec, dayIndex = 0): RoutineIssue[] {
  const issues: RoutineIssue[] = [];
  if (blank(day.name) || day.name.length > NAME_MAX) issues.push({ code: 'day-name-empty', dayIndex });
  if (!Number.isInteger(day.dayOrder) || day.dayOrder < 0) issues.push({ code: 'day-order', dayIndex });
  const seen = new Set<number>();
  day.exercises.forEach((line, lineIndex) => {
    for (const code of validateRoutineLine(line)) issues.push({ code, dayIndex, lineIndex });
    if (Number.isInteger(line.position) && line.position >= 0) {
      if (seen.has(line.position)) issues.push({ code: 'position-duplicate', dayIndex, lineIndex });
      seen.add(line.position);
    }
  });
  return issues;
}

export function validateRoutine(routine: RoutineSpec): RoutineIssue[] {
  const issues: RoutineIssue[] = [];
  if (blank(routine.name) || routine.name.length > NAME_MAX) issues.push({ code: 'name-empty' });
  if (!(ROUTINE_MODES as readonly string[]).includes(routine.mode)) issues.push({ code: 'mode' });
  const orders = new Set<number>();
  routine.days.forEach((day, dayIndex) => {
    issues.push(...validateRoutineDay(day, dayIndex));
    if (Number.isInteger(day.dayOrder) && day.dayOrder >= 0) {
      if (orders.has(day.dayOrder)) issues.push({ code: 'day-order-duplicate', dayIndex });
      orders.add(day.dayOrder);
    }
  });
  return issues;
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Exercice personnalisé
// -----------------------------------------------------------------------------------------------------------------------------------

export interface ExerciseIssue {
  readonly code: 'id' | 'name' | 'pattern' | 'kind' | 'metric' | 'muscles' | 'equipment' | 'rep-range' | 'rest' | 'bodyweight-fraction';
}

/** Valide la saisie d'un exercice personnalisé : identifiant UUID (D-71, jamais un identifiant embarqué), listes fermées, bornes. */
export function validateCustomExercise(input: CustomExerciseInput): ExerciseIssue[] {
  const issues: ExerciseIssue[] = [];
  const add = (code: ExerciseIssue['code']): void => void issues.push({ code });
  if (!isId(input.id)) add('id');
  if (blank(input.nameFr) || input.nameFr.length > NAME_MAX) add('name');
  if (!(EXERCISE_PATTERNS as readonly string[]).includes(input.pattern)) add('pattern');
  if (!(EXERCISE_KINDS as readonly string[]).includes(input.kind)) add('kind');
  if (!(EXERCISE_METRICS as readonly string[]).includes(input.metric)) add('metric');
  if (input.muscles.length === 0 || input.muscles.some((m) => !EQUIPMENT_ID_RE.test(m.id) || !(m.weight > 0 && m.weight <= 1))) add('muscles');
  if (input.equipment.some((id) => !EQUIPMENT_ID_RE.test(id))) add('equipment');
  const [min, max] = input.defaultRepRange;
  if (!isCount(min, 1, REPS_MAX) || !isCount(max, 1, REPS_MAX) || max < min) add('rep-range');
  if (!isCount(input.defaultRestSec, 0, REST_MAX_SEC)) add('rest');
  if (input.bodyweightFraction !== null && !(input.bodyweightFraction > 0 && input.bodyweightFraction <= 1)) add('bodyweight-fraction');
  return issues;
}
