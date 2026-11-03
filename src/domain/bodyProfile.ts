/**
 * Profil et poids (D-65 points 2 à 5 ; PRD § 20.2) : règles pures de validation. Toute valeur du profil est facultative (NULL ≠ zéro) ;
 * les bornes et les énumérations sont validées ici, au repository et à la réception, sans CHECK SQL d'énumération.
 */

import { isLocalDate, type DeviceId, type Hlc, type IsoDateTime, type LocalDate } from './types';

import { PROFILE_ID, weightId } from './sync/naturalIds';

export { PROFILE_ID, weightId };

export const SEXES = ['male', 'female'] as const;
export const GOALS = ['gain', 'loss', 'maintain'] as const;
export const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const;
export const UNITS = ['metric'] as const;

export type Sex = (typeof SEXES)[number];
export type BodyGoal = (typeof GOALS)[number];
export type Experience = (typeof EXPERIENCES)[number];
export type Units = (typeof UNITS)[number];

export const BIRTH_YEAR_MIN = 1920;
/** Âge minimal admis : l'année de naissance va jusqu'à l'année courante moins ce nombre. */
export const MIN_AGE_YEARS = 10;
export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;
export const WEIGHT_MAX_KG = 500;

/** Profil stocké : une seule ligne `profile|singleton`, jamais créée vide. */
export interface Profile {
  readonly id: typeof PROFILE_ID;
  readonly sex: Sex | null;
  readonly birthYear: number | null;
  readonly heightCm: number | null;
  readonly goal: BodyGoal | null;
  readonly experience: Experience | null;
  readonly units: Units | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

/** Saisie du profil : une valeur absente est `null` (ou omise), jamais zéro. */
export interface ProfileInput {
  readonly sex?: Sex | null;
  readonly birthYear?: number | null;
  readonly heightCm?: number | null;
  readonly goal?: BodyGoal | null;
  readonly experience?: Experience | null;
  readonly units?: Units | null;
}

export type WeightSource = 'manual' | 'health';

export interface BodyWeight {
  readonly id: string;
  readonly date: LocalDate;
  readonly kg: number;
  readonly source: WeightSource;
  readonly timezone: string;
  readonly healthUuid: string | null;
  /** Instant UTC de la mesure : NULL pour `manual`, obligatoire pour `health` (D-65 point 2). */
  readonly measuredAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface ManualWeightInput {
  readonly date: LocalDate;
  readonly kg: number;
}

export type IssueCode = 'range' | 'format' | 'future' | 'enum';
export interface Issue<F extends string> {
  readonly field: F;
  readonly code: IssueCode;
}
export type ProfileField = 'sex' | 'birthYear' | 'heightCm' | 'goal' | 'experience' | 'units';
export type WeightField = 'date' | 'kg';

const oneOf = <T extends string>(list: readonly T[], value: unknown): boolean => typeof value === 'string' && (list as readonly string[]).includes(value);

export function validateProfile(input: ProfileInput, currentYear: number): Issue<ProfileField>[] {
  const issues: Issue<ProfileField>[] = [];
  const { sex, birthYear, heightCm, goal, experience, units } = input;
  if (sex != null && !oneOf(SEXES, sex)) issues.push({ field: 'sex', code: 'enum' });
  if (birthYear != null && !(Number.isInteger(birthYear) && birthYear >= BIRTH_YEAR_MIN && birthYear <= currentYear - MIN_AGE_YEARS)) issues.push({ field: 'birthYear', code: 'range' });
  if (heightCm != null && !(Number.isFinite(heightCm) && heightCm >= HEIGHT_MIN_CM && heightCm <= HEIGHT_MAX_CM)) issues.push({ field: 'heightCm', code: 'range' });
  if (goal != null && !oneOf(GOALS, goal)) issues.push({ field: 'goal', code: 'enum' });
  if (experience != null && !oneOf(EXPERIENCES, experience)) issues.push({ field: 'experience', code: 'enum' });
  if (units != null && !oneOf(UNITS, units)) issues.push({ field: 'units', code: 'enum' });
  return issues;
}

export function validateManualWeight(input: ManualWeightInput, today: LocalDate): Issue<WeightField>[] {
  const issues: Issue<WeightField>[] = [];
  if (!isLocalDate(input.date)) issues.push({ field: 'date', code: 'format' });
  else if (input.date > today) issues.push({ field: 'date', code: 'future' });
  if (!(Number.isFinite(input.kg) && input.kg > 0 && input.kg <= WEIGHT_MAX_KG)) issues.push({ field: 'kg', code: 'range' });
  return issues;
}

/** Nombre décimal saisi (virgule ou point) ; vide ou illisible : `null`, jamais zéro. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}
