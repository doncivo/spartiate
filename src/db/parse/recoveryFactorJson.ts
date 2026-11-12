import { FACTOR_CODES, isFactorCode, type FactorCode } from '../../domain/recovery';
import { decodeJson } from './jsonText';

/**
 * Validation à la main du JSON de `recovery_factor.factors` (ADR 0008) : tableau de codes fixes (`FACTOR_CODES`). Valeur typée ou `null` (texte
 * illisible, pas un tableau, élément qui n'est pas un texte ; jamais d'exception, jamais de valeur devinée). Un code inconnu, écrit par un appareil
 * plus récent, est ignoré (la ligne reste lisible) ; les doublons disparaissent ; la sortie suit l'ordre de `FACTOR_CODES`.
 */

const MAX_LIST = 32;

export function parseFactors(text: string | null): FactorCode[] | null {
  const value = decodeJson(text);
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const seen = new Set<string>();
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') return null;
    if (isFactorCode(item)) seen.add(item);
  }
  return FACTOR_CODES.filter((code) => seen.has(code));
}

export const encodeFactors = (factors: readonly FactorCode[]): string => JSON.stringify(FACTOR_CODES.filter((code) => factors.includes(code)));
