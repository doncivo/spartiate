import { addDays } from '../localDate';
import { sha256Hex } from '../exportImport/sha256';
import { isLocalDate, type LocalDate } from '../types';
import { EXERCISE_PATTERNS, type ExercisePattern, type MuscleWeight } from './types';

/**
 * Gênes déclarées (BLESSURES, § 10.1 étape 6, § 11.4) : règles pures. SYNC-0291 (D-447) : une gêne = une ligne de la table publiée `injury` ;
 * l'ancien réglage LOCAL `training.injuries` (`{ v: 1, items }`) n'est plus lu que pour la reprise, prudemment. Effet : ÉVITER des mouvements dans les propositions, jamais une promesse de prévention ; la douleur n'entre dans aucun calcul de
 * charge ni de volume (aucune fonction ici ne produit une montée).
 */
export const INJURY_CHECKIN_DAYS = 14;
export const INJURY_NOTE_MAX = 140;
/** Relecture 1 (point 4) : même borne que le CHECK de la migration 0021 (`muscle_id` de 1 à 64 caractères). */
export const INJURY_MUSCLE_ID_MAX = 64;
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

/** Une gêne lue prudemment (SYNC-0291 : partagée par la lecture des lignes publiées et la reprise du réglage local) ; illisible : null. */
export function parseInjury(raw: unknown): Injury | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { id, muscleId, patterns, startedOn, note, status, healedOn, checkins } = r;
  if (typeof id !== 'string' || id === '' || id.length > ID_MAX || !isDate(startedOn)) return null;
  if (status !== 'active' && status !== 'healed') return null;
  if (typeof muscleId === 'string' && muscleId.length > INJURY_MUSCLE_ID_MAX) return null;
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
  if ((muscle === null && patterns.length === 0) || (muscle !== null && muscle.length > INJURY_MUSCLE_ID_MAX)) return { ok: false, issue: 'target' };
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

/**
 * SYNC-0291 (BL-120, D-464) : colonnes publiées d'une gêne (table `injury`) : les motifs et les réponses sont du JSON. `injuryToColumns` écrit la forme
 * stockée ; `injuryFromColumns` la relit avec `parseInjury` (ligne illisible : null, jamais effacée) ; `strict` (import d'archive) refuse aussi une
 * ligne dont un motif ou une réponse serait écarté à la lecture.
 */
export interface InjuryColumns {
  readonly muscle_id: string | null;
  readonly patterns: string;
  readonly started_on: string;
  readonly note: string | null;
  readonly status: string;
  readonly healed_on: string | null;
  readonly checkins: string;
}

export function injuryToColumns(injury: Injury): InjuryColumns {
  return {
    muscle_id: injury.muscleId,
    patterns: JSON.stringify(injury.patterns),
    started_on: injury.startedOn,
    note: injury.note,
    status: injury.status,
    healed_on: injury.healedOn,
    checkins: JSON.stringify(injury.checkins.map((c) => ({ on: c.on, answer: c.answer }))),
  };
}

const parseJsonArray = (text: unknown): unknown[] | null => {
  if (typeof text !== 'string') return null;
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export function injuryFromColumns(id: string, row: Readonly<Record<string, unknown>>, strict = false): Injury | null {
  const patterns = parseJsonArray(row['patterns']);
  const checkins = parseJsonArray(row['checkins']);
  if (patterns === null || checkins === null) return null;
  const injury = parseInjury({ id, muscleId: row['muscle_id'], patterns, startedOn: row['started_on'], note: row['note'], status: row['status'], healedOn: row['healed_on'], checkins });
  if (injury === null || !strict) return injury;
  const same = JSON.stringify(injuryToColumns(injury)) === JSON.stringify({ muscle_id: row['muscle_id'], patterns: row['patterns'], started_on: row['started_on'], note: row['note'], status: row['status'], healed_on: row['healed_on'], checkins: row['checkins'] });
  return same ? injury : null;
}

/**
 * Relecture 1 de SYNC-0291 (point 1, D-468) : écriture d'une gêne depuis la valeur que l'écran a montrée (`before`), jamais depuis la ligne en base.
 * - Champ simple (muscle, motifs, début, note, statut, guérison) : écrit seulement si l'utilisateur l'a changé (`after` ≠ `before`) ; une valeur reçue
 *   entre-temps d'un autre appareil sur un champ que l'écran n'a pas touché reste telle quelle (« Pareil » sur une carte périmée n'annule pas une guérison).
 * - Réponses au check-in (liste) : FUSION, jamais remplacement : les réponses ajoutées par l'écran (présentes dans `after`, absentes de `before`) sont
 *   ajoutées à la liste actuelle (`current`, réponses reçues comprises), sans doublon (même jour, même réponse).
 * - `current` illisible (version future) ou absent : la valeur de l'écran fait foi.
 * Rend les colonnes à écrire (vide : rien à écrire).
 */
export function injuryUpdate(current: Injury | null, before: Injury, after: Injury): Partial<InjuryColumns> {
  const base = current ?? before;
  const b = injuryToColumns(before);
  const a = injuryToColumns(after);
  const c = injuryToColumns(base);
  const out: Record<string, string | null> = {};
  for (const col of ['muscle_id', 'patterns', 'started_on', 'note', 'status', 'healed_on'] as const) if (a[col] !== b[col] && a[col] !== c[col]) out[col] = a[col];
  if (a.checkins !== b.checkins) {
    const key = (x: InjuryCheckin): string => `${x.on}|${x.answer}`;
    const seen = new Set(before.checkins.map(key));
    const merged = [...base.checkins];
    const present = new Set(merged.map(key));
    for (const x of after.checkins) if (!seen.has(key(x)) && !present.has(key(x))) {
      merged.push({ on: x.on, answer: x.answer });
      present.add(key(x));
    }
    const text = JSON.stringify(merged.map((x) => ({ on: x.on, answer: x.answer })));
    if (text !== c.checkins) out['checkins'] = text;
  }
  return out as Partial<InjuryColumns>;
}

/**
 * Relecture 1 (point 2) : identifiant UUID DÉTERMINISTE d'une gêne locale d'avant les UUID (identifiant et contenu hachés) : deux reprises concurrentes
 * ou rejouées donnent la même ligne (insertion sans effet sur une clé existante), jamais un doublon.
 */
export function legacyInjuryId(injury: Injury): string {
  const cols = injuryToColumns(injury);
  const hex = sha256Hex(new TextEncoder().encode(['injury-legacy', injury.id, cols.started_on, cols.muscle_id ?? '', cols.patterns, cols.note ?? ''].join('\u0000')));
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Contre-relecture (D-469) : ce qui RESTE de l'ancien réglage après une reprise : les seules gênes non reprises (illisibles ici, ou dont l'insertion a
 * échoué, `failedIds` = identifiants d'origine). null : tout est repris. Réglage illisible en entier : gardé tel quel.
 */
export function legacyInjuriesResidue(raw: unknown, failedIds: readonly string[]): unknown {
  if (typeof raw !== 'object' || raw === null) return raw ?? null;
  const value = raw as { readonly v?: unknown; readonly items?: unknown };
  if (value.v !== 1 || !Array.isArray(value.items)) return raw;
  const failed = new Set(failedIds);
  const imported = new Set(parseInjuries(raw).items.map((i) => i.id).filter((id) => !failed.has(id)));
  const rest = (value.items as unknown[]).filter((item) => {
    const parsed = parseInjury(item);
    return parsed === null || !imported.has(parsed.id);
  });
  return rest.length === 0 ? null : { v: 1, items: rest };
}
