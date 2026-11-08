import type { IsoDateTime } from '../types';
import type { GenerationConfig } from './config';
import type { GenerationIssueCode, ProgramMode, SplitDayKind, SplitKind, VarietyLevel } from './generationTypes';

/**
 * Règles des modes de programme (§ 12.3), des splits (§ 12.1 point 1) et de la variété (§ 12.1 point 3), selon D-73. Module pur.
 */

export interface ModeRules {
  /** Faux : mode indisponible (Importé, avant I6). */
  readonly available: boolean;
  /** Ordre de la séance réécrit (composés, puis priorités, puis position) ; sinon l'ordre d'Ali. */
  readonly reorders: boolean;
  /** Ligne incompatible ou douloureuse remplacée ; sinon omise avec un remplaçant seulement suggéré. */
  readonly substitutes: boolean;
  /** Variété appliquée ; sinon les exercices d'Ali restent. */
  readonly rotates: boolean;
  /** Split vérifié et groupes du jour appliqués aux candidats. */
  readonly usesSplit: boolean;
  /** Profil de matériel de type `maison` exigé. */
  readonly requiresHomeProfile: boolean;
}

const GUIDED: ModeRules = Object.freeze({ available: true, reorders: true, substitutes: true, rotates: true, usesSplit: true, requiresHomeProfile: false });

const RULES: Readonly<Record<ProgramMode, ModeRules>> = Object.freeze({
  guide: GUIDED,
  maison: Object.freeze({ ...GUIDED, requiresHomeProfile: true }),
  libre: Object.freeze({ available: true, reorders: false, substitutes: false, rotates: false, usesSplit: false, requiresHomeProfile: false }),
  importe: Object.freeze({ available: false, reorders: false, substitutes: false, rotates: false, usesSplit: false, requiresHomeProfile: false }),
});

export function modeRules(mode: ProgramMode): ModeRules {
  return RULES[mode];
}

/** Jour du split pour l'index de jour (0 = premier jour de la routine). */
export function splitDayKind(split: SplitKind, dayIndex: number): SplitDayKind {
  const i = Math.max(0, Math.floor(dayIndex));
  switch (split) {
    case 'upper-lower':
      return i % 2 === 0 ? 'upper' : 'lower';
    case 'ppl':
      return (['push', 'pull', 'legs'] as const)[i % 3] ?? 'push';
    case 'custom':
      return 'custom';
    case 'full-body':
      return 'full-body';
  }
}

/** Groupes musculaires du jour : constantes du split, ou groupes affectés par Ali (Custom, vide si non affecté). */
export function dayGroups(split: SplitKind, dayIndex: number, customDays: readonly (readonly string[])[], config: GenerationConfig): readonly string[] {
  const kind = splitDayKind(split, dayIndex);
  if (kind === 'custom') return [...new Set(customDays[dayIndex] ?? [])];
  return config.splitGroups[kind];
}

/** Nombre de jours de la routine admis par le split (§ 12.1 point 1). */
export function validateSplit(split: SplitKind, dayCount: number, config: GenerationConfig): GenerationIssueCode[] {
  const [min, max] = config.splitDays[split];
  return Number.isInteger(dayCount) && dayCount >= min && dayCount <= max ? [] : ['split-days'];
}

/** Emplacements récurrents (gardés) : tous en Consistent, `ceil(part × n)` en Balanced (D-73 point 5), aucun en Varied. */
export function recurringSlotCount(slots: number, variety: VarietyLevel, config: GenerationConfig): number {
  if (variety === 'consistent') return slots;
  if (variety === 'varied') return 0;
  // Tolérance d'arrondi binaire : 10 × 0,7 vaut 7,000000000000001.
  return Math.max(0, Math.min(slots, Math.ceil(slots * config.balancedRecurringShare - 1e-9)));
}

const WEEK_MS = 7 * 86_400_000;

/**
 * Période de rotation : 0 = exercices de la routine. Balanced : semaines écoulées depuis `startedAt` ÷ 4 ; Varied : index du mésocycle (I3-02),
 * sinon semaines ÷ `mesoWeeks` ; Consistent : toujours 0. Instant antérieur ou illisible : 0.
 */
export function rotationPeriod(variety: VarietyLevel, startedAt: IsoDateTime, now: IsoDateTime, mesocycleIndex: number | null, config: GenerationConfig): number {
  if (variety === 'consistent') return 0;
  if (variety === 'varied' && mesocycleIndex !== null) return Number.isInteger(mesocycleIndex) && mesocycleIndex > 0 ? mesocycleIndex : 0;
  const elapsed = Date.parse(now) - Date.parse(startedAt);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  const weeks = Math.floor(elapsed / WEEK_MS);
  return Math.floor(weeks / (variety === 'balanced' ? config.balancedRotationWeeks : config.mesoWeeks));
}
