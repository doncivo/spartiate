/**
 * Identifiants déterministes de la base neuve (ADR 0011, section 8 ; D-55, D-65).
 *
 * Deux appareils qui créent « la même » ligne doivent lui donner le même identifiant, sinon la fusion par ligne en ferait deux :
 * - `profile` : une seule ligne, `profile|singleton` ;
 * - `body_weight` : une pesée par jour et par origine, `weight|AAAA-MM-JJ|source` (`manual` ou `health`).
 *
 * Aucun repli UUID (D-65). Les CHECK SQL de la migration 0001 portent les mêmes formes. Module pur.
 */

import type { LocalDate } from '../types';
import { isLocalDate } from '../types';

export const PROFILE_ID = 'profile|singleton';

export type WeightSource = 'manual' | 'health';

const WEIGHT_RE = /^weight\|(\d{4}-\d{2}-\d{2})\|(manual|health)$/;

/** Identifiant de la pesée d'un jour et d'une origine. */
export function weightId(date: LocalDate, source: WeightSource): string {
  return `weight|${date}|${source}`;
}

export function isProfileId(id: string): boolean {
  return id === PROFILE_ID;
}

export function isWeightId(id: string): boolean {
  const m = WEIGHT_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'une pesée de ces valeurs (cohérence d'une recréation reçue, section 5.4), ou null si `date` ou `source` manquent. */
export function expectedWeightId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  const source = row.get('source');
  return typeof date === 'string' && (source === 'manual' || source === 'health') ? `weight|${date}|${source}` : null;
}

/**
 * I2-01 (PR 2/2) : `progression_profile`, un profil par exercice, `progression|<exercice>` (identifiant embarqué en kebab-case ou UUID d'un
 * exercice personnalisé, sans `|`), au plus `PROGRESSION_EXERCISE_ID_MAX` caractères : `progression|` + 116 = 128 = `MAX_SYNC_ID_LENGTH`
 * (relecture sync-icloud R1).
 */
export const PROGRESSION_EXERCISE_ID_MAX = 116;
const PROGRESSION_RE = /^progression\|([^|]{1,116})$/;

/** Identifiant d'exercice admis dans un profil publiable. */
export const isProgressionExerciseId = (exerciseId: string): boolean => exerciseId.length >= 1 && exerciseId.length <= PROGRESSION_EXERCISE_ID_MAX && !exerciseId.includes('|');

export function progressionId(exerciseId: string): string {
  return `progression|${exerciseId}`;
}

export function isProgressionId(id: string): boolean {
  return PROGRESSION_RE.test(id);
}

/** Identifiant attendu d'un profil de ces valeurs, ou null si `exercise_id` manque ou est mal formé. */
export function expectedProgressionId(row: ReadonlyMap<string, unknown>): string | null {
  const exercise = row.get('exercise_id');
  return typeof exercise === 'string' && isProgressionExerciseId(exercise) ? progressionId(exercise) : null;
}

/**
 * I4-07 : `day_completeness`, une déclaration par date locale, `day|AAAA-MM-JJ` (D-81). Aucun repli UUID : deux appareils qui déclarent le
 * même jour écrivent la même ligne. Le CHECK SQL de la migration 0009 porte la même forme.
 */
const DAY_COMPLETENESS_RE = /^day\|(\d{4}-\d{2}-\d{2})$/;

export function dayCompletenessId(date: LocalDate): string {
  return `day|${date}`;
}

export function isDayCompletenessId(id: string): boolean {
  const m = DAY_COMPLETENESS_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'une déclaration de ces valeurs, ou null si `date` manque ou est mal formée. */
export function expectedDayCompletenessId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  return typeof date === 'string' && isLocalDate(date) ? `day|${date}` : null;
}

/**
 * I5-01 (§ 16.4, § 20.2) : résumés de récupération, écrits par l'iPhone seul. `recovery_day` : une ligne par date locale,
 * `recovery|AAAA-MM-JJ` ; `muscle_recovery` : une par date et muscle, `muscle|AAAA-MM-JJ|<muscle>` (muscle de 1 à 64 caractères, sans `|`).
 * Aucun repli UUID : un recalcul du même jour écrit la même ligne. Les CHECK SQL de la migration 0010 portent les mêmes formes.
 */
const RECOVERY_FACTOR_RE = /^recovery_factor\|(\d{4}-\d{2}-\d{2})$/;
const RECOVERY_DAY_RE = /^recovery\|(\d{4}-\d{2}-\d{2})$/;
export const MUSCLE_RECOVERY_MUSCLE_ID_MAX = 64;
const MUSCLE_RECOVERY_RE = /^muscle\|(\d{4}-\d{2}-\d{2})\|([^|]{1,64})$/;

export function recoveryDayId(date: LocalDate): string {
  return `recovery|${date}`;
}

export function isRecoveryDayId(id: string): boolean {
  const m = RECOVERY_DAY_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'un résumé de ces valeurs, ou null si `date` manque ou est mal formée. */
export function expectedRecoveryDayId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  return typeof date === 'string' && isLocalDate(date) ? recoveryDayId(date) : null;
}

/** Identifiant de muscle admis dans une ligne publiable. */
export const isMuscleRecoveryMuscleId = (muscleId: string): boolean => muscleId.length >= 1 && muscleId.length <= MUSCLE_RECOVERY_MUSCLE_ID_MAX && !muscleId.includes('|');

export function muscleRecoveryId(date: LocalDate, muscleId: string): string {
  return `muscle|${date}|${muscleId}`;
}

export function isMuscleRecoveryId(id: string): boolean {
  const m = MUSCLE_RECOVERY_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'une ligne de muscle de ces valeurs, ou null si `date` ou `muscle_id` manquent ou sont mal formés. */
export function expectedMuscleRecoveryId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  const muscle = row.get('muscle_id');
  return typeof date === 'string' && isLocalDate(date) && typeof muscle === 'string' && isMuscleRecoveryMuscleId(muscle) ? muscleRecoveryId(date, muscle) : null;
}

/**
 * I6-01 (§ 16.7, § 20.2) : journal de facteurs, une ligne par date locale (la veille du matin de saisie), `recovery_factor|AAAA-MM-JJ`. Aucun repli
 * UUID : les deux appareils qui saisissent le même jour écrivent la même ligne. Le CHECK SQL de la migration 0011 porte la même forme.
 */
export function recoveryFactorId(date: LocalDate): string {
  return `recovery_factor|${date}`;
}

export function isRecoveryFactorId(id: string): boolean {
  const m = RECOVERY_FACTOR_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'une ligne de ces valeurs, ou null si `date` manque ou est mal formée. */
export function expectedRecoveryFactorId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  return typeof date === 'string' && isLocalDate(date) ? recoveryFactorId(date) : null;
}

/**
 * I6-02 (§ 17.1, § 20.2) : mensurations, une ligne par date locale et genre, `measurement|AAAA-MM-JJ|<genre>` (genre : 1 à 32 minuscules ou
 * soulignés, sans `|`). Aucun repli UUID : deux appareils qui saisissent la même mesure écrivent la même ligne. Le CHECK SQL de la migration 0012
 * porte la même forme. `progress_photo` garde un identifiant UUID (plusieurs photos le même jour).
 */
export const MEASUREMENT_KIND_MAX = 32;
const MEASUREMENT_RE = /^measurement\|(\d{4}-\d{2}-\d{2})\|([a-z_]{1,32})$/;
const MEASUREMENT_KIND_RE = /^[a-z_]{1,32}$/;

export function measurementId(date: LocalDate, kind: string): string {
  return `measurement|${date}|${kind}`;
}

export function isMeasurementId(id: string): boolean {
  const m = MEASUREMENT_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'une ligne de ces valeurs, ou null si `date` ou `kind` manque ou est mal formé. */
export function expectedMeasurementId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  const kind = row.get('kind');
  return typeof date === 'string' && isLocalDate(date) && typeof kind === 'string' && MEASUREMENT_KIND_RE.test(kind) ? measurementId(date, kind) : null;
}
