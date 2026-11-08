import type { OffMissing, OffRefusal } from '../../../domain/nutrition/offProduct';
import { tNutrition } from '../../../i18n/nutritionText';
import type { OffFailure } from './offLookup';

/** Textes français des cas dégradés Open Food Facts (I4-05) : chaque nature d'échec a son message, aucun texte d'erreur brut. */
export function offFailureMessage(failure: OffFailure): string {
  switch (failure.kind) {
    case 'offline':
      return tNutrition('offOffline');
    case 'timeout':
      return tNutrition('offTimeout');
    case 'rate-limited':
      return failure.retryAfterSeconds === undefined ? tNutrition('offRateLimitedNoDelay') : tNutrition('offRateLimited', { s: failure.retryAfterSeconds });
    case 'http':
      return failure.status === undefined ? tNutrition('offHttpNoStatus') : tNutrition('offHttp', { status: failure.status });
    case 'invalid-input':
      return tNutrition('offInvalidInput');
    case 'unavailable':
      return tNutrition('offUnavailable');
    case 'bad-response':
      return tNutrition('offBadResponse');
  }
}

/** Cause courte d'une fiche périmée non rafraîchie. */
export function offFailureCause(failure: OffFailure): string {
  switch (failure.kind) {
    case 'offline':
      return tNutrition('causeOffline');
    case 'timeout':
      return tNutrition('causeTimeout');
    case 'rate-limited':
      return tNutrition('causeRateLimited');
    case 'unavailable':
      return tNutrition('causeUnavailable');
    default:
      return tNutrition('causeError');
  }
}

export function offRefusalMessage(reason: OffRefusal): string {
  switch (reason) {
    case 'no-nutrition':
      return tNutrition('offRefusedNoNutrition');
    case 'invalid-code':
      return tNutrition('offRefusedInvalidCode');
    case 'no-name':
      return tNutrition('offRefusedNoName');
    case 'implausible':
      return tNutrition('offRefusedImplausible');
  }
}

const MISSING_KEY = { kcal: 'missingKcal', proteinG: 'missingProteinG', fatG: 'missingFatG', carbG: 'missingCarbG', fiberG: 'missingFiberG' } as const;

/** « protéines, fibres » ; vide si rien ne manque. */
export const missingList = (missing: readonly OffMissing[]): string => missing.map((m) => tNutrition(MISSING_KEY[m])).join(', ');
