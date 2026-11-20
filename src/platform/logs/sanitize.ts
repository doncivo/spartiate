/**
 * Assainissement du journal technique (I-04 critère 5, ADR 0014 §3) : première barrière, en TypeScript ; Rust applique les mêmes règles
 * (`applog::sanitize_detail`), vérifiées par les mêmes vecteurs (`tests/fixtures/logs/sanitize-vectors.json`).
 *
 * Règles : caractères de contrôle remplacés par une espace ; plus de 300 caractères -> `[masqué]` en entier ; sinon chaque mot (séparé par
 * des espaces) qui contient un chemin (Windows, UNC, POSIX, `~/`), `file:`, une URL avec requête, une adresse e-mail ou une séquence
 * hexadécimale de 32 caractères ou plus devient `[masqué]` ; `Bearer` et le mot suivant aussi. Un titre ne se reconnaît pas à sa forme :
 * les appelants ne passent que des codes (règle de `types.ts`), la preuve est le test de sentinelle.
 */

export const LOG_MASK = '[masqué]';
const MAX_DETAIL_CHARS = 300;

const isControl = (code: number): boolean => code <= 0x1f || (code >= 0x7f && code <= 0x9f);
const isAlnum = (char: string | undefined): boolean => char !== undefined && /^[\p{L}\p{N}]$/u.test(char);
const isAsciiAlpha = (char: string | undefined): boolean => char !== undefined && /^[A-Za-z]$/.test(char);

function hasHexRun(token: string): boolean {
  return /[0-9a-fA-F]{32,}/.test(token);
}

function hasDrivePath(chars: readonly string[]): boolean {
  return chars.some((char, i) => isAsciiAlpha(char) && (i === 0 || !isAlnum(chars[i - 1])) && chars[i + 1] === ':' && (chars[i + 2] === '\\' || chars[i + 2] === '/'));
}

function hasPosixPath(chars: readonly string[]): boolean {
  if (chars[0] === '~' && chars[1] === '/') return true;
  return chars.some((char, i) => {
    if (char !== '/') return false;
    const before = chars[i - 1];
    if (i > 0 && (isAlnum(before) || before === ':' || before === '/')) return false;
    const rest = chars.slice(i + 1);
    return rest[0] !== undefined && rest[0] !== '/' && rest.slice(1).includes('/');
  });
}

function hasEmail(chars: readonly string[]): boolean {
  return chars.some((char, at) => {
    if (at === 0 || char !== '@') return false;
    const domain = chars.slice(at + 1);
    return domain.some((c, dot) => dot >= 1 && c === '.' && isAsciiAlpha(domain[dot + 1]) && isAsciiAlpha(domain[dot + 2]));
  });
}

function hasUrlWithQuery(token: string): boolean {
  const start = token.indexOf('://');
  return start >= 0 && token.slice(start).includes('?');
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Audit du lot F (moyen) : jeton probable : suite de 24 caractères ou plus de `[A-Za-z0-9+/=_.-]` (sauf un identifiant UUID exact,
 * permis par l'ADR 0011 §2.3), JWT (`eyJ`), jeton Google (`ya29.`, `1//`), `token=`.
 */
function hasTokenLike(token: string): boolean {
  const lower = token.toLowerCase();
  if (token.includes('eyJ') || lower.includes('ya29.') || token.includes('1//') || lower.includes('token=')) return true;
  return (token.match(/[A-Za-z0-9+/=_.-]{24,}/g) ?? []).some((run) => !UUID.test(run));
}

function isSensitive(token: string): boolean {
  const chars = Array.from(token);
  return hasTokenLike(token) || token.toLowerCase().includes('file:') || token.includes('\\') || hasDrivePath(chars) || hasPosixPath(chars) || hasUrlWithQuery(token) || hasEmail(chars) || hasHexRun(token);
}

/**
 * FIX-CONFID-IOS (C-151, § 22 : aucune donnée corporelle). Listes partagées avec Rust (`applog.rs`) et lues par les deux tests dans
 * `tests/fixtures/logs/sanitize-vectors.json` : unités corporelles, mots corporels, clés dont la valeur numérique reste lisible (compteurs,
 * versions ; aussi toute clé qui finit par un suffixe de `ALLOWED_LOG_KEY_SUFFIXES`). Comparaisons en minuscules.
 */
export const BODY_UNITS: readonly string[] = ['kg', '%', 'bpm', 'ms', 'kcal', 'h', 'min', 'cm', 'kilo', 'kilos', 'lb', 'lbs', 'pulsations'];
export const BODY_WORDS: readonly string[] = ['poids', 'fc', 'hrv', 'vfc', 'rmssd', 'sommeil', 'masse', 'graisse', 'taille', 'tour', 'imc', 'calories', 'kcal', 'weight', 'sleep', 'hr', 'bpm', 'protéines', 'glucides', 'lipides'];
export const ALLOWED_LOG_KEYS: readonly string[] = [
  'version', 'schema_version', 'rules_version', 'sv', 'count', 'n', 'rows', 'files', 'segments', 'segment', 'tables', 'from', 'to', 'type_index', 'epoch', 'seq', 'localseq', 'ops',
  'entries', 'acks', 'appended', 'created', 'deleted', 'updated', 'unchanged', 'skipped', 'skipped_old', 'skipped_no_energy', 'skipped_journal', 'skipped_deleted', 'resumed',
  'rejected', 'read', 'kept', 'imported', 'added', 'absent', 'unreadable', 'uncovered', 'unexplained', 'tombstones', 'superseded', 'ignored', 'failed', 'duplicates', 'planned',
  'settings', 'codes', 'step', 'stage', 'attempt', 'attempts', 'status', 'http', 'written', 'removed', 'nights_known', 'days', 'size', 'previous', 'complete', 'id', 'code',
];
export const ALLOWED_LOG_KEY_SUFFIXES: readonly string[] = ['count', 'version', 'known'];

const isDigit = (char: string | undefined): boolean => char !== undefined && char >= '0' && char <= '9';
const isUnitChar = (char: string | undefined): boolean => char !== undefined && (isAsciiAlpha(char) || char === '%');
const isKeyChar = (char: string | undefined): boolean => char !== undefined && (isAsciiAlpha(char) || isDigit(char) || char === '_');
const isWordChar = (char: string | undefined): boolean => isAlnum(char) || char === '%';
/** Espaces insécables (U+00A0, U+202F) : séparent un nombre de son unité dans un texte formaté en français (« 142 bpm »). */
// Revue 1 de FIX-CONFID-IOS : espaces fines U+2009 et U+2007 traitées de même.
const isNbsp = (char: string | undefined): boolean => char === '\u00a0' || char === '\u202f' || char === '\u2009' || char === '\u2007';
const startsWithLetter = (key: string): boolean => isLetter(Array.from(key)[0]);
/** Revue 2 : signes sautés avant un nombre pour trouver sa clé ou son mot corporel (au plus trois). */
const isSkippable = (char: string | undefined): boolean => isNbsp(char) || (char !== undefined && '["+-(/,\u2192'.includes(char));

/** Clé d'un mot qui finit par `clé=` ou `clé:` (hors extrait JSON `"clé":`), sans ponctuation ni casse, sinon null. */
function signKeyEnding(word: string | undefined): string | null {
  if (word === undefined || word.endsWith('":') || !(word.endsWith('=') || word.endsWith(':'))) return null;
  return bare(word);
}
const isLetter = (char: string | undefined): boolean => char !== undefined && /^\p{L}$/u.test(char);

/** Clé d'un mot qui finit par `"clé":` (extrait JSON coupé par une espace), sinon null. */
function jsonKeyEnding(word: string | undefined): string | null {
  if (word === undefined || !word.endsWith('":')) return null;
  const close = word.length - 2;
  const open = word.lastIndexOf('"', close - 1);
  return open < 0 ? null : word.slice(open + 1, close);
}

/** Mot voisin comparé aux listes : signes de ponctuation retirés en tête et en fin (lettres, chiffres et `%` gardés), en minuscules. */
function bare(word: string | undefined): string {
  if (word === undefined) return '';
  const chars = Array.from(word);
  let start = 0;
  let end = chars.length;
  while (start < end && !isWordChar(chars[start])) start += 1;
  while (end > start && !isWordChar(chars[end - 1])) end -= 1;
  return chars.slice(start, end).join('').toLowerCase();
}

function isAllowedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower !== '' && (ALLOWED_LOG_KEYS.includes(lower) || ALLOWED_LOG_KEY_SUFFIXES.some((suffix) => lower.endsWith(suffix)));
}

/**
 * Le mot porte-t-il une valeur corporelle probable (voir les règles de la fixture) ? `previous` et `next` : mots voisins d'origine (non vides).
 * Pour chaque nombre (chiffres, éventuellement suivis de parties `.` ou `,` + chiffres) : version à 3 parties ou plus séparées par des points
 * gardée ; valeur d'une clé (`"clé":`, `clé=`, `clé:`) : gardée si la clé est permise, masquée si c'est un extrait JSON ou un mot corporel ;
 * sinon masquée si décimale, suivie d'une unité (attachée, ou au mot suivant quand le nombre finit le mot), ou en tête de mot après un mot
 * corporel ou une unité.
 */
function hasBodyNumber(word: string, previous: string | undefined, next: string | undefined, previous2?: string): boolean {
  const chars = Array.from(word);
  let i = 0;
  while (i < chars.length) {
    if (!isDigit(chars[i])) {
      i += 1;
      continue;
    }
    const start = i;
    let parts = 1;
    let commas = false;
    while (isDigit(chars[i])) i += 1;
    while ((chars[i] === '.' || chars[i] === ',') && isDigit(chars[i + 1])) {
      if (chars[i] === ',') commas = true;
      parts += 1;
      i += 1;
      while (isDigit(chars[i])) i += 1;
    }
    const end = i;
    if (parts >= 3 && !commas) continue;
    // Revue 2 : jusqu'à trois signes sautés avant le nombre (`"82"`, `[82`, `-82`, `(82`, `→82`, insécable) pour trouver la clé ou le mot.
    let s0 = start;
    while (s0 > 0 && start - s0 < 3 && isSkippable(chars[s0 - 1])) s0 -= 1;
    const before = chars[s0 - 1];
    let keyed = false;
    // Extrait JSON `"clé":nombre`, `"clé":[nombre`, `"clé":"nombre`.
    const close = before === ':' && chars[s0 - 2] === '"' ? s0 - 2 : -1;
    if (close >= 0) {
      let open = close - 1;
      while (open >= 0 && chars[open] !== '"') open -= 1;
      const key = open >= 0 ? chars.slice(open + 1, close).join('') : '';
      if (isAllowedKey(key)) continue;
      return true;
    }
    if (before === '=' || before === ':') {
      let k = s0 - 1;
      while (k > 0 && isKeyChar(chars[k - 1])) k -= 1;
      // Revue 1 : clé commençant par une lettre et non permise -> masquée (clés composées `heart_rate`, `poidsKg` comprises) ; signe en
      // tête de mot (`hrv =48`) : la clé est le mot précédent.
      const own = chars.slice(k, s0 - 1).join('');
      const key = own === '' && s0 - 1 === 0 ? bare(previous) : own;
      if (isAllowedKey(key)) continue;
      if (startsWithLetter(key)) return true;
      keyed = own !== '';
    }
    if (parts >= 2) return true;
    let unit = end;
    while (isNbsp(chars[unit])) unit += 1;
    let u = unit;
    while (isUnitChar(chars[u])) u += 1;
    const suffix = chars.slice(unit, u).join('').toLowerCase();
    if (suffix !== '' && BODY_UNITS.includes(suffix)) return true;
    const endsWord = chars.slice(end).every((char) => !isAlnum(char) && char !== '%');
    if (suffix === '' && endsWord && BODY_UNITS.includes(bare(next))) return true;
    // Mot corporel collé devant le nombre (« FC142 », « FC 142 » insécable), s'il commence le mot ou suit un signe.
    const p = s0;
    let q = p;
    while (q > 0 && isLetter(chars[q - 1])) q -= 1;
    const prefix = chars.slice(q, p).join('').toLowerCase();
    if (!keyed && prefix !== '' && (q === 0 || !isAlnum(chars[q - 1])) && BODY_WORDS.includes(prefix)) return true;
    const startsWord = !keyed && chars.slice(0, start).every((char) => !isAlnum(char));
    if (startsWord) {
      const key = jsonKeyEnding(previous);
      if (key !== null) {
        if (isAllowedKey(key)) continue;
        return true;
      }
      const signKey = signKeyEnding(previous);
      if (signKey !== null && startsWithLetter(signKey)) {
        if (isAllowedKey(signKey)) continue;
        return true;
      }
      const prev = bare(previous);
      // Revue 2 : mot corporel à un ou deux mots d'écart (`FC moyenne 142`, `weight → 82`).
      if (BODY_WORDS.includes(prev) || BODY_UNITS.includes(prev) || BODY_WORDS.includes(bare(previous2))) return true;
    }
  }
  return false;
}

/** Détail assaini (voir l'en-tête du module et `hasBodyNumber`). */
export function sanitizeLogDetail(raw: string): string {
  const cleaned = Array.from(raw, (char) => (isControl(char.codePointAt(0) ?? 0) ? ' ' : char)).join('');
  if (Array.from(cleaned).length > MAX_DETAIL_CHARS) return LOG_MASK;
  const words = cleaned.split(' ');
  const neighbourIndex = (index: number, step: 1 | -1): number => {
    for (let j = index + step; j >= 0 && j < words.length; j += step) if (words[j] !== '') return j;
    return -1;
  };
  const neighbour = (index: number, step: 1 | -1): string | undefined => {
    const j = neighbourIndex(index, step);
    if (j < 0) return undefined;
    // Revue 1 : signe seul (`hrv = 48`) : le mot précédent devient `hrv=`.
    if (step === -1 && (words[j] === '=' || words[j] === ':')) {
      const k = neighbourIndex(j, -1);
      if (k >= 0) return `${words[k]}${words[j]}`;
    }
    return words[j];
  };
  const previous2 = (index: number): string | undefined => {
    const j = neighbourIndex(index, -1);
    const k = j < 0 ? -1 : neighbourIndex(j, -1);
    return k < 0 ? undefined : words[k];
  };
  const opensArray = (word: string): boolean => word.split('[').length > word.split(']').length;
  let maskNext = false;
  // Revue 2 : un mot masqué qui ouvre un tableau masque les mots suivants jusqu'au `]`.
  let inMaskedArray = false;
  return words
    .map((word, index) => {
      if (word === '') return word;
      if (inMaskedArray) {
        if (word.includes(']')) inMaskedArray = false;
        return LOG_MASK;
      }
      if (maskNext) {
        maskNext = false;
        return LOG_MASK;
      }
      if (word.toLowerCase() === 'bearer') {
        maskNext = true;
        return LOG_MASK;
      }
      if (isSensitive(word) || hasBodyNumber(word, neighbour(index, -1), neighbour(index, 1), previous2(index))) {
        inMaskedArray = opensArray(word);
        return LOG_MASK;
      }
      return word;
    })
    .join(' ');
}

const SCOPE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CODE = /^[a-z0-9][a-z0-9.-]{0,63}$/;

/** Scope accepté tel quel s'il a la forme d'un scope, sinon `invalid` (même règle que Rust). */
export function normalizeScope(scope: string): string {
  return SCOPE.test(scope) ? scope : 'invalid';
}

/**
 * Jeton probable dans un code (revue du lot F) : un segment (entre `-` et `.`) de 24 caractères ou plus, hors UUID exact, ou `ya29.`. Même
 * règle que `has_code_token` de Rust ; vecteurs `codeVectors` partagés.
 */
function hasCodeToken(value: string): boolean {
  return value.includes('ya29.') || (!UUID.test(value) && value.split(/[-.]/).some((segment) => segment.length >= 24));
}

/** Valeur en forme de code (`too-large`, `sync-now`…), sans séquence hexadécimale de 32+ ni jeton probable (revue du lot F). */
export function isLogCode(value: unknown): value is string {
  return typeof value === 'string' && CODE.test(value) && !hasHexRun(value) && !hasCodeToken(value);
}

/**
 * Code et détail d'une erreur (ADR 0014 §3) : `code` = `error.code` s'il a la forme d'un code, sinon le premier mot du texte s'il en a la
 * forme, sinon `error.name`, sinon `unknown` ; `detail` = le reste, assaini.
 */
export function codeAndDetailOf(error: unknown): { readonly code: string; readonly detail: string } {
  const candidate = typeof error === 'object' && error !== null ? (error as { code?: unknown; name?: unknown; message?: unknown }) : null;
  const text = typeof error === 'string' ? error : typeof candidate?.message === 'string' ? candidate.message : '';
  if (isLogCode(candidate?.code)) return { code: candidate.code, detail: sanitizeLogDetail(text) };
  const trimmed = text.trim();
  const space = trimmed.indexOf(' ');
  const first = space < 0 ? trimmed : trimmed.slice(0, space);
  if (isLogCode(first)) return { code: first, detail: sanitizeLogDetail(space < 0 ? '' : trimmed.slice(space + 1)) };
  const name = typeof candidate?.name === 'string' ? candidate.name.toLowerCase() : '';
  return { code: isLogCode(name) ? name : 'unknown', detail: sanitizeLogDetail(trimmed) };
}
