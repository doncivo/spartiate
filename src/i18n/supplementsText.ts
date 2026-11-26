import { normalizeSupplementUnit } from '../domain/nutrition/supplements';
import { catalogText, type PlainCatalogKey } from './catalogText';
import { supplementsFr } from './fr.supplements';

/** Textes des compléments (I6-05) ; importé seulement par la carte et la section des compléments, chargées à la demande. */
export type SupplementsTextKey = keyof typeof supplementsFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type SupplementsPlainKey = PlainCatalogKey<typeof supplementsFr>;

export const tSupplements = catalogText(supplementsFr);

/** Dose lisible (« 5 g », « 0,5 ») ; null sans dose. Espaces insécables du format français remplacées par des espaces simples. */
export function formatSupplementDose(dose: number | null, unit: string | null): string | null {
  if (dose === null) return null;
  const n = dose.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/\s/g, ' ');
  const u = normalizeSupplementUnit(unit);
  return u === null ? n : `${n} ${u}`;
}
