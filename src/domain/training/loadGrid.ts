import type { ProgressionConfig } from './config';
import type { ProgressionEquipment, StackRange } from './types';

/**
 * Charges disponibles et arrondi au matériel (PRD § 11.2 point 7, § 11.3 « Snap », § 14.3 ; D-72 point 6). Module pur.
 *
 * Arrondi : charge disponible juste en dessous de la cible ; si l'écart rapporté à cette charge dépasse strictement 3 %, une répétition
 * de plus par série. Une grille vient du premier matériel de l'exercice qui en fournit une (barre, haltères, kettlebells, machine ou
 * poulie déclarée) ; un matériel sans palier connu n'en a pas (`null`) : barre non reliée à ce matériel (`BarbellSpec.equipmentId`),
 * kettlebells « à vérifier », machine ou poulie sans plage.
 */

export type LoadSource = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable';

export interface LoadGrid {
  readonly source: LoadSource;
  /** Charges totales disponibles, croissantes, sans doublon. */
  readonly loads: readonly number[];
}

const BARBELL_IDS: ReadonlySet<string> = new Set(['barbell', 'ez-bar', 'trap-bar']);
const CABLE_IDS: ReadonlySet<string> = new Set(['low-pulley', 'high-pulley', 'cable-machine']);
const MAX_LOADS = 2000;
const EPS = 1e-9;

/** Arrondi au centième (charges en kg, sans bruit de virgule flottante). */
export const roundKg = (kg: number): number => Math.round(kg * 100) / 100;

function stepped(min: number, max: number, step: number): number[] {
  const loads: number[] = [];
  if (!(step > 0) || !(min > 0) || max < min) return loads;
  for (let i = 0; loads.length < MAX_LOADS; i += 1) {
    const kg = roundKg(min + i * step);
    if (kg > max + EPS) break;
    loads.push(kg);
  }
  return loads;
}

const fromRange = (r: StackRange): number[] => {
  const extra = (r.extraKg ?? []).filter((kg) => Number.isFinite(kg) && kg > 0);
  return [...new Set([...stepped(r.minKg, r.maxKg, r.stepKg), ...extra])].sort((a, b) => a - b);
};

/** Barre reliée au matériel de l'exercice (première déclarée pour ce matériel) ; aucune barre reliée : aucune grille. */
function barbellLoads(profile: ProgressionEquipment, equipmentId: string): number[] {
  const inv = profile.inventory;
  const bar = inv.barbells.find((b) => b.equipmentId === equipmentId);
  if (bar === undefined) return [];
  const smallestPlate = Math.min(...inv.platesPerSideKg.map((p) => p.weightKg));
  const step = profile.increments.barbell ?? (Number.isFinite(smallestPlate) ? 2 * smallestPlate : Number.NaN);
  const platesKg = 2 * inv.platesPerSideKg.reduce((sum, p) => sum + p.weightKg * p.count, 0);
  return stepped(bar.weightKg, platesKg > 0 ? bar.weightKg + platesKg : 1000, step);
}

/** Grille de charges de l'exercice avec ce profil ; null sans profil ou sans matériel à palier connu. */
export function loadGrid(equipment: readonly string[], profile: ProgressionEquipment | null): LoadGrid | null {
  if (profile === null) return null;
  const inv = profile.inventory;
  for (const id of equipment) {
    let grid: LoadGrid | null = null;
    if (BARBELL_IDS.has(id)) grid = { source: 'barbell', loads: barbellLoads(profile, id) };
    else if (id === 'dumbbell' && inv.dumbbells !== null) grid = { source: 'dumbbell', loads: fromRange(inv.dumbbells) };
    // Kettlebells « à vérifier » (pas inconnu : seules les bornes sont connues) : aucune grille plutôt qu'une liste trompeuse.
    else if (id === 'kettlebell' && !(inv.toVerify ?? []).includes('kettlebells')) grid = { source: 'kettlebell', loads: [...new Set(inv.kettlebellsKg.filter((k) => k > 0))].sort((a, b) => a - b) };
    else if (CABLE_IDS.has(id) && inv.cables[0] !== undefined) grid = { source: 'cable', loads: fromRange(inv.cables[0]) };
    else {
      const machine = inv.machines.find((m) => m.equipmentId === id);
      if (machine) grid = { source: 'machine', loads: stepped(machine.stackMinKg, machine.stackMaxKg, machine.stepKg) };
    }
    if (grid !== null && grid.loads.length > 0) return grid;
  }
  return null;
}

/** Plus grande charge ≤ cible ; sous le minimum, le minimum. Grille vide : la cible. */
export function snapDown(targetKg: number, loads: readonly number[]): number {
  let best: number | null = null;
  for (const kg of loads) if (kg <= targetKg + EPS && (best === null || kg > best)) best = kg;
  return best ?? (loads.length > 0 ? Math.min(...loads) : targetKg);
}

/** Plus petite charge strictement au-dessus ; null au maximum du matériel. */
export function nextLoadAbove(loadKg: number, loads: readonly number[]): number | null {
  let best: number | null = null;
  for (const kg of loads) if (kg > loadKg + EPS && (best === null || kg < best)) best = kg;
  return best;
}

export interface SnapResult {
  readonly loadKg: number;
  readonly reps: readonly number[];
  /** Écart > tolérance : une répétition ajoutée à chaque série. */
  readonly extraRep: boolean;
}

/**
 * Arrondit la cible au matériel (charges `loads`, ou demi-kilo inférieur sans grille) ; écart au cran inférieur > tolérance : +1 rep par
 * série. Égalité à 3 % : pas de répétition ajoutée (règle stricte du § 11.3).
 */
export function snapToEquipment(targetKg: number, reps: readonly number[], loads: readonly number[] | null, config: ProgressionConfig): SnapResult {
  const unit = config.unknownGridRoundingKg;
  const loadKg = loads === null ? roundKg(Math.floor(targetKg / unit + EPS) * unit) : snapDown(targetKg, loads);
  const extraRep = loadKg > 0 && (targetKg - loadKg) / loadKg > config.snapTolerance + EPS;
  return { loadKg, reps: extraRep ? reps.map((r) => r + 1) : [...reps], extraRep };
}
