import { todayFr } from './fr.today';

/** Textes de l'écran Aujourd'hui, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TodayTextKey = keyof typeof todayFr;

export function tToday(key: TodayTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = todayFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Date de la planche iPhone (« mercredi 4 novembre ») pour un jour civil `AAAA-MM-JJ`. */
export function formatTodayEyebrow(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
