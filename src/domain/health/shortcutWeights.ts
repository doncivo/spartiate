import { WEIGHT_MAX_KG } from '../bodyProfile';
import { utcToLocal } from '../timeZone';

/**
 * Pesées exportées de Santé par l'app Raccourcis (D-69 : HealthKit inaccessible avec un compte Apple gratuit). Module pur.
 *
 * Format écrit par le raccourci « Spartiate — poids » (guide : docs/guide-raccourcis-sante.md) : une ligne par échantillon,
 * `date;valeur[;unité]`, séparateur `;` ou tabulation, en-tête facultatif.
 * - date : ISO 8601 avec fuseau (`2026-11-08T06:50:00+01:00` ou `…Z`) ; sans fuseau, la ligne est refusée (heure ambiguë) ;
 * - valeur : décimale à virgule ou à point, unité collée tolérée (`81,4 kg`) ;
 * - unité : `kg` (défaut) ou `lb` (convertie, arrondie au centième).
 * Une pesée par JOUR LOCAL DE L'APPAREIL (fuseau `timeZone`, celui que `saveHealth` utilise pour enregistrer : une seule notion de jour,
 * REV-01 constat 9) : la plus récente, comme `saveHealth`. Le décalage écrit dans le fichier ne sert qu'à situer l'instant. Lignes refusées comptées,
 * jamais d'exception : un fichier abîmé n'importe que ce qu'il a de lisible.
 */

export interface ShortcutWeight {
  /** Instant UTC normalisé (`toISOString`). */
  readonly measuredAt: string;
  readonly kg: number;
}

export interface ShortcutWeights {
  /** Une pesée par jour, du plus ancien au plus récent. */
  readonly weights: readonly ShortcutWeight[];
  readonly rejected: number;
  /** Fichier plus long que `MAX_LINES` : seules les premières lignes sont lues. */
  readonly truncated: boolean;
}

export const MAX_LINES = 1000;
const LB_TO_KG = 0.45359237;
const MIN_KG = 20;
const ISO_WITH_ZONE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/;
/** Jusqu'à 15 décimales, point ou virgule (I5-04) ; le poids est arrondi au centième. */
const VALUE = /^(\d{1,3}(?:[.,]\d{1,15})?)\s*(kg|lb)?$/i;

export function parseShortcutWeights(text: string, today: string, timeZone: string): ShortcutWeights {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const truncated = lines.length > MAX_LINES;
  const byDay = new Map<string, ShortcutWeight & { readonly at: number }>();
  let rejected = 0;
  for (const [index, line] of lines.slice(0, MAX_LINES).entries()) {
    const cells = line.split(/[;\t]/).map((c) => c.trim());
    if (index === 0 && cells[0] !== undefined && /^date$/i.test(cells[0])) continue;
    const parsed = parseLine(cells, today, timeZone);
    if (parsed === null) {
      rejected += 1;
      continue;
    }
    const previous = byDay.get(parsed.day);
    if (previous === undefined || parsed.at > previous.at) byDay.set(parsed.day, { measuredAt: new Date(parsed.at).toISOString(), kg: parsed.kg, at: parsed.at });
  }
  const weights = [...byDay.values()].sort((a, b) => a.at - b.at).map(({ measuredAt, kg }) => ({ measuredAt, kg }));
  return { weights, rejected, truncated };
}

function parseLine(cells: readonly string[], today: string, timeZone: string): { readonly day: string; readonly at: number; readonly kg: number } | null {
  if (cells.length < 2 || cells.length > 3) return null;
  const [date = '', raw = '', unitCell] = cells;
  const iso = ISO_WITH_ZONE.exec(date);
  if (iso === null) return null;
  const at = Date.parse(date);
  if (!Number.isFinite(at)) return null;
  const day = utcToLocal(new Date(at).toISOString(), timeZone).date;
  if (day > today) return null;
  const value = VALUE.exec(raw);
  if (value === null) return null;
  const unit = (unitCell ?? value[2] ?? 'kg').toLowerCase();
  if (unit !== 'kg' && unit !== 'lb') return null;
  const number = Number((value[1] ?? '').replace(',', '.'));
  const kg = Math.round((unit === 'lb' ? number * LB_TO_KG : number) * 100) / 100;
  if (!(Number.isFinite(kg) && kg >= MIN_KG && kg <= WEIGHT_MAX_KG)) return null;
  return { day, at, kg };
}
