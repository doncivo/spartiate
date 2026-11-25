import { catalogText } from './catalogText';
import { unitsFr } from './fr.units';

/**
 * SHELL-0295 (C-076, D-639) : formatage commun des nombres, durées et séparateurs (français, heures en 24 h). Seul point où la locale
 * d'Intl est écrite pour src/features et src/ui (garde tests/unit/hardcodedUnits.test.ts) ; hors du départ.
 */
const tUnits = catalogText(unitsFr);

export const INTL_LOCALE = 'fr-FR';
/** « · » entre deux éléments d'une ligne. */
export const SEP: string = unitsFr.separator;
/** « — » pour une valeur absente. */
export const NONE: string = unitsFr.none;

/** Nombre au format français (« 12 345 », « 3,1 ») ; mêmes options qu'Intl.NumberFormat. */
export function formatLocaleNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(INTL_LOCALE, options);
}

/** « 7 h 12 », « 8 h 00 », « 45 min ». */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return tUnits('minutes', { n: total });
  return tUnits('hoursMinutes', { h: Math.floor(total / 60), mm: String(total % 60).padStart(2, '0') });
}

/** Première lettre en capitale (« Mercredi »). */
export const upperFirst = (text: string): string => text.charAt(0).toLocaleUpperCase(INTL_LOCALE) + text.slice(1);

/** Texte en minuscules (« prise de masse »). */
export const lowerCase = (text: string): string => text.toLocaleLowerCase(INTL_LOCALE);
