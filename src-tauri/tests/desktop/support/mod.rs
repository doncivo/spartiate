//! Outils partagés des tests (faux du plugin folder-bookmark, ADR 0011 §22).

/// `applog::init` fixe un dossier de journal pour TOUT le processus de test : les tests qui l'appellent puis relisent le journal prennent ce
/// verrou pour qu'aucun autre ne redirige le journal entre l'écriture et la relecture.
pub static APPLOG_DIR_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub fn applog_dir_lock() -> std::sync::MutexGuard<'static, ()> {
    let guard = APPLOG_DIR_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    // Journal propre au test qui prend le verrou : ni dossier, ni entrées en attente, ni débit laissés par les tests précédents du processus.
    spartiate_lib::applog::reset_for_tests();
    guard
}

pub mod fake_bookmark;
pub mod fault_plan;
pub mod http_mock;

/// Normalisation pour les tests qui lisent le code source : sans espaces ni retours à la ligne, et sans virgule finale avant une fermeture
/// (rustfmt coupe les lignes et en ajoute). Les motifs vérifiés restent exactement les mêmes.
pub fn sq(s: &str) -> String {
    let compact: String = s.chars().filter(|c| !c.is_whitespace()).collect();
    let mut out = String::with_capacity(compact.len());
    let chars: Vec<char> = compact.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        if *c == ',' && matches!(chars.get(i + 1), Some(')' | '}' | ']' | '>')) {
            continue;
        }
        out.push(*c);
    }
    out
}

/// `haystack` contient `needle`, à la mise en forme près.
pub fn has(haystack: &str, needle: &str) -> bool {
    sq(haystack).contains(&sq(needle))
}

/// Début de l'instruction qui contient la ligne `i` : on remonte tant que la ligne est une continuation de chaîne (`.appel(…)`).
pub fn stmt_start(lines: &[&str], i: usize) -> usize {
    let mut j = i;
    while j > 0 && lines[j].trim_start().starts_with('.') {
        j -= 1;
    }
    j
}

/// Ligne (rognée) qui précède l'instruction contenant la ligne `i` : l'attribut `#[cfg(…)]`.
pub fn stmt_attr<'a>(lines: &[&'a str], i: usize) -> &'a str {
    lines[stmt_start(lines, i) - 1].trim()
}

/// Texte de l'instruction contenant la ligne `i`, du début jusqu'au `;` final.
pub fn stmt_text(lines: &[&str], i: usize) -> String {
    let start = stmt_start(lines, i);
    let mut text = String::new();
    for line in &lines[start..] {
        text.push_str(line);
        text.push('\n');
        if line.trim_end().ends_with(';') {
            break;
        }
    }
    text
}

/// Position (octet) du saut de ligne qui précède la première ligne dont le contenu rogné est `]);` : fin d'un bloc, quelle que soit l'indentation.
pub fn block_end(s: &str) -> Option<usize> {
    let mut offset = 0;
    for line in s.split_inclusive('\n') {
        if line.trim() == "]);" && offset > 0 {
            return Some(offset - 1);
        }
        offset += line.len();
    }
    None
}
