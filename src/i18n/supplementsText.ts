import { supplementsFr } from './fr.supplements';

/** Textes des compléments (I6-05) ; importé seulement par la carte et la section des compléments, chargées à la demande. */
export type SupplementsTextKey = keyof typeof supplementsFr;

export function tSupplements(key: SupplementsTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = supplementsFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Dose lisible (« 5 g », « 1 000 UI », « 0,5 ») ; null sans dose. */
export function formatSupplementDose(dose: number | null, unit: string | null): string | null {
  if (dose === null) return null;
  const n = dose.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/[  ]/g, ' ');
  return unit === null ? n : `${n} ${unit}`;
}
