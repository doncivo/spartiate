import type { Sex } from '../bodyProfile';
import type { BodyRatioKind } from './ratios';

/**
 * PROG-0301b (BL-181, Q-41, D-745) : repères des 4 ratios de Corps › Mesures, validés par Ali le 26/11/2026 (réponse A pour les quatre).
 * - Taille / hauteur : bandes NICE (NG246) 0,40–0,49 saine, 0,50–0,59 risque augmenté, ≥ 0,60 élevé ; mention « non valable si IMC ≥ 35 ».
 * - Taille / hanches : < 0,90 homme, < 0,85 femme (OMS 2011) ; mention « populations européennes » ; sans sexe, aucun repère.
 * - Épaules / taille : aucun repère, la valeur et son évolution seulement.
 * - Poitrine / taille : environ 1,30 à 1,35 chez l'homme (Crossley et al. 2012), « esthétique, sans valeur santé » ; aucun repère chez
 *   la femme. Les bornes s'appliquent à la valeur affichée (au centième).
 */

export const WAIST_HEIGHT_BANDS = Object.freeze({ healthyFrom: 0.4, increasedFrom: 0.5, highFrom: 0.6 });
export const WAIST_HIPS_LIMIT: Readonly<Record<Sex, number>> = Object.freeze({ male: 0.9, female: 0.85 });
export const CHEST_WAIST_MALE_RANGE = Object.freeze({ min: 1.3, max: 1.35 });

export type WaistHeightBand = 'below-healthy' | 'healthy' | 'increased' | 'high';
export type RatioReference =
  | { readonly kind: 'band'; readonly band: WaistHeightBand; readonly caveat: 'bmi-35' }
  | { readonly kind: 'threshold'; readonly below: boolean; readonly limit: number; readonly caveat: 'european' }
  | { readonly kind: 'range'; readonly position: 'below' | 'within' | 'above'; readonly min: number; readonly max: number; readonly caveat: 'aesthetic' }
  | { readonly kind: 'none'; readonly reason: 'no-reference' | 'no-sex' | 'invalid' };

export function ratioReference(kind: BodyRatioKind, value: number, sex: Sex | null): RatioReference {
  if (!Number.isFinite(value) || value <= 0) return { kind: 'none', reason: 'invalid' };
  switch (kind) {
    case 'waist_height': {
      const b = WAIST_HEIGHT_BANDS;
      const band: WaistHeightBand = value < b.healthyFrom ? 'below-healthy' : value < b.increasedFrom ? 'healthy' : value < b.highFrom ? 'increased' : 'high';
      return { kind: 'band', band, caveat: 'bmi-35' };
    }
    case 'waist_hips': {
      if (sex === null) return { kind: 'none', reason: 'no-sex' };
      const limit = WAIST_HIPS_LIMIT[sex];
      return { kind: 'threshold', below: value < limit, limit, caveat: 'european' };
    }
    case 'shoulders_waist':
      return { kind: 'none', reason: 'no-reference' };
    case 'chest_waist': {
      if (sex === null) return { kind: 'none', reason: 'no-sex' };
      if (sex !== 'male') return { kind: 'none', reason: 'no-reference' };
      const { min, max } = CHEST_WAIST_MALE_RANGE;
      return { kind: 'range', position: value < min ? 'below' : value > max ? 'above' : 'within', min, max, caveat: 'aesthetic' };
    }
  }
}
