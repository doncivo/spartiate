import { cardioFr } from './fr.cardio';

/** Textes d'Entraînement › Cardio, à part du catalogue principal ; importé seulement par des modules chargés à la demande (I6-06). */
export type CardioTextKey = keyof typeof cardioFr;

export function tCardio(key: CardioTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = cardioFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Distance en km, virgule décimale, au plus deux décimales (« 7,5 km », « 12 km »). */
export function formatKm(meters: number): string {
  const km = Math.round(meters / 10) / 100;
  return tCardio('km', { value: String(km).replace('.', ',') });
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
  return tCardio(n === 1 ? 'progressSessions_one' : 'progressSessions_other', { n });
}
