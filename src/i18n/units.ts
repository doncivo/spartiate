import type { CatalogArgs } from './catalogText';
import { unitsFr } from './fr.units';

/**
 * SHELL-0295 (C-076, D-639) : formatage commun des nombres, durées et séparateurs (français, heures en 24 h). Seul point où la locale
 * d'Intl est écrite pour src/features et src/ui (garde tests/unit/hardcodedUnits.test.ts) ; hors du départ.
 */

/**
 * SHELL-0295 (C-085, D-638) : traducteur d'un catalogue chargé avec son écran, hors de l'arbre `fr.ts` du départ. Les paramètres sont
 * typés depuis le texte français ; un paramètre absent reste visible sous la forme `{nom}`. CLEAN-0296 (D-644) : écrit ici et réexporté
 * par `catalogText.ts`, pour rester dans le bloc partagé `units` au lieu de former un bloc de plus que le départ devrait nommer.
 */
export function catalogText<C extends Readonly<Record<string, string>>>(catalog: C) {
  return <K extends keyof C & string>(key: K, ...args: CatalogArgs<C, K>): string => {
    const text = catalog[key] as string;
    const params = args[0] as Readonly<Record<string, string | number>> | undefined;
    return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
  };
}

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
