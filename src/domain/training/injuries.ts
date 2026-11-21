import { addDays } from '../localDate';
import { isLocalDate, type LocalDate } from '../types';
import { EXERCISE_PATTERNS, type ExercisePattern, type MuscleWeight } from './types';

/**
 * Gênes déclarées (BLESSURES, § 10.1 étape 6, § 11.4) : règles pures. Valeur du réglage LOCAL `training.injuries` (`{ v: 1, items }`), lue
 * prudemment. Effet : ÉVITER des mouvements dans les propositions, jamais une promesse de prévention ; la douleur n'entre dans aucun calcul de
 * charge ni de volume (aucune fonction ici ne produit une montée).
 */
export const INJURY_CHECKIN_DAYS = 14;
export const INJURY_NOTE_MAX = 140;
/** Contribution minimale d'un muscle déclaré dans un exercice pour que celui-ci soit évité. */
export const INJURY_MUSCLE_MIN_WEIGHT = 0.3;
const ID_MAX = 64;

export const CHECKIN_ANSWERS = ['better', 'same', 'worse', 'healed'] as const;
export type CheckinAnswer = (typeof CHECKIN_ANSWERS)[number];
export type InjuryStatus = 'active' | 'healed';

export interface InjuryCheckin {
  readonly on: LocalDate;
  readonly answer: CheckinAnswer;
}

export interface Injury {
  readonly id: string;
  /** Muscle du contenu (`content/exercises/muscles.json`) ; null si seuls des patterns sont déclarés. */
  readonly muscleId: string | null;
  readonly patterns: readonly ExercisePattern[];
  readonly startedOn: LocalDate;
  readonly note: string | null;
  readonly status: InjuryStatus;
  readonly healedOn: LocalDate | null;
  readonly checkins: readonly InjuryCheckin[];
}

export interface InjuriesValue {
  readonly v: 1;
  readonly items: readonly Injury[];
}

export interface InjuryInput {
  readonly id: string;
  readonly muscleId: string | null;
  readonly patterns: readonly ExercisePattern[];
  readonly startedOn: LocalDate;
  readonly note: string | null;
}

export type DeclareResult = { readonly ok: true; readonly value: InjuriesValue } | { readonly ok: false; readonly issue: 'target' | 'date' | 'note' | 'id' };

const isPattern = (p: unknown): p is ExercisePattern => typeof p === 'string' && (EXERCISE_PATTERNS as readonly string[]).includes(p);
const isAnswer = (a: unknown): a is CheckinAnswer => typeof a === 'string' && (CHECKIN_ANSWERS as readonly string[]).includes(a);
const isDate = (s: unknown): s is LocalDate => typeof s === 'string' && isLocalDate(s);
const uniquePatterns = (patterns: readonly ExercisePattern[]): ExercisePattern[] => EXERCISE_PATTERNS.filter((p) => patterns.includes(p));

function parseInjury(raw: unknown): Injury | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { id, muscleId, patterns, startedOn, note, status, healedOn, checkins } = r;
  if (typeof id !== 'string' || id === '' || id.length > ID_MAX || !isDate(startedOn)) return null;
  if (status !== 'active' && status !== 'healed') return null;
  const muscle = typeof muscleId === 'string' && muscleId !== '' ? muscleId : null;
  const pats = Array.isArray(patterns) ? uniquePatterns(patterns.filter(isPattern)) : [];
  if (muscle === null && pats.length === 0) return null;
  const cks = Array.isArray(checkins)
    ? checkins.flatMap((c: unknown): InjuryCheckin[] => {
        const o = c as { on?: unknown; answer?: unknown } | null;
        return o !== null && typeof o === 'object' && isDate(o.on) && isAnswer(o.answer) ? [{ on: o.on, answer: o.answer }] : [];
      })
    : [];
  return {
    id,
    muscleId: muscle,
    patterns: pats,
    startedOn,
    note: typeof note === 'string' && note.trim() !== '' && note.length <= INJURY_NOTE_MAX ? note : null,
    status,
    healedOn: status === 'healed' && isDate(healedOn) ? healedOn : null,
    checkins: cks,
  };
}

export function parseInjuries(raw: unknown): InjuriesValue {
  const empty: InjuriesValue = { v: 1, items: [] };
  if (typeof raw !== 'object' || raw === null) return empty;
  const value = raw as { readonly v?: unknown; readonly items?: unknown };
  if (value.v !== 1 || !Array.isArray(value.items)) return empty;
  const seen = new Set<string>();
  const items: Injury[] = [];
  for (const item of value.items) {
    const injury = parseInjury(item);
    if (injury === null || seen.has(injury.id)) continue;
    seen.add(injury.id);
    items.push(injury);
  }
  return { v: 1, items };
}

export function declareInjury(value: InjuriesValue, input: InjuryInput, today: LocalDate): DeclareResult {
  const patterns = uniquePatterns(input.patterns.filter(isPattern));
  const muscle = input.muscleId !== null && input.muscleId !== '' ? input.muscleId : null;
  if (input.id === '' || input.id.length > ID_MAX || value.items.some((i) => i.id === input.id)) return { ok: false, issue: 'id' };
  if (muscle === null && patterns.length === 0) return { ok: false, issue: 'target' };
  if (!isDate(input.startedOn) || input.startedOn > today) return { ok: false, issue: 'date' };
  const note = input.note === null || input.note.trim() === '' ? null : input.note.trim();
  if (note !== null && note.length > INJURY_NOTE_MAX) return { ok: false, issue: 'note' };
  const injury: Injury = { id: input.id, muscleId: muscle, patterns, startedOn: input.startedOn, note, status: 'active', healedOn: null, checkins: [] };
  return { ok: true, value: { v: 1, items: [...value.items, injury] } };
}

export const activeInjuries = (value: InjuriesValue): readonly Injury[] => value.items.filter((i) => i.status === 'active');

export function markHealed(value: InjuriesValue, id: string, today: LocalDate): InjuriesValue {
  const target = value.items.find((i) => i.id === id);
  if (target === undefined || target.status !== 'active') return value;
  return { v: 1, items: value.items.map((i) => (i.id === id ? { ...i, status: 'healed' as const, healedOn: today } : i)) };
}

/** Réponse au check-in, tracée ; « Guérie » clôt la gêne ; gêne inconnue ou déjà guérie : valeur inchangée (même référence). */
export function recordCheckin(value: InjuriesValue, id: string, answer: CheckinAnswer, today: LocalDate): InjuriesValue {
  const target = value.items.find((i) => i.id === id);
  if (target === undefined || target.status !== 'active') return value;
  const checkins = [...target.checkins, { on: today, answer }];
  const next: Injury = answer === 'healed' ? { ...target, checkins, status: 'healed', healedOn: today } : { ...target, checkins };
  return { v: 1, items: value.items.map((i) => (i.id === id ? next : i)) };
}

/** Jour d'échéance du prochain check-in : 14 jours après la dernière réponse, à défaut après le début. */
export function checkinDueOn(injury: Injury): LocalDate {
  const last = injury.checkins[injury.checkins.length - 1];
  return addDays(last?.on ?? injury.startedOn, INJURY_CHECKIN_DAYS);
}

export const dueCheckins = (value: InjuriesValue, today: LocalDate): readonly Injury[] => activeInjuries(value).filter((i) => checkinDueOn(i) <= today);

export interface AvoidanceExercise {
  readonly id: string;
  readonly pattern: ExercisePattern;
  readonly muscles: readonly MuscleWeight[];
}

/** Ce que les gênes actives écartent : patterns déclarés, et exercices dont un muscle déclaré contribue pour au moins 0,3. */
export function injuryAvoidance(value: InjuriesValue, exercises: readonly AvoidanceExercise[]): { readonly patterns: readonly ExercisePattern[]; readonly exerciseIds: readonly string[] } {
  const active = activeInjuries(value);
  const patterns = uniquePatterns(active.flatMap((i) => i.patterns));
  const muscles = new Set(active.flatMap((i) => (i.muscleId === null ? [] : [i.muscleId])));
  const exerciseIds = exercises.filter((e) => e.muscles.some((m) => muscles.has(m.id) && m.weight >= INJURY_MUSCLE_MIN_WEIGHT)).map((e) => e.id).sort();
  return { patterns, exerciseIds };
}
