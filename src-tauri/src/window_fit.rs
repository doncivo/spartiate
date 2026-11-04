//! Taille et position de la fenêtre principale dans la zone de travail du moniteur (SPA-009, critère 2).
//!
//! Calcul pur, en unités LOGIQUES (indépendantes de la mise à l'échelle DPI) : la zone de travail physique du moniteur (barre des tâches
//! exclue) est convertie par `logical_work_area`, puis `fit_window` ajuste la taille voulue (1 440 × 900) pour qu'elle tienne, centrée,
//! sans jamais passer sous le minimum 1 024 × 700. Si la zone utile est trop petite, le minimum n'est PAS abaissé : `Fit::TooSmall`
//! signale la limite (journal technique) et la configuration d'origine est gardée, pour que l'utilisateur tranche.
//! `clamp_into_work_areas` ramène dans un moniteur existant une position restaurée devenue hors écran (moniteur débranché).

/// Largeur minimale de la fenêtre (contenu), en pixels logiques : `minWidth` de `tauri.windows.conf.json`.
pub const MIN_WIDTH: f64 = 1024.0;
/// Hauteur minimale de la fenêtre (contenu), en pixels logiques : `minHeight` de `tauri.windows.conf.json`.
pub const MIN_HEIGHT: f64 = 700.0;
/// Taille initiale voulue (contenu), en pixels logiques.
pub const DEFAULT_WIDTH: f64 = 1440.0;
pub const DEFAULT_HEIGHT: f64 = 900.0;
/// Cadre ajouté autour du contenu par Windows (bordures, barre de titre), en pixels logiques : réservé dans la zone de travail.
pub const FRAME_WIDTH: f64 = 16.0;
pub const FRAME_HEIGHT: f64 = 39.0;
/// Partie de la barre de titre qui doit rester visible pour qu'une position restaurée soit gardée.
const VISIBLE_TITLE_WIDTH: f64 = 200.0;
const VISIBLE_TITLE_HEIGHT: f64 = 32.0;

/// Rectangle en pixels logiques.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Résultat d'un ajustement : un rectangle de CONTENU (position de la fenêtre comprise) ou la limite constatée.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Fit {
    Fits(LogicalRect),
    /// La zone de travail disponible (largeur et hauteur logiques) est inférieure au minimum plus le cadre.
    TooSmall {
        width: f64,
        height: f64,
    },
}

/// Zone de travail physique d'un moniteur (position et taille en pixels physiques, barre des tâches exclue) en pixels logiques.
pub fn logical_work_area(position: (i32, i32), size: (u32, u32), scale_factor: f64) -> LogicalRect {
    let scale = if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    LogicalRect {
        x: f64::from(position.0) / scale,
        y: f64::from(position.1) / scale,
        width: f64::from(size.0) / scale,
        height: f64::from(size.1) / scale,
    }
}

/// Taille de contenu et position (coin de la fenêtre) pour la zone de travail `work` : la taille voulue réduite à ce qui tient, au plus
/// jusqu'au minimum, centrée. Zone trop petite : `Fit::TooSmall`, rien n'est abaissé.
pub fn fit_window(work: LogicalRect, desired: (f64, f64)) -> Fit {
    let room_w = work.width - FRAME_WIDTH;
    let room_h = work.height - FRAME_HEIGHT;
    if room_w < MIN_WIDTH || room_h < MIN_HEIGHT {
        return Fit::TooSmall {
            width: work.width,
            height: work.height,
        };
    }
    let width = desired.0.min(room_w).max(MIN_WIDTH);
    let height = desired.1.min(room_h).max(MIN_HEIGHT);
    Fit::Fits(LogicalRect {
        x: work.x + (work.width - (width + FRAME_WIDTH)) / 2.0,
        y: work.y + (work.height - (height + FRAME_HEIGHT)) / 2.0,
        width,
        height,
    })
}

fn overlap(a: (f64, f64), b: (f64, f64)) -> f64 {
    (a.1.min(b.1) - a.0.max(b.0)).max(0.0)
}

/// Position restaurée `rect` (contenu) : gardée si la barre de titre reste assez visible dans une zone de travail, sinon recentrée dans la
/// première zone qui peut la contenir. Aucune zone assez grande : `Fit::TooSmall` (la plus grande zone connue est rapportée).
pub fn clamp_into_work_areas(rect: LogicalRect, areas: &[LogicalRect]) -> Fit {
    for area in areas {
        let visible_w = overlap(
            (rect.x, rect.x + rect.width + FRAME_WIDTH),
            (area.x, area.x + area.width),
        );
        let visible_h = overlap(
            (rect.y, rect.y + VISIBLE_TITLE_HEIGHT),
            (area.y, area.y + area.height),
        );
        let holds_minimum = matches!(fit_window(*area, (MIN_WIDTH, MIN_HEIGHT)), Fit::Fits(_));
        if holds_minimum && visible_w >= VISIBLE_TITLE_WIDTH && visible_h >= VISIBLE_TITLE_HEIGHT {
            return Fit::Fits(rect);
        }
    }
    let mut largest = (0.0_f64, 0.0_f64);
    for area in areas {
        if let fitted @ Fit::Fits(_) = fit_window(*area, (rect.width, rect.height)) {
            return fitted;
        }
        if area.width * area.height > largest.0 * largest.1 {
            largest = (area.width, area.height);
        }
    }
    Fit::TooSmall {
        width: largest.0,
        height: largest.1,
    }
}
