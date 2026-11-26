import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { tPlural } from './plural';
import { cardioFr } from './fr.cardio';

/** Textes d'Entraînement › Cardio, à part du catalogue principal ; importé seulement par des modules chargés à la demande (I6-06). */
export type CardioTextKey = keyof typeof cardioFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type CardioPlainKey = PlainCatalogKey<typeof cardioFr>;

function translate(key: CardioTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = cardioFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tCardio: CatalogTranslator<typeof cardioFr> = translate;

/** ERGO-02 : nombre de km seul (chiffre héros), virgule décimale, au plus deux décimales (« 5,24 »). */
export function kmValue(meters: number): string {
  return String(Math.round(meters / 10) / 100).replace('.', ',');
}

/** Distance en km, virgule décimale, au plus deux décimales (« 7,5 km », « 12 km »). */
export function formatKm(meters: number): string {
  return tCardio('km', { value: kmValue(meters) });
}

/** ERGO-02 : chrono du suivi en cours, « 28:41 » ou « 1:02:05 » (secondes entières). */
export function formatChrono(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

/** Durée lisible : « 45 min », « 1 h 05 min » (secondes arrondies à la minute la plus proche, au moins 1 min). */
export function formatDuration(sec: number): string {
  const total = Math.max(1, Math.round(sec / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? tCardio('durationHours', { h, m: String(m).padStart(2, '0') }) : tCardio('durationMinutes', { m });
}

/** Allure « 6:00 » (minutes:secondes par km). */
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** « 1 séance », « 3 séances ». */
export function sessionsCount(n: number): string {
  return tPlural(tCardio, n, 'progressSessions_one', 'progressSessions_other');
}
