import { FACTOR_CODES, type FactorCode } from '../../domain/recovery';
import type { FactorEntry } from '../../db/repositories';

/**
 * Transitions du journal de facteurs (I6-01 point B) : fonctions pures sur la saisie courante. `null` = plus rien de coché = jour « non renseigné »
 * (la ligne est effacée) ; « rien de particulier » et un facteur s'excluent.
 */
export function toggleFactor(current: FactorEntry | null, code: FactorCode): FactorEntry | null {
  const set = new Set<FactorCode>(current?.factors ?? []);
  if (set.has(code)) set.delete(code);
  else set.add(code);
  const factors = FACTOR_CODES.filter((c) => set.has(c));
  return factors.length === 0 ? null : { factors, none: false };
}

export function toggleNone(current: FactorEntry | null): FactorEntry | null {
  return current?.none === true ? null : { factors: [], none: true };
}
