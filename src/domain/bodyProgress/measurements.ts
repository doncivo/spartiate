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
