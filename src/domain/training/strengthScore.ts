import type { Sex } from '../bodyProfile';
import type { ExerciseSession } from './types';

/** STR-01 : bouchon du rouge (types seulement) ; le calcul arrive avec le commit vert. */

export type StrengthGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes';
export type StrengthTier = 'iron' | 'bronze' | 'silver' | 'gold';
export interface StandardClass {
  readonly upToKg: number | null;
  readonly sampleSize: number;
  readonly kg: readonly number[];
}
export interface LiftStandard {
  readonly key: string;
  readonly sourceLift: string;
  readonly groups: readonly StrengthGroup[];
  readonly totalLoad: boolean;
  readonly male: readonly StandardClass[];
  readonly female: readonly StandardClass[];
}
export interface StrengthStandards {
  readonly percentiles: readonly number[];
  readonly lifts: readonly LiftStandard[];
}
export interface StrengthExercise {
  readonly id: string;
  readonly nameFr: string;
  readonly key: string;
  readonly history: readonly ExerciseSession[];
}
export interface StrengthInput {
  readonly sex: Sex | null;
  readonly bodyweightKg: number | null;
  readonly standards: StrengthStandards;
  readonly exercises: readonly StrengthExercise[];
}
export interface StrengthResult {
  readonly groups: readonly ({ readonly group: StrengthGroup; readonly kind: 'value'; readonly score: number; readonly lift: { readonly oneRmKg: number } } | { readonly group: StrengthGroup; readonly kind: 'none'; readonly reason: string })[];
  readonly global: { readonly score: number; readonly tier: StrengthTier; readonly counted: number } | null;
  readonly weightClass: { readonly upToKg: number | null; readonly aboveKg: number | null } | null;
}

export const percentileOf = (_kg: number, _standard: readonly number[], _percentiles: readonly number[]): { score: number; bound: 'below' | 'above' | null } => ({ score: 0, bound: null });
export const classFor = (_kg: number, classes: readonly StandardClass[]): StandardClass | undefined => classes[0];
export const tierOf = (_score: number): StrengthTier => 'iron';
export const strengthScore = (_input: StrengthInput): StrengthResult => ({ groups: [], global: null, weightClass: null });
