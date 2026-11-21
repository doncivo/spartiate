import { REPS_MAX, REST_MAX_SEC, RIR_MAX, SETS_MAX } from './routineRules';
import type { RoutineDaySpec, RoutineSpec } from './types';

/**
 * Import d'un programme (IMPORT-029, PRD § 17.4) : texte (bloc JSON du guide `docs/guide-import-programme.md` ou lignes libres, collés ou lus
 * par l'OCR) → `{ sessions: [{ name, exercises: [{ name, sets, repsMin, repsMax, rir? }] }] }` → rapprochement validé → routine Libre.
 *
 * Module pur et déterministe. Rien n'est ignoré en silence : toute ligne non vide est un titre de séance, un exercice (ou une partie d'un
 * exercice : nom seul, schéma, RIR, repos) ou une ligne rejetée avec sa raison ; une partie de ligne non lue est notée sur l'exercice.
 */

// -----------------------------------------------------------------------------------------------------------------------------------
// Résultat de l'analyse
// -----------------------------------------------------------------------------------------------------------------------------------

export type ImportRejectReason = 'no-scheme' | 'no-name' | 'out-of-range' | 'orphan-rir' | 'json-invalid' | 'json-field';
export const IMPORT_REJECT_REASONS: readonly ImportRejectReason[] = ['no-scheme', 'no-name', 'out-of-range', 'orphan-rir', 'json-invalid', 'json-field'];

/** `unread` : partie de ligne non lue (`text`) ; `seconds` : répétitions lues en secondes ; `rir-range` : plage de RIR, la valeur haute retenue. */
export type ImportNoteCode = 'unread' | 'seconds' | 'rir-range';
export interface ImportNote {
  readonly code: ImportNoteCode;
  readonly text?: string;
}

export interface ImportedExercise {
  readonly name: string;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly rir: number | null;
  /** Repos lu (secondes) ; null : repos par défaut de l'exercice choisi. */
  readonly restSec: number | null;
  /** Numéros (à partir de 1) des lignes lues pour cet exercice ; vide pour le bloc JSON. */
  readonly lines: readonly number[];
  readonly notes: readonly ImportNote[];
}

export interface ImportedSession {
  /** null : exercices sans titre de séance (« Séance n » à l'affichage). */
  readonly name: string | null;
  /** Ligne du titre ; null sans titre ou pour le bloc JSON. */
  readonly line: number | null;
  readonly exercises: readonly ImportedExercise[];
}

export interface ImportRejectedLine {
  /** Numéro de ligne (à partir de 1) ; null pour le bloc JSON. */
  readonly line: number | null;
  readonly text: string;
  readonly reason: ImportRejectReason;
}

export interface ProgramImport {
  readonly format: 'json' | 'lines';
  /** Nom de routine lu (champ `name` du JSON, ou premier titre immédiatement suivi d'un autre titre) ; null sinon. */
  readonly name: string | null;
  readonly sessions: readonly ImportedSession[];
  readonly rejected: readonly ImportRejectedLine[];
}

const NAME_MAX = 120;
/** Longueur d'une ligne rejetée montrée (au-delà, coupée). */
const SHOWN_MAX = 300;

const isInt = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const shown = (s: string): string => (s.length > SHOWN_MAX ? `${s.slice(0, SHOWN_MAX)}…` : s);

/** Bornes communes (celles de `validateRoutineLine`) : vrai si séries, plage, RIR et repos sont acceptables. */
function inRange(sets: number, repsMin: number, repsMax: number, rir: number | null, restSec: number | null): boolean {
  return isInt(sets, 1, SETS_MAX) && isInt(repsMin, 1, REPS_MAX) && isInt(repsMax, 1, REPS_MAX) && repsMin <= repsMax && (rir === null || isInt(rir, 0, RIR_MAX)) && (restSec === null || isInt(restSec, 0, REST_MAX_SEC));
}

export function parseProgramText(text: string): ProgramImport {
  const trimmed = text.trim();
  if (looksLikeJson(trimmed)) return parseJson(trimmed);
  return parseLines(text);
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Bloc JSON
// -----------------------------------------------------------------------------------------------------------------------------------

function looksLikeJson(text: string): boolean {
  return text.startsWith('{') || /"sessions"\s*:/.test(text);
}

function parseJson(text: string): ProgramImport {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let value: unknown;
  try {
    if (start < 0 || end <= start) throw new Error('bloc incomplet');
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { format: 'json', name: null, sessions: [], rejected: [{ line: null, text: shown(text), reason: 'json-invalid' }] };
  }
  const rejected: ImportRejectedLine[] = [];
  const root = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  const rawSessions = root?.['sessions'];
  if (!root || !Array.isArray(rawSessions)) return { format: 'json', name: null, sessions: [], rejected: [{ line: null, text: shown(text.slice(start, end + 1)), reason: 'json-field' }] };
  const name = typeof root['name'] === 'string' && root['name'].trim() !== '' ? root['name'].trim().slice(0, NAME_MAX) : null;
  const sessions: ImportedSession[] = [];
  for (const raw of rawSessions as unknown[]) {
    const session = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
    const exercisesRaw = session?.['exercises'];
    if (!session || !Array.isArray(exercisesRaw)) {
      rejected.push({ line: null, text: shown(JSON.stringify(raw) ?? String(raw)), reason: 'json-field' });
      continue;
    }
    const sessionName = typeof session['name'] === 'string' && session['name'].trim() !== '' ? session['name'].trim().slice(0, NAME_MAX) : null;
    const exercises: ImportedExercise[] = [];
    for (const rawExercise of exercisesRaw as unknown[]) {
      const shownText = shown(sessionName === null ? (JSON.stringify(rawExercise) ?? String(rawExercise)) : `${sessionName} : ${JSON.stringify(rawExercise) ?? String(rawExercise)}`);
      const e = typeof rawExercise === 'object' && rawExercise !== null && !Array.isArray(rawExercise) ? (rawExercise as Record<string, unknown>) : null;
      const exName = e && typeof e['name'] === 'string' ? e['name'].trim() : '';
      const sets = e?.['sets'];
      const repsMin = e?.['repsMin'];
      const repsMaxRaw = e?.['repsMax'];
      const repsMax = repsMaxRaw === undefined || repsMaxRaw === null ? repsMin : repsMaxRaw;
      const rirRaw = e?.['rir'];
      const restRaw = e?.['restSec'];
      const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      if (!e || exName === '' || !numeric(sets) || !numeric(repsMin) || !numeric(repsMax) || (rirRaw !== undefined && rirRaw !== null && !numeric(rirRaw)) || (restRaw !== undefined && restRaw !== null && !numeric(restRaw))) {
        rejected.push({ line: null, text: shownText, reason: 'json-field' });
        continue;
      }
      const rir = numeric(rirRaw) ? rirRaw : null;
      const restSec = numeric(restRaw) ? restRaw : null;
      if (exName.length > NAME_MAX || !inRange(sets, repsMin, repsMax, rir, restSec)) {
        rejected.push({ line: null, text: shownText, reason: 'out-of-range' });
        continue;
      }
      exercises.push({ name: exName, sets, repsMin, repsMax, rir, restSec, lines: [], notes: [] });
    }
    sessions.push({ name: sessionName, line: null, exercises });
  }
  return { format: 'json', name, sessions, rejected };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Lignes libres
// -----------------------------------------------------------------------------------------------------------------------------------

const DASH = '[-‐‑–—−]';
const RANGE = `(?:\\s*(?:${DASH}|à|/)\\s*(\\d{1,4}))?`;
const UNIT = '(?:\\s*(secondes?|sec|s|r[ée]p[ée]titions?|reps?|r[ée]ps?\\.?))?(?![\\p{L}\\p{N}])';
/** « 4×8-10 », « 3 x 12 », « 4X8 », « 3 * 30 s ». */
const SCHEME_X = new RegExp(`(?<![\\p{L}\\p{N}])(\\d{1,3})\\s*[x×✕✖*]\\s*(\\d{1,4})${RANGE}${UNIT}`, 'iu');
/** « 3 séries de 10 », « 3 séries de 8 à 10 répétitions », « 4 series x 8 ». */
const SCHEME_SERIES = new RegExp(`(?<![\\p{L}\\p{N}])(\\d{1,3})\\s*s[ée]ries?\\s*(?:de\\s*|x\\s*|×\\s*|:\\s*)?(\\d{1,4})${RANGE}${UNIT}`, 'iu');
/** « RIR 2 », « @RIR 1-2 », « RIR : 3 ». */
const RIR_RE = new RegExp(`@?\\s*(?<![\\p{L}])RIR\\s*:?\\s*(\\d{1,2})(?:\\s*(?:${DASH}|à)\\s*(\\d{1,2}))?(?![\\p{N}])`, 'iu');
/** « repos 90 s », « repos 2 min », « repos 1 min 30 », « repos 1,5 min », « récup 60 ». */
const REST_RE = /(?<![\p{L}])(?:repos|r[ée]cup(?:[ée]ration)?|rest)\s*:?\s*(\d{1,4})(?:[.,](\d))?\s*(minutes?|min|mn|'|secondes?|sec|s|")?(?:\s*(\d{1,2})(?:\s*(?:s|sec|secondes?|"))?)?(?![\p{L}\p{N}])/iu;
const TITLE_KEYWORD = /^(?:jour|séance|seance|session|day|semaine|entraînement|entrainement|workout|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|j\d{1,2})(?![\p{L}])/iu;
/** Puces et numéros en tête : « - », « • », « 1. », « 1) », « A1) », « a. ». */
const BULLET = /^\s*(?:[-‐–—•*·▪◦‣>]+\s+|\(?[A-Za-z]?\d{1,2}[.)]\s+|[A-Za-z][.)]\s+)/u;
const HAS_CONTENT = /[\p{L}\p{N}]/u;

interface Span {
  readonly start: number;
  readonly end: number;
}

type LineKind =
  | { readonly kind: 'blank' }
  | { readonly kind: 'title'; readonly name: string; readonly explicit: boolean }
  | { readonly kind: 'scheme'; readonly name: string; readonly sets: number; readonly repsMin: number; readonly repsMax: number; readonly seconds: boolean; readonly rir: number | null; readonly rirRange: boolean; readonly restSec: number | null; readonly unread: string; readonly outOfRange: boolean }
  | { readonly kind: 'modifier'; readonly rir: number | null; readonly rirRange: boolean; readonly restSec: number | null; readonly outOfRange: boolean }
  | { readonly kind: 'text'; readonly name: string; readonly colon: boolean };

const cleanName = (s: string): string =>
  s
    .replace(/^[\s:;,.\-‐–—(]+/u, '')
    .replace(/[\s:;,.\-‐–—(]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

function restSeconds(m: RegExpExecArray): number {
  const whole = Number(m[1]);
  const tenth = m[2] === undefined ? 0 : Number(m[2]) / 10;
  const unit = (m[3] ?? '').toLowerCase();
  const minutes = unit.startsWith('m') || unit === "'";
  if (!minutes) return whole;
  return Math.round((whole + tenth) * 60) + (m[4] === undefined ? 0 : Number(m[4]));
}

/** Retire les plages `spans` de `s` (remplacées par une espace). */
function without(s: string, spans: readonly Span[]): string {
  let out = '';
  let at = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    out += `${s.slice(at, span.start)} `;
    at = Math.max(at, span.end);
  }
  return out + s.slice(at);
}

function classify(raw: string): LineKind {
  if (!HAS_CONTENT.test(raw)) return { kind: 'blank' };
  const trimmed = raw.trim();
  if (trimmed.startsWith('#')) return { kind: 'title', name: cleanName(trimmed.replace(/^#+/, '')), explicit: true };
  const s = trimmed.replace(BULLET, '');
  const spans: Span[] = [];
  const rirMatch = RIR_RE.exec(s);
  let rir: number | null = null;
  let rirRange = false;
  if (rirMatch) {
    spans.push({ start: rirMatch.index, end: rirMatch.index + rirMatch[0].length });
    const low = Number(rirMatch[1]);
    const high = rirMatch[2] === undefined ? low : Number(rirMatch[2]);
    rir = Math.max(low, high);
    rirRange = rirMatch[2] !== undefined && high !== low;
  }
  const restMatch = REST_RE.exec(s);
  let restSec: number | null = null;
  if (restMatch) {
    spans.push({ start: restMatch.index, end: restMatch.index + restMatch[0].length });
    restSec = restSeconds(restMatch);
  }
  const rest = without(s, spans);
  const candidates = [SCHEME_X.exec(rest), SCHEME_SERIES.exec(rest)].filter((m): m is RegExpExecArray => m !== null).sort((a, b) => a.index - b.index);
  const scheme = candidates[0];
  if (scheme) {
    const sets = Number(scheme[1]);
    const low = Number(scheme[2]);
    const high = scheme[3] === undefined ? low : Number(scheme[3]);
    const unit = (scheme[4] ?? '').toLowerCase();
    const seconds = unit.startsWith('s');
    const name = cleanName(rest.slice(0, scheme.index));
    const unread = cleanName(rest.slice(scheme.index + scheme[0].length));
    const outOfRange = name.length > NAME_MAX || !inRange(sets, low, high, rir, restSec);
    return { kind: 'scheme', name, sets, repsMin: low, repsMax: high, seconds, rir, rirRange, restSec, unread: HAS_CONTENT.test(unread) ? unread : '', outOfRange };
  }
  if ((rirMatch || restMatch) && !HAS_CONTENT.test(rest)) {
    return { kind: 'modifier', rir, rirRange, restSec, outOfRange: (rir !== null && !isInt(rir, 0, RIR_MAX)) || (restSec !== null && !isInt(restSec, 0, REST_MAX_SEC)) };
  }
  if (TITLE_KEYWORD.test(s)) return { kind: 'title', name: cleanName(s), explicit: true };
  return { kind: 'text', name: cleanName(s), colon: /:\s*$/.test(s) };
}

interface MutableExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number | null;
  restSec: number | null;
  lines: number[];
  notes: ImportNote[];
}
interface MutableSession {
  name: string | null;
  line: number | null;
  exercises: MutableExercise[];
}

function parseLines(text: string): ProgramImport {
  const raws = text.split(/\r?\n/);
  const kinds = raws.map(classify);
  const sessions: MutableSession[] = [];
  const rejected: ImportRejectedLine[] = [];
  let name: string | null = null;
  // Exercice de la ligne précédente (cible d'un RIR ou d'un repos seul) ; objet porteur : modifié dans les fonctions locales.
  const cursor: { last: MutableExercise | null } = { last: null };
  const current = (): MutableSession => {
    const open = sessions[sessions.length - 1];
    if (open) return open;
    const created: MutableSession = { name: null, line: null, exercises: [] };
    sessions.push(created);
    return created;
  };
  const reject = (index: number, reason: ImportRejectReason): void => {
    rejected.push({ line: index + 1, text: shown(raws[index]?.trim() ?? ''), reason });
  };
  const nextContent = (index: number): number => {
    for (let j = index + 1; j < kinds.length; j += 1) if (kinds[j]?.kind !== 'blank') return j;
    return -1;
  };
  const openTitle = (title: string, index: number): void => {
    // Premier titre suivi aussitôt d'un autre titre : nom de la routine.
    const following = nextContent(index);
    const nextKind = following < 0 ? null : kinds[following];
    if (sessions.length === 0 && name === null && nextKind?.kind === 'title') {
      name = title;
      return;
    }
    sessions.push({ name: title, line: index + 1, exercises: [] });
    cursor.last = null;
  };
  const addExercise = (k: Extract<LineKind, { kind: 'scheme' }>, exerciseName: string, lines: number[]): void => {
    const notes: ImportNote[] = [];
    if (k.seconds) notes.push({ code: 'seconds' });
    if (k.rirRange) notes.push({ code: 'rir-range' });
    if (k.unread !== '') notes.push({ code: 'unread', text: k.unread });
    const exercise: MutableExercise = { name: exerciseName, sets: k.sets, repsMin: k.repsMin, repsMax: k.repsMax, rir: k.rir, restSec: k.restSec, lines, notes };
    current().exercises.push(exercise);
    cursor.last = exercise;
  };

  for (let i = 0; i < kinds.length; i += 1) {
    const k = kinds[i];
    if (!k || k.kind === 'blank') continue;
    if (k.kind === 'title') {
      openTitle(k.name, i);
      continue;
    }
    if (k.kind === 'scheme') {
      if (k.name === '') reject(i, 'no-name');
      else if (k.outOfRange) reject(i, 'out-of-range');
      else addExercise(k, k.name, [i + 1]);
      if (k.name === '' || k.outOfRange) cursor.last = null;
      continue;
    }
    if (k.kind === 'modifier') {
      const target = cursor.last;
      if (k.outOfRange) reject(i, 'out-of-range');
      else if (target === null || (k.rir !== null && target.rir !== null) || (k.restSec !== null && target.restSec !== null)) reject(i, 'orphan-rir');
      else {
        if (k.rir !== null) target.rir = k.rir;
        if (k.rirRange) target.notes.push({ code: 'rir-range' });
        if (k.restSec !== null) target.restSec = k.restSec;
        target.lines.push(i + 1);
      }
      continue;
    }
    // Ligne de texte : nom d'exercice si la ligne suivante est un schéma sans nom (photo en colonnes) ; titre si elle finit par « : ».
    const j = nextContent(i);
    const next = j < 0 ? null : kinds[j];
    if (next?.kind === 'scheme' && next.name === '' && k.name !== '') {
      if (next.outOfRange || k.name.length > NAME_MAX) {
        reject(i, 'out-of-range');
        reject(j, 'out-of-range');
        cursor.last = null;
      } else addExercise(next, k.name, [i + 1, j + 1]);
      i = j;
      continue;
    }
    if (k.colon && k.name !== '') {
      openTitle(k.name, i);
      continue;
    }
    reject(i, 'no-scheme');
  }
  return {
    format: 'lines',
    name,
    sessions: sessions.map((s) => ({ name: s.name, line: s.line, exercises: s.exercises.map((e) => ({ ...e, lines: [...e.lines], notes: [...e.notes] })) })),
    rejected,
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Rapprochement des noms (décision proposée IMPORT-029 : normalisation, score, seuils)
// -----------------------------------------------------------------------------------------------------------------------------------

/** Score ≥ seuil sûr et avance sur le suivant ≥ marge : exercice proposé (présélectionné). */
export const IMPORT_MATCH_SURE = 0.85;
export const IMPORT_MATCH_MARGIN = 0.05;
/** Score ≥ seuil de doute : choix parmi les meilleurs ; en dessous : « à choisir » dans la bibliothèque. */
export const IMPORT_MATCH_DOUBT = 0.5;
export const IMPORT_MATCH_CHOICES = 3;
/** Deux mots se valent (faute de frappe, lecture d'image) à partir de cette ressemblance de bigrammes, pour des mots de 4 lettres et plus. */
const TOKEN_FUZZY = 0.7;
const TOKEN_WEIGHT = 0.6;

const STOP_WORDS = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'au', 'aux', 'a', 'en', 'avec', 'sur', 'un', 'une', 'et', 'pour', 'the', 'of', 'with', 'on', 'to']);
/** Synonymes d'un mot (après accents, casse et pluriel). */
const WORD_SYNONYMS: Readonly<Record<string, string>> = {
  db: 'haltere',
  dumbbell: 'haltere',
  bb: 'barre',
  barbell: 'barre',
  cable: 'poulie',
  kb: 'kettlebell',
};
/** Abréviations développées en plusieurs mots. */
const PHRASE_SYNONYMS: Readonly<Record<string, string>> = {
  dc: 'developpe couche',
  di: 'developpe incline',
  dm: 'developpe militaire',
  ohp: 'developpe militaire',
  rdl: 'souleve terre roumain',
  sdt: 'souleve terre',
};

function singular(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) && !/(?:ss|us)$/.test(word) ? word.slice(0, -1) : word;
}

function tokens(name: string): string[] {
  const plain = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (plain === '') return [];
  const out: string[] = [];
  for (const raw of plain.split(' ')) {
    const phrase = PHRASE_SYNONYMS[raw];
    if (phrase) {
      out.push(...phrase.split(' '));
      continue;
    }
    if (STOP_WORDS.has(raw)) continue;
    const word = singular(raw);
    out.push(WORD_SYNONYMS[word] ?? word);
  }
  return out;
}

/** Nom normalisé (mots séparés par une espace) : sans accents, casse, articles ni pluriels, synonymes remplacés. */
export function normalizeExerciseName(name: string): string {
  return tokens(name).join(' ');
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Coefficient de Dice sur les bigrammes de caractères (0 à 1). */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let common = 0;
  for (const [g, n] of ga) common += Math.min(n, gb.get(g) ?? 0);
  return (2 * common) / (a.length - 1 + (b.length - 1));
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4) return 0;
  const d = dice(a, b);
  return d >= TOKEN_FUZZY ? d : 0;
}

function bestCover(from: readonly string[], to: readonly string[]): number {
  let total = 0;
  for (const a of from) total += Math.max(0, ...to.map((b) => tokenSimilarity(a, b)));
  return total;
}

function scoreTokens(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const joinedA = [...a].sort().join(' ');
  const joinedB = [...b].sort().join(' ');
  if (joinedA === joinedB) return 1;
  const tokenScore = (bestCover(a, b) + bestCover(b, a)) / (a.length + b.length);
  const charScore = dice(joinedA, joinedB);
  return Math.min(1, TOKEN_WEIGHT * tokenScore + (1 - TOKEN_WEIGHT) * charScore);
}

/** Ressemblance de deux noms d'exercice, de 0 à 1 (1 : identiques après normalisation), symétrique. */
export function exerciseNameScore(a: string, b: string): number {
  return scoreTokens(tokens(a), tokens(b));
}

export interface ImportCandidate {
  readonly id: string;
  readonly nameFr: string;
  readonly aliasesEn: readonly string[];
}

export interface ImportChoice {
  readonly id: string;
  readonly nameFr: string;
  readonly score: number;
}

/** `sure` : `choices[0]` proposé ; `doubt` : choix parmi `choices` ; `none` : « à choisir » (choices éventuels donnés pour information). */
export type ImportMatchLevel = 'sure' | 'doubt' | 'none';
export interface ImportMatch {
  readonly level: ImportMatchLevel;
  readonly choices: readonly ImportChoice[];
}

/** Rapproche un nom lu des candidats (nom français et alias anglais, meilleur des deux) ; ordre : score décroissant, puis identifiant. */
export function matchExerciseName(name: string, candidates: readonly ImportCandidate[]): ImportMatch {
  const query = tokens(name);
  const scored = candidates
    .map((c) => ({ id: c.id, nameFr: c.nameFr, score: Math.max(scoreTokens(query, tokens(c.nameFr)), ...c.aliasesEn.map((alias) => scoreTokens(query, tokens(alias)))) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const top = scored[0];
  if (!top || top.score < IMPORT_MATCH_DOUBT) return { level: 'none', choices: scored.slice(0, IMPORT_MATCH_CHOICES) };
  const second = scored[1];
  const sure = top.score >= IMPORT_MATCH_SURE && (second === undefined || top.score - second.score >= IMPORT_MATCH_MARGIN);
  return { level: sure ? 'sure' : 'doubt', choices: scored.slice(0, IMPORT_MATCH_CHOICES) };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Routine Libre
// -----------------------------------------------------------------------------------------------------------------------------------

export interface ImportPick {
  readonly exerciseId: string;
  /** Nom figé de la bibliothèque (D-71). */
  readonly exerciseName: string;
  readonly defaultRestSec: number;
}

/**
 * Routine Libre de l'import : une séance par jour (ordre lu), un exercice par ligne choisie ; `pick` rend null pour un exercice retiré.
 * Repos lu, sinon repos par défaut de l'exercice choisi. Séance sans nom : `sessionName(index)`.
 */
export function importedRoutineSpec(name: string, sessions: readonly ImportedSession[], pick: (session: number, exercise: number) => ImportPick | null, sessionName: (index: number) => string): RoutineSpec {
  const days: RoutineDaySpec[] = sessions.map((session, s) => {
    const exercises = session.exercises.flatMap((exercise, e) => {
      const chosen = pick(s, e);
      return chosen ? [{ exerciseId: chosen.exerciseId, exerciseName: chosen.exerciseName, sets: exercise.sets, repMin: exercise.repsMin, repMax: exercise.repsMax, rir: exercise.rir, restSec: exercise.restSec ?? Math.min(REST_MAX_SEC, Math.max(0, chosen.defaultRestSec)) }] : [];
    });
    return { name: session.name ?? sessionName(s), dayOrder: s + 1, weekday: null, exercises: exercises.map((line, position) => ({ ...line, position })) };
  });
  return { name, mode: 'libre', days };
}
