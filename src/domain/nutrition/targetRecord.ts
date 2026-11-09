/**
 * Enregistrement d'une cible nutritionnelle (PRD § 15.2, § 20.2 ; D-74 points 5 et 7 ; I4-02). Module pur. Une ligne par DÉCISION, jamais
 * modifiée : la modification d'Ali est une nouvelle ligne (`source` manual), une proposition refusée est conservée (`accepted` faux) pour la
 * trace. La cible en vigueur est la dernière ligne acceptée dont la semaine a commencé.
 */

import { isLocalDate, type Hlc, type IsoDateTime, type LocalDate } from '../types';
import { NUTRITION_CONFIG } from './config';
import type { Target } from './types';

export const TARGET_SOURCES = ['auto', 'manual'] as const;
export type TargetSource = (typeof TARGET_SOURCES)[number];

/** Plafond de plausibilité d'une cible, en kcal. */
export const TARGET_KCAL_MAX = 10_000;

export interface TargetRecordDraft {
  /** Début de la semaine d'application (date civile locale). */
  readonly weekStart: LocalDate;
  readonly target: Target;
  /** `auto` : proposition du moteur (acceptée telle quelle ou refusée) ; `manual` : valeurs choisies par Ali. */
  readonly source: TargetSource;
  readonly accepted: boolean;
  /** Version du moteur qui a produit la proposition (traçabilité) ; `null` pour une cible manuelle. */
  readonly engineVersion: number | null;
  /** Ali a confirmé explicitement une cible sous 1 200 kcal (§ 15.2) : condition d'écriture, non stockée. */
  readonly lowFloorConfirmed: boolean;
}

export type TargetRecordIssue = 'week-invalid' | 'source-invalid' | 'engine-version-invalid' | 'value-invalid' | 'kcal-below-minimum' | 'confirmation-required';

export function validateTargetRecord(draft: TargetRecordDraft): TargetRecordIssue[] {
  const issues: TargetRecordIssue[] = [];
  if (!isLocalDate(draft.weekStart)) issues.push('week-invalid');
  if (!(TARGET_SOURCES as readonly string[]).includes(draft.source)) issues.push('source-invalid');
  if (draft.engineVersion !== null && (!Number.isInteger(draft.engineVersion) || draft.engineVersion < 1)) issues.push('engine-version-invalid');
  const { kcal, proteinG, fatG, carbG } = draft.target;
  const grams = [proteinG, fatG, carbG];
  if (!Number.isFinite(kcal) || kcal <= 0 || kcal > TARGET_KCAL_MAX || grams.some((g) => !Number.isFinite(g) || g < 0)) {
    issues.push('value-invalid');
    return issues;
  }
  // Plancher (D-74 point 7) : seulement pour une cible adoptée ; la trace d'une proposition refusée est conservée telle quelle.
  if (draft.accepted) {
    if (kcal < NUTRITION_CONFIG.confirmedFloorKcal) issues.push('kcal-below-minimum');
    else if (kcal < NUTRITION_CONFIG.floorKcal && !draft.lowFloorConfirmed) issues.push('confirmation-required');
  }
  return issues;
}

export interface TargetRecord {
  readonly id: string;
  readonly weekStart: LocalDate;
  readonly target: Target;
  readonly source: TargetSource;
  readonly accepted: boolean;
  readonly createdAt: IsoDateTime;
  /** Ordre causal de la décision (colonne `hlc`, lecture seule) : horloge d'appareil non fiable, HLC si. */
  readonly hlc: Hlc;
}

/**
 * Cible en vigueur à `date` (D-82) : parmi les lignes ACCEPTÉES dont la semaine a commencé le `date` ou avant (`weekStart <= date`, une
 * semaine postérieure n'est jamais retenue), la DERNIÈRE DÉCISION par HLC gagne (chaînes comparées, format à largeurs fixes ; l'UUID de
 * l'appareil départage deux HLC égaux jusque-là). `weekStart` ne départage donc plus : une acceptation du lundi décidée après une cible
 * manuelle du mardi s'applique, et une manuelle du jour plus ancienne (HLC) qu'une acceptation d'une semaine antérieure lui cède.
 */
export function effectiveTarget<T extends Pick<TargetRecord, 'id' | 'weekStart' | 'accepted' | 'hlc'>>(records: readonly T[], date: LocalDate): T | null {
  let best: T | null = null;
  for (const r of records) {
    if (!r.accepted || r.weekStart > date) continue;
    if (best === null || r.hlc > best.hlc || (r.hlc === best.hlc && r.id > best.id)) best = r;
  }
  return best;
}
