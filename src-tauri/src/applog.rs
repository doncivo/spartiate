//! Journal technique persistant (I-04, ADR 0014) : PC et iPhone, sans `cfg`.
//!
//! Fichiers `<app_config_dir>/logs/spartiate.log` (courant) et `spartiate.log.1` (précédent), 256 Kio chacun : une entrée JSON par ligne
//! `{ at, scope, code, detail, n? }`, ajoutée en fin ; rotation à l'écriture. Jamais dans le dossier iCloud ni dans `backups/` : une
//! restauration (P-04) ne touche que `spartiate.db*` et `backups/`, le journal lui survit.
//!
//! Règles :
//! - aucun contenu personnel : `scope` et `code` ont une forme stricte (sinon `invalid`), `detail` passe la seconde barrière d'assainissement
//!   (`sanitize_detail`, mêmes vecteurs que `sanitizeLogDetail` de TypeScript : `tests/fixtures/logs/sanitize-vectors.json`) ;
//! - un dossier `logs/` ou un fichier qui est un lien (ou autre chose qu'un fichier ordinaire) n'est ni lu ni écrit (`unsafe-file`) ;
//! - un même couple (`scope`, `code`) au plus 10 fois par minute ; le surplus est compté et résumé (`log` / `suppressed`, `n`) ;
//! - écritures internes à Rust : `write(scope, code)`, deux `&'static str` (aucun texte dynamique possible) ; avant `init`, gardées en
//!   mémoire (100 au plus) ;
//! - le dernier échec d'écriture du processus (`write_error`) est rendu au front, effacé à la prochaine écriture réussie ;
//! - **seul `eprintln!` du code** : `echo`, copie sur la sortie d'erreur en développement et sous `test-hooks`.

use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Sous-dossier du dossier de configuration de l'app.
pub const LOG_DIR: &str = "logs";
pub const CURRENT_FILE: &str = "spartiate.log";
pub const PREVIOUS_FILE: &str = "spartiate.log.1";
/// Taille maximale d'un fichier (256 Kio) : 512 Kio au plus pour le journal entier.
pub const MAX_FILE_BYTES: u64 = 256 * 1024;
/// Taille maximale d'une ligne (4 Kio) : au-delà, `detail` est tronqué et marqué.
pub const MAX_LINE_BYTES: usize = 4 * 1024;
/// Entrées par appel de `log_append`.
pub const MAX_APPEND_ENTRIES: usize = 100;
/// Entrées rendues par `log_read` au plus.
pub const MAX_READ_ENTRIES: usize = 2000;
/// Entrées internes gardées en mémoire avant `init`.
pub const MAX_PENDING: usize = 100;
/// Entrées d'un même couple (`scope`, `code`) par minute.
pub const RATE_PER_MINUTE: u32 = 10;
/// FIX-CONFID-IOS (C-140) : entrées par minute, tous couples confondus (hors résumés) ; le surplus est résumé par `log` / `rate-capped`.
pub const GLOBAL_PER_MINUTE: u32 = 60;
/// FIX-CONFID-IOS (C-140) : couples suivis au plus par la table de débit (un couple de plus n'est soumis qu'au plafond global).
pub const MAX_RATE_KEYS: usize = 256;
/// FIX-CONFID-IOS (C-140) : scopes écrits par Rust seul ; une entrée de la WebView sous l'un d'eux est inscrite sous `invalid`.
pub const RUST_ONLY_SCOPES: &[&str] = &[
    "log",
    "sync-rust",
    "backup-recovery",
    "sql-refused",
    "backup-exclusion",
];
/// `detail` plus long : masqué en entier.
pub const MAX_DETAIL_CHARS: usize = 300;
/// Lecture bornée d'un fichier (un fichier gonflé à la main n'est pas lu en entier).
const MAX_READ_BYTES: u64 = 1024 * 1024;
pub const MASK: &str = "[masqué]";
pub const TRUNCATED: &str = "[tronqué]";

/// Entrée reçue de la WebView.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct LogEntryIn {
    pub at: String,
    pub scope: String,
    pub code: String,
    #[serde(default)]
    pub detail: String,
    #[serde(default)]
    pub n: Option<u32>,
}

/// Entrée écrite et relue.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LogEntry {
    pub at: String,
    pub scope: String,
    pub code: String,
    #[serde(default)]
    pub detail: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub n: Option<u32>,
}

/// Erreur rendue au front : un code seulement (`too-many`, `unsafe-file`, `disk-full`, `io`, `unreadable`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct LogError {
    pub code: &'static str,
}

const fn fail(code: &'static str) -> LogError {
    LogError { code }
}

// ------------------------------------------------------------------------------------------------------------------------------
// Forme et assainissement
// ------------------------------------------------------------------------------------------------------------------------------

/// `^[a-z0-9][a-z0-9-]{0,39}$`
pub fn is_scope(value: &str) -> bool {
    let bytes = value.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 40
        && (bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit())
        && bytes
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-')
}

/// `^[a-z0-9][a-z0-9.-]{0,63}$`, sans séquence hexadécimale de 32+ ni jeton probable (revue du lot F, `has_code_token`).
pub fn is_code(value: &str) -> bool {
    let bytes = value.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 64
        && (bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit())
        && bytes
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-' || *b == b'.')
        && !has_hex_run(value, 32)
        && !has_code_token(value)
}

/// Jeton probable dans un code : un segment (entre `-` et `.`) de 24 caractères ou plus, hors UUID exact, ou `ya29.`. Même règle que
/// `hasCodeToken` de TypeScript ; vecteurs `codeVectors` partagés.
fn has_code_token(value: &str) -> bool {
    value.contains("ya29.")
        || (!is_uuid(value) && value.split(['-', '.']).any(|segment| segment.len() >= 24))
}

/// `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$`
pub fn is_iso_instant(value: &str) -> bool {
    let b = value.as_bytes();
    if b.len() < 20 || b.len() > 24 || b[b.len() - 1] != b'Z' {
        return false;
    }
    let digits = |range: std::ops::Range<usize>| b[range].iter().all(u8::is_ascii_digit);
    let base = digits(0..4)
        && b[4] == b'-'
        && digits(5..7)
        && b[7] == b'-'
        && digits(8..10)
        && b[10] == b'T'
        && digits(11..13)
        && b[13] == b':'
        && digits(14..16)
        && b[16] == b':'
        && digits(17..19);
    if !base {
        return false;
    }
    match b.len() {
        20 => true,
        n => b[19] == b'.' && n >= 22 && digits(20..n - 1),
    }
}

/// Caractère de contrôle (C0, DEL, C1) : remplacé par une espace avant tout contrôle.
fn is_control(c: char) -> bool {
    matches!(c as u32, 0x00..=0x1f | 0x7f..=0x9f)
}

fn has_hex_run(token: &str, min: usize) -> bool {
    let mut run = 0;
    for c in token.chars() {
        if c.is_ascii_hexdigit() {
            run += 1;
            if run >= min {
                return true;
            }
        } else {
            run = 0;
        }
    }
    false
}

fn has_drive_path(chars: &[char]) -> bool {
    (0..chars.len()).any(|i| {
        chars[i].is_ascii_alphabetic()
            && (i == 0 || !chars[i - 1].is_alphanumeric())
            && chars.get(i + 1) == Some(&':')
            && matches!(chars.get(i + 2), Some('\\' | '/'))
    })
}

/// Un `/` qui n'est précédé ni d'une lettre, ni d'un chiffre, ni de `:` ou `/`, suivi d'au moins un caractère puis d'un autre `/` : `/var/x`,
/// `path=/Users/a`, `(/etc/x)`. Une URL (`https://hôte/chemin`) n'en est pas un.
fn has_posix_path(chars: &[char]) -> bool {
    if chars.first() == Some(&'~') && chars.get(1) == Some(&'/') {
        return true;
    }
    (0..chars.len()).any(|i| {
        if chars[i] != '/'
            || (i > 0
                && (chars[i - 1].is_alphanumeric() || chars[i - 1] == ':' || chars[i - 1] == '/'))
        {
            return false;
        }
        let rest = &chars[i + 1..];
        rest.first().is_some_and(|c| *c != '/') && rest.iter().skip(1).any(|c| *c == '/')
    })
}

fn has_email(chars: &[char]) -> bool {
    (1..chars.len()).any(|at| {
        if chars[at] != '@' {
            return false;
        }
        let domain = &chars[at + 1..];
        (1..domain.len()).any(|dot| {
            domain[dot] == '.'
                && domain.get(dot + 1).is_some_and(char::is_ascii_alphabetic)
                && domain.get(dot + 2).is_some_and(char::is_ascii_alphabetic)
        })
    })
}

fn has_url_with_query(token: &str) -> bool {
    token
        .find("://")
        .is_some_and(|start| token[start..].contains('?'))
}

/// Un mot à masquer : chemin (Windows, UNC, POSIX, `~/`), `file://`, URL avec requête, adresse e-mail, séquence hexadécimale de 32 caractères
/// ou plus. Mêmes règles que `sanitizeLogDetail` (`src/platform/logs/sanitize.ts`).
/// Identifiant UUID exact (8-4-4-4-12 hexadécimaux), permis par l'ADR 0011 §2.3.
fn is_uuid(run: &str) -> bool {
    let parts: Vec<&str> = run.split('-').collect();
    parts.len() == 5
        && [8, 4, 4, 4, 12]
            .iter()
            .zip(&parts)
            .all(|(len, part)| part.len() == *len && part.chars().all(|c| c.is_ascii_hexdigit()))
}

/// Audit du lot F (moyen) : jeton probable : suite de 24 caractères ou plus de `[A-Za-z0-9+/=_.-]` (sauf un UUID exact), JWT (`eyJ`),
/// jeton Google (`ya29.`, `1//`), `token=`. Mêmes règles que `hasTokenLike` de TypeScript.
fn has_token_like(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    if token.contains("eyJ")
        || lower.contains("ya29.")
        || token.contains("1//")
        || lower.contains("token=")
    {
        return true;
    }
    let allowed =
        |c: char| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '_' | '.' | '-');
    token
        .split(|c: char| !allowed(c))
        .any(|run| run.chars().count() >= 24 && !is_uuid(run))
}

fn is_sensitive_token(token: &str) -> bool {
    let chars: Vec<char> = token.chars().collect();
    let lower = token.to_ascii_lowercase();
    has_token_like(token)
        || lower.contains("file:")
        || token.contains('\\')
        || has_drive_path(&chars)
        || has_posix_path(&chars)
        || has_url_with_query(token)
        || has_email(&chars)
        || has_hex_run(token, 32)
}

/// Seconde barrière (ADR 0014 §1) : caractères de contrôle remplacés par une espace ; plus de 300 caractères → `[masqué]` en entier ; sinon
/// chaque mot sensible devient `[masqué]`, ainsi que `Bearer` et le mot qui le suit. Les espaces d'origine sont conservées.
pub fn sanitize_detail(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| if is_control(c) { ' ' } else { c })
        .collect();
    if cleaned.chars().count() > MAX_DETAIL_CHARS {
        return MASK.to_owned();
    }
    let words: Vec<&str> = cleaned.split(' ').collect();
    let neighbour_index = |index: usize, forward: bool| -> Option<usize> {
        if forward {
            (index + 1..words.len()).find(|j| !words[*j].is_empty())
        } else {
            (0..index).rev().find(|j| !words[*j].is_empty())
        }
    };
    // Revue 1 : signe seul (`hrv = 48`) : le mot précédent devient `hrv=`.
    let neighbour = |index: usize, forward: bool| -> Option<String> {
        let j = neighbour_index(index, forward)?;
        if !forward && (words[j] == "=" || words[j] == ":") {
            if let Some(k) = neighbour_index(j, false) {
                return Some(format!("{}{}", words[k], words[j]));
            }
        }
        Some(words[j].to_owned())
    };
    let mut out: Vec<&str> = Vec::with_capacity(words.len());
    let mut mask_next = false;
    for (index, word) in words.iter().enumerate() {
        if word.is_empty() {
            out.push(word);
        } else if mask_next {
            out.push(MASK);
            mask_next = false;
        } else if word.eq_ignore_ascii_case("bearer") {
            out.push(MASK);
            mask_next = true;
        } else if is_sensitive_token(word)
            || has_body_number(
                word,
                neighbour(index, false).as_deref(),
                neighbour(index, true).as_deref(),
            )
        {
            out.push(MASK);
        } else {
            out.push(word);
        }
    }
    out.join(" ")
}

/// FIX-CONFID-IOS (C-140, C-151, § 22) : listes partagées avec TypeScript (`sanitize.ts`) et lues par les deux tests dans
/// `tests/fixtures/logs/sanitize-vectors.json`. Comparaisons en minuscules.
pub const BODY_UNITS: &[&str] = &["kg", "%", "bpm", "ms", "kcal", "h", "min", "cm"];
pub const BODY_WORDS: &[&str] = &[
    "poids",
    "fc",
    "hrv",
    "vfc",
    "rmssd",
    "sommeil",
    "masse",
    "graisse",
    "taille",
    "tour",
    "imc",
    "calories",
    "kcal",
    "weight",
    "sleep",
    "hr",
    "bpm",
    "protéines",
    "glucides",
    "lipides",
];
/// Clés dont la valeur numérique reste lisible (compteurs, versions des journaux de l'app), et suffixes permis.
pub const ALLOWED_LOG_KEYS: &[&str] = &[
    "version",
    "schema_version",
    "rules_version",
    "sv",
    "count",
    "n",
    "rows",
    "files",
    "segments",
    "segment",
    "tables",
    "from",
    "to",
    "type_index",
    "epoch",
    "seq",
    "localseq",
    "ops",
    "entries",
    "acks",
    "appended",
    "created",
    "deleted",
    "updated",
    "unchanged",
    "skipped",
    "skipped_old",
    "skipped_no_energy",
    "skipped_journal",
    "skipped_deleted",
    "resumed",
    "rejected",
    "read",
    "kept",
    "imported",
    "added",
    "absent",
    "unreadable",
    "uncovered",
    "unexplained",
    "tombstones",
    "superseded",
    "ignored",
    "failed",
    "duplicates",
    "planned",
    "settings",
    "codes",
    "step",
    "stage",
    "attempt",
    "attempts",
    "status",
    "http",
    "written",
    "removed",
    "nights_known",
    "days",
    "size",
    "previous",
    "complete",
    "id",
    "code",
];
pub const ALLOWED_LOG_KEY_SUFFIXES: &[&str] = &["count", "version", "known"];

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '%'
}

/// Espaces insécables (U+00A0, U+202F) : séparent un nombre de son unité dans un texte formaté en français.
fn is_nbsp(c: char) -> bool {
    matches!(c, '\u{a0}' | '\u{202f}' | '\u{2009}' | '\u{2007}')
}

fn starts_with_letter(key: &str) -> bool {
    key.chars().next().is_some_and(char::is_alphabetic)
}

/// Clé d'un mot qui finit par `clé=` ou `clé:` (hors extrait JSON `"clé":`), sans ponctuation ni casse, sinon `None` (revue 1).
fn sign_key_ending(word: Option<&str>) -> Option<String> {
    let w = word?;
    if w.ends_with("\":") || !(w.ends_with('=') || w.ends_with(':')) {
        return None;
    }
    Some(bare(Some(w)))
}

/// Clé d'un mot qui finit par `"clé":` (extrait JSON coupé par une espace), sinon `None`.
fn json_key_ending(word: Option<&str>) -> Option<&str> {
    let head = word?.strip_suffix("\":")?;
    let open = head.rfind('"')?;
    Some(&head[open + 1..])
}

/// Mot voisin comparé aux listes : ponctuation retirée en tête et en fin (lettres, chiffres et `%` gardés), en minuscules.
fn bare(word: Option<&str>) -> String {
    word.map(|w| w.trim_matches(|c: char| !is_word_char(c)).to_lowercase())
        .unwrap_or_default()
}

fn is_allowed_key(key: &str) -> bool {
    let lower = key.to_lowercase();
    !lower.is_empty()
        && (ALLOWED_LOG_KEYS.contains(&lower.as_str())
            || ALLOWED_LOG_KEY_SUFFIXES
                .iter()
                .any(|suffix| lower.ends_with(suffix)))
}

/// Valeur corporelle probable dans un mot : mêmes règles que `hasBodyNumber` de TypeScript (voir la fixture). Pour chaque nombre (chiffres,
/// éventuellement suivis de parties `.` ou `,` + chiffres) : version de 3 parties ou plus séparées par des points gardée ; valeur d'une clé
/// (`"clé":`, `clé=`, `clé:`) gardée si la clé est permise, masquée si c'est un extrait JSON ou un mot corporel ; sinon masquée si décimale,
/// suivie d'une unité (attachée, ou au mot suivant quand le nombre finit le mot), ou en tête de mot après un mot corporel ou une unité.
fn has_body_number(word: &str, previous: Option<&str>, next: Option<&str>) -> bool {
    let chars: Vec<char> = word.chars().collect();
    let digit = |i: usize| chars.get(i).is_some_and(char::is_ascii_digit);
    let mut i = 0;
    while i < chars.len() {
        if !digit(i) {
            i += 1;
            continue;
        }
        let start = i;
        let mut parts = 1;
        let mut commas = false;
        while digit(i) {
            i += 1;
        }
        while matches!(chars.get(i), Some('.' | ',')) && digit(i + 1) {
            commas |= chars[i] == ',';
            parts += 1;
            i += 1;
            while digit(i) {
                i += 1;
            }
        }
        let end = i;
        if parts >= 3 && !commas {
            continue;
        }
        let before = start.checked_sub(1).map(|b| chars[b]);
        let mut keyed = false;
        // Extrait JSON `"clé":nombre` ou `"clé":[nombre` (tableau, revue 1).
        let close = if before == Some(':') && start >= 2 && chars[start - 2] == '"' {
            Some(start - 2)
        } else if before == Some('[')
            && start >= 3
            && chars[start - 2] == ':'
            && chars[start - 3] == '"'
        {
            Some(start - 3)
        } else {
            None
        };
        if let Some(close) = close {
            let key: String = match chars[..close].iter().rposition(|c| *c == '"') {
                Some(open) => chars[open + 1..close].iter().collect(),
                None => String::new(),
            };
            if is_allowed_key(&key) {
                continue;
            }
            return true;
        }
        if matches!(before, Some('=' | ':')) {
            let mut k = start - 1;
            while k > 0 && (chars[k - 1].is_ascii_alphanumeric() || chars[k - 1] == '_') {
                k -= 1;
            }
            // Revue 1 : clé commençant par une lettre et non permise -> masquée (clés composées comprises) ; signe en tête de mot
            // (`hrv =48`) : la clé est le mot précédent.
            let own: String = chars[k..start - 1].iter().collect();
            let key = if own.is_empty() && start == 1 {
                bare(previous)
            } else {
                own.clone()
            };
            if is_allowed_key(&key) {
                continue;
            }
            if starts_with_letter(&key) {
                return true;
            }
            keyed = !own.is_empty();
        }
        if parts >= 2 {
            return true;
        }
        let mut unit = end;
        while chars.get(unit).is_some_and(|c| is_nbsp(*c)) {
            unit += 1;
        }
        let mut u = unit;
        while chars
            .get(u)
            .is_some_and(|c| c.is_ascii_alphabetic() || *c == '%')
        {
            u += 1;
        }
        let suffix: String = chars[unit..u].iter().collect::<String>().to_lowercase();
        if !suffix.is_empty() && BODY_UNITS.contains(&suffix.as_str()) {
            return true;
        }
        let ends_word = chars[end..]
            .iter()
            .all(|c| !c.is_alphanumeric() && *c != '%');
        if suffix.is_empty() && ends_word && BODY_UNITS.contains(&bare(next).as_str()) {
            return true;
        }
        // Mot corporel collé devant le nombre (« FC142 », « FC 142 » insécable), s'il commence le mot ou suit un signe.
        let mut p = start;
        while p > 0 && is_nbsp(chars[p - 1]) {
            p -= 1;
        }
        let mut q = p;
        while q > 0 && chars[q - 1].is_alphabetic() {
            q -= 1;
        }
        let prefix: String = chars[q..p].iter().collect::<String>().to_lowercase();
        if !keyed
            && !prefix.is_empty()
            && (q == 0 || !chars[q - 1].is_alphanumeric())
            && BODY_WORDS.contains(&prefix.as_str())
        {
            return true;
        }
        let starts_word = !keyed && chars[..start].iter().all(|c| !c.is_alphanumeric());
        if starts_word {
            if let Some(key) = json_key_ending(previous) {
                if is_allowed_key(key) {
                    continue;
                }
                return true;
            }
            if let Some(key) = sign_key_ending(previous).filter(|k| starts_with_letter(k)) {
                if is_allowed_key(&key) {
                    continue;
                }
                return true;
            }
            let prev = bare(previous);
            if BODY_WORDS.contains(&prev.as_str()) || BODY_UNITS.contains(&prev.as_str()) {
                return true;
            }
        }
    }
    false
}

/// Entrée normalisée : formes strictes (`invalid` sinon), heure de Rust si `at` n'est pas un instant ISO, détail assaini, `n` ≥ 2 seulement.
pub fn normalize(entry: &LogEntryIn, now_iso: &str) -> LogEntry {
    LogEntry {
        at: if is_iso_instant(&entry.at) {
            entry.at.clone()
        } else {
            now_iso.to_owned()
        },
        scope: if is_scope(&entry.scope) {
            entry.scope.clone()
        } else {
            "invalid".to_owned()
        },
        code: if is_code(&entry.code) {
            entry.code.clone()
        } else {
            "invalid".to_owned()
        },
        detail: sanitize_detail(&entry.detail),
        n: entry.n.filter(|n| *n >= 2),
    }
}

/// Ligne JSON d'une entrée, 4 Kio au plus : un `detail` trop long est coupé et suivi de `[tronqué]`.
pub fn line_of(entry: &LogEntry) -> String {
    let line = serde_json::to_string(entry).unwrap_or_default();
    if line.len() <= MAX_LINE_BYTES {
        return line;
    }
    // Plus long préfixe de `detail` (en caractères) dont la ligne, marque comprise, tient dans 4 Kio : recherche dichotomique.
    let chars: Vec<char> = entry.detail.chars().collect();
    let build = |keep: usize| {
        let detail: String = chars[..keep].iter().collect();
        serde_json::to_string(&LogEntry {
            detail: format!("{detail} {TRUNCATED}"),
            ..entry.clone()
        })
        .unwrap_or_default()
    };
    let (mut low, mut high) = (0usize, chars.len());
    while low < high {
        let middle = (low + high).div_ceil(2);
        if build(middle).len() <= MAX_LINE_BYTES {
            low = middle;
        } else {
            high = middle - 1;
        }
    }
    build(low)
}

// ------------------------------------------------------------------------------------------------------------------------------
// Heure
// ------------------------------------------------------------------------------------------------------------------------------

#[cfg(feature = "test-hooks")]
static TEST_NOW: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(u64::MAX);

/// Horloge du journal pour les tests d'intégration. Tenir `support::applog_dir_lock()` pendant toute sa durée : le débit et le dossier
/// sont partagés par le processus, donc tous ses écrivains doivent observer la même minute. Restauration même en cas de panique.
#[cfg(feature = "test-hooks")]
pub struct TestClock {
    previous: u64,
    _not_send: std::marker::PhantomData<std::rc::Rc<()>>,
}

#[cfg(feature = "test-hooks")]
impl TestClock {
    pub fn set(&mut self, now: u64) {
        assert_ne!(now, u64::MAX);
        TEST_NOW.store(now, std::sync::atomic::Ordering::SeqCst);
    }
}

#[cfg(feature = "test-hooks")]
impl Drop for TestClock {
    fn drop(&mut self) {
        TEST_NOW.store(self.previous, std::sync::atomic::Ordering::SeqCst);
    }
}

#[cfg(feature = "test-hooks")]
pub fn clock_for_tests(now: u64) -> TestClock {
    assert_ne!(now, u64::MAX);
    TestClock {
        previous: TEST_NOW.swap(now, std::sync::atomic::Ordering::SeqCst),
        _not_send: std::marker::PhantomData,
    }
}

fn now_secs() -> u64 {
    #[cfg(feature = "test-hooks")]
    {
        let now = TEST_NOW.load(std::sync::atomic::Ordering::SeqCst);
        if now != u64::MAX {
            return now;
        }
    }
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// Instant ISO UTC d'une heure en secondes.
pub fn iso_of(secs: u64) -> String {
    crate::backup::iso_instant(secs)
}

// ------------------------------------------------------------------------------------------------------------------------------
// Fichiers
// ------------------------------------------------------------------------------------------------------------------------------

fn io_code(error: &io::Error) -> &'static str {
    match error.raw_os_error() {
        // ENOSPC (Unix), ERROR_HANDLE_DISK_FULL et ERROR_DISK_FULL (Windows).
        #[cfg(unix)]
        Some(28) => "disk-full",
        #[cfg(windows)]
        Some(39 | 112) => "disk-full",
        _ => "io",
    }
}

/// Dossier `logs/` : créé au besoin ; un lien, une jonction ou autre chose qu'un dossier ordinaire rend `unsafe-file`.
fn ensure_dir(dir: &Path, create: bool) -> Result<bool, LogError> {
    match fs::symlink_metadata(dir) {
        Ok(meta) if meta.file_type().is_dir() => Ok(true),
        Ok(_) => Err(fail("unsafe-file")),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            if !create {
                return Ok(false);
            }
            fs::create_dir_all(dir).map_err(|e| fail(io_code(&e)))?;
            match fs::symlink_metadata(dir) {
                Ok(meta) if meta.file_type().is_dir() => Ok(true),
                _ => Err(fail("unsafe-file")),
            }
        }
        Err(error) => Err(fail(io_code(&error))),
    }
}

/// État d'un fichier du journal sans suivre de lien : absent, fichier ordinaire (taille), ou refusé.
fn plain_file_len(path: &Path) -> Result<Option<u64>, LogError> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_file() => Ok(Some(meta.len())),
        Ok(_) => Err(fail("unsafe-file")),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(fail(io_code(&error))),
    }
}

/// Ouvre un fichier du journal sans suivre de lien (`O_NOFOLLOW` sous Unix, point d'analyse refusé sous Windows), puis revérifie sur le
/// descripteur qu'il s'agit d'un fichier ordinaire.
fn open_no_follow(path: &Path, options: &mut OpenOptions) -> Result<File, LogError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // FILE_FLAG_OPEN_REPARSE_POINT : un lien est ouvert lui-même, puis refusé ci-dessous.
        options.custom_flags(0x0020_0000);
    }
    let file = options.open(path).map_err(|error| {
        #[cfg(unix)]
        if error.raw_os_error() == Some(libc::ELOOP) {
            return fail("unsafe-file");
        }
        fail(io_code(&error))
    })?;
    let meta = file.metadata().map_err(|e| fail(io_code(&e)))?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return Err(fail("unsafe-file"));
        }
    }
    if !meta.is_file() {
        return Err(fail("unsafe-file"));
    }
    Ok(file)
}

/// Ajoute des lignes en fin de `spartiate.log`, avec rotation : si taille actuelle + ligne dépasse 256 Kio, le fichier devient `.1` (l'ancien
/// `.1` est remplacé) et un nouveau fichier est créé.
pub fn append_lines(dir: &Path, lines: &[String]) -> Result<usize, LogError> {
    if lines.is_empty() {
        return Ok(0);
    }
    ensure_dir(dir, true)?;
    let current = dir.join(CURRENT_FILE);
    let previous = dir.join(PREVIOUS_FILE);
    let mut written = 0;
    for line in lines {
        let size = plain_file_len(&current)?.unwrap_or(0);
        let needed = line.len() as u64 + 1;
        let mut restart = false;
        if size > 0 && size + needed > MAX_FILE_BYTES {
            plain_file_len(&previous)?;
            restart = !rotate(&current, &previous);
        }
        let mut options = OpenOptions::new();
        if restart {
            // FIX-CONFID-IOS (C-140) : rotation impossible (`.1` verrouillé) : le fichier courant est vidé plutôt que de bloquer toute
            // écriture ; sa première ligne le dit (`log` / `rotation-failed`). Le journal reste borné à 2 × 256 Kio.
            options.write(true).truncate(true);
        } else {
            options.append(true).create(true);
        }
        let mut file = open_no_follow(&current, &mut options)?;
        let mut bytes = Vec::new();
        if restart {
            bytes.extend(line_of(&rotation_failed_entry()).into_bytes());
            bytes.push(b'\n');
        }
        bytes.extend(line.as_bytes());
        bytes.push(b'\n');
        file.write_all(&bytes).map_err(|e| fail(io_code(&e)))?;
        written += 1;
    }
    Ok(written)
}

/// Rotation : `spartiate.log` devient `.1`. Un renommage refusé (`.1` ouvert sans partage de suppression sous Windows) est retenté une
/// fois après suppression de l'ancien `.1` ; `false` si la rotation reste impossible.
fn rotate(current: &Path, previous: &Path) -> bool {
    if fs::rename(current, previous).is_ok() {
        return true;
    }
    let _ = fs::remove_file(previous);
    fs::rename(current, previous).is_ok()
}

/// Première entrée d'un fichier courant vidé faute de rotation.
fn rotation_failed_entry() -> LogEntry {
    LogEntry {
        at: iso_of(now_secs()),
        scope: "log".to_owned(),
        code: "rotation-failed".to_owned(),
        detail: String::new(),
        n: None,
    }
}

/// Lit un fichier du journal (borné à 1 Mio), UTF-8 avec remplacement ; absent : vide.
fn read_file(path: &Path) -> Result<String, LogError> {
    if plain_file_len(path)?.is_none() {
        return Ok(String::new());
    }
    let file = open_no_follow(path, OpenOptions::new().read(true))?;
    let mut bytes = Vec::new();
    file.take(MAX_READ_BYTES)
        .read_to_end(&mut bytes)
        .map_err(|_| fail("unreadable"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Les `max` dernières entrées (`.1` puis courant, plus récente en dernier). Une ligne qui n'est pas une entrée devient `log` /
/// `unreadable-line` (heure de l'entrée précédente), jamais une panique.
pub fn read_entries(dir: &Path, max: usize) -> Result<Vec<LogEntry>, LogError> {
    if !ensure_dir(dir, false)? {
        return Ok(Vec::new());
    }
    let mut entries: Vec<LogEntry> = Vec::new();
    for name in [PREVIOUS_FILE, CURRENT_FILE] {
        let text = read_file(&dir.join(name))?;
        for line in text.lines().filter(|l| !l.trim().is_empty()) {
            let parsed = serde_json::from_str::<LogEntry>(line)
                .ok()
                .filter(|e| is_scope(&e.scope) && is_code(&e.code));
            let entry = parsed.unwrap_or_else(|| LogEntry {
                at: entries
                    .last()
                    .map_or_else(|| iso_of(now_secs()), |e| e.at.clone()),
                scope: "log".to_owned(),
                code: "unreadable-line".to_owned(),
                detail: String::new(),
                n: None,
            });
            entries.push(entry);
        }
    }
    let skip = entries.len().saturating_sub(max.clamp(1, MAX_READ_ENTRIES));
    Ok(entries.split_off(skip))
}

/// Supprime les deux fichiers (un lien est supprimé lui-même, jamais sa cible).
pub fn clear_files(dir: &Path) -> Result<(), LogError> {
    if !ensure_dir(dir, false)? {
        return Ok(());
    }
    for name in [CURRENT_FILE, PREVIOUS_FILE] {
        match fs::remove_file(dir.join(name)) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(fail(io_code(&error))),
        }
    }
    Ok(())
}

// ------------------------------------------------------------------------------------------------------------------------------
// Limitation de débit
// ------------------------------------------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Default)]
struct Rate {
    minute: u64,
    count: u32,
    suppressed: u32,
}

/// Compteurs par couple (`scope`, `code`) et par minute (256 couples au plus), et plafond global de la minute.
#[derive(Debug, Default)]
pub struct RateTable {
    rates: BTreeMap<(String, String), Rate>,
    /// Minute du plafond global, entrées admises et entrées refusées par lui.
    minute: u64,
    total: u32,
    capped: u32,
}

impl RateTable {
    pub const fn new() -> Self {
        Self {
            rates: BTreeMap::new(),
            minute: 0,
            total: 0,
            capped: 0,
        }
    }

    /// Couples suivis (tests : la table reste bornée).
    pub fn len(&self) -> usize {
        self.rates.len()
    }

    /// La table est-elle vide ?
    pub fn is_empty(&self) -> bool {
        self.rates.is_empty()
    }

    /// Résumés des minutes passées (`log` / `suppressed`, `n`), à écrire avant les nouvelles entrées.
    fn summaries(&mut self, minute: u64, now_iso: &str) -> Vec<LogEntry> {
        let mut out = Vec::new();
        for ((scope, code), rate) in &mut self.rates {
            if rate.minute < minute && rate.suppressed > 0 {
                out.push(LogEntry {
                    at: now_iso.to_owned(),
                    scope: "log".to_owned(),
                    code: "suppressed".to_owned(),
                    detail: format!("{scope} {code}"),
                    n: Some(rate.suppressed),
                });
                rate.suppressed = 0;
            }
        }
        self.rates
            .retain(|_, rate| rate.minute >= minute || rate.suppressed > 0);
        if self.minute < minute {
            if self.capped > 0 {
                out.push(LogEntry {
                    at: now_iso.to_owned(),
                    scope: "log".to_owned(),
                    code: "rate-capped".to_owned(),
                    detail: String::new(),
                    n: Some(self.capped),
                });
            }
            self.minute = minute;
            self.total = 0;
            self.capped = 0;
        }
        out
    }

    /// L'entrée peut-elle être écrite cette minute ? Sinon elle est comptée.
    fn admit(&mut self, entry: &LogEntry, minute: u64) -> bool {
        if entry.scope == "log" && matches!(entry.code.as_str(), "suppressed" | "rate-capped") {
            return true;
        }
        let weight = entry.n.unwrap_or(1);
        let key = (entry.scope.clone(), entry.code.clone());
        // Table pleine : un couple nouveau n'est pas suivi (seul le plafond global le limite) ; jamais plus de 256 couples.
        if self.rates.contains_key(&key) || self.rates.len() < MAX_RATE_KEYS {
            let rate = self.rates.entry(key).or_default();
            if rate.minute != minute {
                rate.minute = minute;
                rate.count = 0;
            }
            if rate.count >= RATE_PER_MINUTE {
                rate.suppressed = rate.suppressed.saturating_add(weight);
                return false;
            }
            if self.total >= GLOBAL_PER_MINUTE {
                self.capped = self.capped.saturating_add(weight);
                return false;
            }
            rate.count += 1;
        } else if self.total >= GLOBAL_PER_MINUTE {
            self.capped = self.capped.saturating_add(weight);
            return false;
        }
        self.total += 1;
        true
    }
}

/// Filtre une suite d'entrées par la limitation de débit et y ajoute les résumés des minutes passées ; rend les lignes à écrire.
pub fn admit_lines(rates: &mut RateTable, entries: &[LogEntry], now: u64) -> Vec<String> {
    let minute = now / 60;
    let now_iso = iso_of(now);
    let mut lines: Vec<String> = rates
        .summaries(minute, &now_iso)
        .iter()
        .map(line_of)
        .collect();
    lines.extend(
        entries
            .iter()
            .filter(|e| rates.admit(e, minute))
            .map(line_of),
    );
    lines
}

// ------------------------------------------------------------------------------------------------------------------------------
// État du processus
// ------------------------------------------------------------------------------------------------------------------------------

struct State {
    dir: Option<PathBuf>,
    pending: Vec<LogEntry>,
    write_error: Option<&'static str>,
    rates: RateTable,
}

static STATE: Mutex<State> = Mutex::new(State {
    dir: None,
    pending: Vec::new(),
    write_error: None,
    rates: RateTable::new(),
});

fn state() -> std::sync::MutexGuard<'static, State> {
    STATE
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Copie sur la sortie d'erreur (développement et `test-hooks` seulement) : **le seul `eprintln!` du code**.
pub fn echo(line: &str) {
    #[cfg(any(debug_assertions, feature = "test-hooks"))]
    eprintln!("{line}");
    #[cfg(not(any(debug_assertions, feature = "test-hooks")))]
    let _ = line;
}

fn record_outcome(state: &mut State, outcome: &Result<usize, LogError>) {
    match outcome {
        Ok(_) => state.write_error = None,
        Err(error) => state.write_error = Some(error.code),
    }
}

/// Fixe le dossier du journal (`<app_config_dir>/logs`, début du `setup` PC et iPhone) et écrit les entrées internes en attente.
pub fn init(dir: PathBuf) {
    let mut state = state();
    let pending = std::mem::take(&mut state.pending);
    let lines = admit_lines(&mut state.rates, &pending, now_secs());
    let outcome = append_lines(&dir, &lines);
    record_outcome(&mut state, &outcome);
    state.dir = Some(dir);
}

/// Tests seulement (`test-hooks`) : état du processus remis à neuf (dossier, entrées en attente, débit). Les tests d'un même processus
/// partagent cet état : sans remise à zéro, les entrées notées AVANT `init` par d'autres tests (file `pending`) sont versées dans le dossier
/// du test qui appelle `init`. À appeler sous `support::applog_dir_lock()`.
#[cfg(feature = "test-hooks")]
pub fn reset_for_tests() {
    let mut state = state();
    state.dir = None;
    state.pending.clear();
    state.write_error = None;
    state.rates = RateTable::new();
}

/// Écriture interne à Rust : deux identifiants fixes, aucun texte dynamique. Avant `init`, gardée en mémoire (100 au plus).
pub fn write(scope: &'static str, code: &'static str) {
    write_entry(scope, code, None);
}

/// Comme `write`, avec un compteur (`n`, par exemple le nombre de temporaires purgés) : toujours aucun texte dynamique.
pub fn write_count(scope: &'static str, code: &'static str, count: u32) {
    write_entry(scope, code, Some(count));
}

fn write_entry(scope: &'static str, code: &'static str, count: Option<u32>) {
    echo(&format!("[{scope}] {code}"));
    let entry = LogEntry {
        at: iso_of(now_secs()),
        scope: scope.to_owned(),
        code: code.to_owned(),
        detail: String::new(),
        n: count,
    };
    let mut state = state();
    let Some(dir) = state.dir.clone() else {
        if state.pending.len() >= MAX_PENDING {
            state.pending.remove(0);
        }
        state.pending.push(entry);
        return;
    };
    let lines = admit_lines(&mut state.rates, &[entry], now_secs());
    let outcome = append_lines(&dir, &lines);
    record_outcome(&mut state, &outcome);
}

/// Dernier échec d'écriture du processus (`None` après une écriture réussie).
pub fn write_error() -> Option<&'static str> {
    state().write_error
}

/// Réponse de `log_append`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendOutcome {
    pub written: usize,
    pub write_error: Option<&'static str>,
}

/// Réponse de `log_read`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadOutcome {
    pub entries: Vec<LogEntry>,
    pub write_error: Option<&'static str>,
    /// FIX-CONFID-IOS (C-152) : échec de l'exclusion de la sauvegarde iCloud au démarrage (iPhone), dit dans Plus › À propos et diagnostic.
    pub backup_exclusion: Option<&'static str>,
}

/// Réponse de `log_clear`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ClearOutcome {
    pub cleared: bool,
}

/// `log_append` sur un dossier donné (tests) : au plus 100 entrées (`too-many`, rien n'est écrit), normalisées, limitées, écrites.
pub fn append_in(
    dir: &Path,
    rates: &mut RateTable,
    entries: &[LogEntryIn],
    now: u64,
) -> Result<usize, LogError> {
    if entries.len() > MAX_APPEND_ENTRIES {
        return Err(fail("too-many"));
    }
    let now_iso = iso_of(now);
    let normalized: Vec<LogEntry> = entries
        .iter()
        .map(|e| {
            let mut entry = normalize(e, &now_iso);
            // FIX-CONFID-IOS (C-140) : la WebView n'écrit jamais sous un scope de Rust (résumés, synchro Rust, récupération, exclusion).
            if RUST_ONLY_SCOPES.contains(&entry.scope.as_str()) {
                "invalid".clone_into(&mut entry.scope);
            }
            entry
        })
        .collect();
    let lines = admit_lines(rates, &normalized, now);
    append_lines(dir, &lines)
}

/// `log_clear` sur un dossier donné (tests) : supprime les deux fichiers, puis écrit `logs` / `logs-cleared` en première entrée.
pub fn clear_in(dir: &Path, now: u64) -> Result<(), LogError> {
    clear_files(dir)?;
    let entry = LogEntry {
        at: iso_of(now),
        scope: "logs".to_owned(),
        code: "logs-cleared".to_owned(),
        detail: String::new(),
        n: None,
    };
    append_lines(dir, &[line_of(&entry)]).map(|_| ())
}

/// Dossier du journal : celui fixé par `init` (iPhone : `Documents/Journal`, visible dans Fichiers), sinon `fallback`. Un seul dossier pour
/// les écritures internes de Rust et pour `log_append`, `log_read`, `log_clear` : le fichier exporté contient les deux journaux (I5-05).
pub fn journal_dir(fallback: PathBuf) -> PathBuf {
    state().dir.clone().unwrap_or(fallback)
}

fn logs_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, LogError> {
    use tauri::Manager;
    app.path()
        .app_config_dir()
        .map(|dir| journal_dir(dir.join(LOG_DIR)))
        .map_err(|_| fail("io"))
}

/// Ajoute des entrées de la WebView (100 au plus, hors du fil de l'interface).
#[tauri::command]
pub async fn log_append(
    app: tauri::AppHandle,
    entries: Vec<LogEntryIn>,
) -> Result<AppendOutcome, LogError> {
    if entries.len() > MAX_APPEND_ENTRIES {
        return Err(fail("too-many"));
    }
    let dir = logs_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut state = state();
        let outcome = append_in(&dir, &mut state.rates, &entries, now_secs());
        record_outcome(&mut state, &outcome);
        outcome.map(|written| AppendOutcome {
            written,
            write_error: state.write_error,
        })
    })
    .await
    .map_err(|_| fail("io"))?
}

/// Les `max` dernières entrées (1 à 2 000) et le dernier échec d'écriture.
#[tauri::command]
pub async fn log_read(app: tauri::AppHandle, max: usize) -> Result<ReadOutcome, LogError> {
    let dir = logs_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = state();
        let entries = read_entries(&dir, max.clamp(1, MAX_READ_ENTRIES))?;
        Ok(ReadOutcome {
            entries,
            write_error: state.write_error,
            backup_exclusion: crate::backup_exclusion::status(),
        })
    })
    .await
    .map_err(|_| fail("io"))?
}

/// Efface le journal (après confirmation dans l'interface).
#[tauri::command]
pub async fn log_clear(app: tauri::AppHandle) -> Result<ClearOutcome, LogError> {
    let dir = logs_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut state = state();
        let outcome = clear_in(&dir, now_secs()).map(|()| 1);
        record_outcome(&mut state, &outcome);
        outcome.map(|_| ClearOutcome { cleared: true })
    })
    .await
    .map_err(|_| fail("io"))?
}
