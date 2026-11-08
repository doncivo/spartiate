import { nutritionFr } from './fr.nutrition';

/** Textes de l'onglet Nutrition (I4-03) ; importé seulement par les blocs à la demande de Nutrition et de la carte d'Aujourd'hui. */
export type NutritionTextKey = keyof typeof nutritionFr;

export function tNutrition(key: NutritionTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = nutritionFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const TENTH = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const HUNDREDTH = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** Entier lisible (« 2 650 », espace fine insécable des milliers). */
export const formatInt = (n: number): string => NUMBER.format(n);
/** Au dixième (« 7,5 »). */
export const formatTenth = (n: number): string => TENTH.format(n);
/** Au centième, pour les kilos de pente (« −0,35 »). */
export const formatKgDelta = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${HUNDREDTH.format(Math.abs(n))}`;
/** Écart signé en kcal (« −310 », « +50 »). */
export const formatSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${NUMBER.format(Math.abs(n))}`;
/** Valeur inconnue : « — », jamais 0. */
export const orDash = (n: number | null, format: (x: number) => string = formatTenth): string => (n === null ? tNutrition('unknown') : format(n));

const toUtc = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};

/** « lun. 9 nov. » */
export const formatDayShort = (date: string): string => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(toUtc(date));
/** « lundi 9 novembre » */
export const formatDayLong = (date: string): string => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(toUtc(date));
/** « 9 novembre » */
export const formatDayMonth = (date: string): string => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(toUtc(date));

export const weekdayNames = (): readonly string[] => nutritionFr.weekdays.split('|');
