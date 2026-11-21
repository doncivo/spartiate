import { STANDARD_PLATES_KG } from './config';
import type { PlateSpec } from './types';

/**
 * SESS-01c (§ 13.2 « calculateur de disques ») : disques à charger de chaque côté de la barre pour une charge totale. Module pur.
 *
 * Recherche exacte sur les disques disponibles (nombre par côté) : la plus grande charge atteignable sans dépasser la cible ; à égalité, le moins
 * de disques, puis les plus lourds d'abord. Le reste non atteignable est rendu (jamais une charge impossible annoncée comme faite).
 */

export interface PlateLoading {
  readonly barKg: number;
  /** Disques d'UN côté, du plus lourd au plus léger. */
  readonly perSide: readonly PlateSpec[];
  /** Charge totale réellement chargée (barre comprise). */
  readonly loadedKg: number;
  /** Cible moins charge chargée (≥ 0). */
  readonly remainderKg: number;
}

/** Jeu standard (aucun disque déclaré dans le profil) : 10 disques de chaque masse par côté. */
export function standardPlates(): PlateSpec[] {
  return STANDARD_PLATES_KG.map((weightKg) => ({ weightKg, count: 10 }));
}

const UNIT = 0.05;
const MAX_UNITS = 20_000;
const toUnits = (kg: number): number => Math.round(kg / UNIT);
const round = (kg: number): number => Math.round(kg * 100) / 100;

interface Best {
  readonly plates: number;
  /** Masses (en unités) dans l'ordre décroissant, pour départager. */
  readonly list: readonly number[];
}

/** a meilleur que b : moins de disques, puis les plus lourds d'abord. */
function better(a: Best, b: Best | undefined): boolean {
  if (b === undefined) return true;
  if (a.plates !== b.plates) return a.plates < b.plates;
  for (let i = 0; i < a.list.length; i += 1) {
    const x = a.list[i] ?? 0;
    const y = b.list[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export function platesPerSide(totalKg: number, barKg: number, plates: readonly PlateSpec[]): PlateLoading | null {
  if (!Number.isFinite(totalKg) || !Number.isFinite(barKg) || barKg < 0 || totalKg < barKg) return null;
  const target = Math.min(MAX_UNITS, Math.floor(toUnits((totalKg - barKg) / 2) + 1e-9));
  // Disques en unités, du plus lourd au plus léger, chacun autant de fois que disponible par côté.
  const items = plates
    .filter((p) => Number.isFinite(p.weightKg) && p.weightKg > 0 && Number.isInteger(p.count) && p.count > 0)
    .flatMap((p) => Array.from({ length: Math.min(p.count, 50) }, () => toUnits(p.weightKg)))
    .filter((w) => w > 0)
    .sort((a, b) => b - a);
  // reach[s] : meilleure combinaison de somme s.
  const reach: (Best | undefined)[] = new Array<Best | undefined>(target + 1);
  reach[0] = { plates: 0, list: [] };
  for (const w of items) {
    for (let s = target; s >= w; s -= 1) {
      const from = reach[s - w];
      if (from === undefined) continue;
      const candidate: Best = { plates: from.plates + 1, list: [...from.list, w].sort((a, b) => b - a) };
      if (better(candidate, reach[s])) reach[s] = candidate;
    }
  }
  let sum = target;
  while (sum > 0 && reach[sum] === undefined) sum -= 1;
  const best = reach[sum] ?? { plates: 0, list: [] };
  const perSide: PlateSpec[] = [];
  for (const w of best.list) {
    const kg = round(w * UNIT);
    const last = perSide.at(-1);
    if (last !== undefined && last.weightKg === kg) perSide[perSide.length - 1] = { weightKg: kg, count: last.count + 1 };
    else perSide.push({ weightKg: kg, count: 1 });
  }
  const loadedKg = round(barKg + 2 * sum * UNIT);
  return { barKg, perSide, loadedKg, remainderKg: round(Math.max(0, totalKg - loadedKg)) };
}
