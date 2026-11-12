import { parseDecimal } from '../bodyProfile';
import { isLocalDate, type LocalDate } from '../types';

/**
 * Corps (I6-02, § 17.1) : mensurations en centimètres et nom de fichier des photos de progression. Règles pures, sans accès base ni plateforme.
 *
 * - Liste FERMÉE de mensurations (`MEASUREMENT_KINDS`), libellés dans `src/i18n`. Une version plus récente peut en ajouter ; SQL et catalogue ne fixent
 *   pas la liste (un genre inconnu reçu reste lisible mais n'est pas affiché).
 * - Bornes plausibles par genre (`MEASUREMENT_BOUNDS_CM`, incluses), plafond absolu commun aux CHECK de la base (`MEASUREMENT_MAX_ABSOLUTE_CM`).
 */

export const MEASUREMENT_KINDS = ['neck', 'shoulders', 'chest', 'waist', 'hips', 'arm_left', 'arm_right', 'thigh_left', 'thigh_right', 'calf_left', 'calf_right'] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

export const isMeasurementKind = (value: string): value is MeasurementKind => (MEASUREMENT_KINDS as readonly string[]).includes(value);

/** Plafond absolu de toute mensuration (cm, exclu) : le CHECK SQL de la migration 0012 (`value < 1000`) et le catalogue de synchro le portent aussi. */
export const MEASUREMENT_MAX_ABSOLUTE_CM = 1000;

const bounds = (min: number, max: number) => ({ min, max }) as const;
/** Bornes plausibles, en centimètres, incluses. Hors bornes : refus avec le message de la plage (jamais une valeur corrigée en silence). */
export const MEASUREMENT_BOUNDS_CM: Readonly<Record<MeasurementKind, { readonly min: number; readonly max: number }>> = {
  neck: bounds(20, 70),
  shoulders: bounds(70, 200),
  chest: bounds(60, 200),
  waist: bounds(40, 200),
  hips: bounds(60, 200),
  arm_left: bounds(15, 70),
  arm_right: bounds(15, 70),
  thigh_left: bounds(30, 110),
  thigh_right: bounds(30, 110),
  calf_left: bounds(20, 70),
  calf_right: bounds(20, 70),
};

export type MeasurementIssue = 'empty' | 'format' | 'range' | 'date' | 'future';
export type MeasurementValidation = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly reason: MeasurementIssue };

/** Valide une saisie (virgule ou point) : vide, illisible, hors bornes du genre, date impossible ou future sont refusés. */
export function validateMeasurement(kind: MeasurementKind, text: string, date: LocalDate, today: LocalDate): MeasurementValidation {
  if (!isLocalDate(date)) return { ok: false, reason: 'date' };
  if (date > today) return { ok: false, reason: 'future' };
  if (text.trim() === '') return { ok: false, reason: 'empty' };
  const value = parseDecimal(text);
  if (value === null) return { ok: false, reason: 'format' };
  const { min, max } = MEASUREMENT_BOUNDS_CM[kind];
  return value >= min && value <= max ? { ok: true, value } : { ok: false, reason: 'range' };
}

/** Une valeur est-elle acceptable pour ce genre (dépôt) ? Mêmes bornes que la saisie. */
export const isMeasurementValue = (kind: MeasurementKind, value: number): boolean => Number.isFinite(value) && value >= MEASUREMENT_BOUNDS_CM[kind].min && value <= MEASUREMENT_BOUNDS_CM[kind].max;

export interface MeasurementPoint {
  readonly date: LocalDate;
  readonly value: number;
}
export interface MeasurementChange {
  readonly from: LocalDate;
  readonly to: LocalDate;
  /** Dernière mesure moins la précédente, arrondie à 0,1 cm. */
  readonly delta: number;
}

/** Changement entre les deux dernières mesures d'un genre ; `null` sans deux mesures (jamais un faux zéro). */
export function measurementChange(points: readonly MeasurementPoint[]): MeasurementChange | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const previous = sorted[sorted.length - 2];
  const last = sorted[sorted.length - 1];
  if (!previous || !last) return null;
  return { from: previous.date, to: last.date, delta: Math.round((last.value - previous.value) * 10) / 10 };
}

/** Longueur maximale du nom de fichier d'une photo : le CHECK SQL de la migration 0012 (64) la porte aussi. */
export const PHOTO_FILE_NAME_MAX = 64;
/** Taille maximale d'une photo réduite enregistrée (octets) ; la table locale borne le texte codé (3 000 000 caractères) au-dessus. */
export const PHOTO_MAX_BYTES = 2_000_000;
/** Plus grand côté (pixels) d'une photo après réduction. */
export const PHOTO_MAX_EDGE_PX = 1600;

const PHOTO_FILE_RE = /^[0-9A-Za-z_-]+\.jpg$/;

/** Nom de fichier d'une photo : son identifiant et `.jpg` (jamais un chemin). */
export const photoFileName = (id: string): string => `${id}.jpg`;

export const isPhotoFileName = (name: string): boolean => name.length <= PHOTO_FILE_NAME_MAX && PHOTO_FILE_RE.test(name);

/** Un fichier est-il un JPEG (marque de début 0xFF 0xD8) ? Seule vérification faite : l'image est produite par l'app (réduite, recodée en JPEG). */
export const looksLikeJpeg = (bytes: Uint8Array): boolean => bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;

/** Taille d'une photo après réduction : le plus grand côté ne dépasse pas `PHOTO_MAX_EDGE_PX`, proportions gardées ; `null` si une dimension est invalide. */
export function photoTargetSize(width: number, height: number): { readonly width: number; readonly height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const scale = Math.min(1, PHOTO_MAX_EDGE_PX / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Mesures importées de Santé (I6-04, D-113) : même table `measurement`, genres propres à la source, aucune migration.
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Genres écrits seulement par l'import des fichiers Renpho / Santé : le préfixe `health_` est la SOURCE dans la clé stable (date, genre, source),
 * si bien qu'une mesure manuelle de la même zone n'est jamais remplacée. Le SQL ne fixe que le format du genre (`[a-z_]`, 32 caractères au plus).
 * Unités : pourcentage, kilogrammes, centimètres, grammes (dans le nom). Jamais affichés comme des zones saisies (`MEASUREMENT_KINDS`).
 */
export const HEALTH_METRIC_KINDS = ['health_body_fat_pct', 'health_lean_mass_kg', 'health_waist_cm', 'health_height_cm', 'health_fiber_g'] as const;
export type HealthMetricKind = (typeof HEALTH_METRIC_KINDS)[number];

/** Bornes de plausibilité de chaque genre importé (incluses) ; mêmes valeurs que `BODY_BOUNDS` de l'import, fibres par jour comprises. */
export const HEALTH_METRIC_BOUNDS: Readonly<Record<HealthMetricKind, { readonly min: number; readonly max: number }>> = {
  health_body_fat_pct: bounds(3, 60),
  health_lean_mass_kg: bounds(15, 200),
  health_waist_cm: bounds(40, 200),
  health_height_cm: bounds(100, 250),
  health_fiber_g: bounds(0, 300),
};

export const isHealthMetricKind = (value: string): value is HealthMetricKind => (HEALTH_METRIC_KINDS as readonly string[]).includes(value);

/** Genre de mesure stocké : une zone saisie ou un genre importé de Santé. */
export type StoredMeasurementKind = MeasurementKind | HealthMetricKind;
export const isStoredMeasurementKind = (value: string): value is StoredMeasurementKind => isMeasurementKind(value) || isHealthMetricKind(value);

/** Unité de la valeur stockée, par genre (FIX-0173, constat 4 : l'export complet la dit ligne par ligne ; la valeur stockée ne change jamais). */
export type MeasurementUnit = 'cm' | 'pct' | 'kg' | 'g';
const HEALTH_METRIC_UNITS: Readonly<Record<HealthMetricKind, MeasurementUnit>> = { health_body_fat_pct: 'pct', health_lean_mass_kg: 'kg', health_waist_cm: 'cm', health_height_cm: 'cm', health_fiber_g: 'g' };
export const MEASUREMENT_UNITS: Readonly<Record<StoredMeasurementKind, MeasurementUnit>> = {
  ...(Object.fromEntries(MEASUREMENT_KINDS.map((k) => [k, 'cm'])) as Record<MeasurementKind, 'cm'>),
  ...HEALTH_METRIC_UNITS,
};
/** Unité d'un genre ; genre inconnu (appareil plus récent) : `null`, jamais une unité supposée. */
export const measurementUnit = (kind: string): MeasurementUnit | null => (isStoredMeasurementKind(kind) ? MEASUREMENT_UNITS[kind] : null);

/** Bornes d'un genre stocké (zone ou importé). */
export const storedMeasurementBounds = (kind: StoredMeasurementKind): { readonly min: number; readonly max: number } => (isMeasurementKind(kind) ? MEASUREMENT_BOUNDS_CM[kind] : HEALTH_METRIC_BOUNDS[kind]);

export const isStoredMeasurementValue = (kind: StoredMeasurementKind, value: number): boolean => {
  const { min, max } = storedMeasurementBounds(kind);
  return Number.isFinite(value) && value >= min && value <= max;
};
