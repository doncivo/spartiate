import { roundKg } from './loadGrid';
import type { Prescription } from './types';

/**
 * SESS-01d (§ 13.2 « Fatigue déclarée : Frais / Normal / Fatigué au démarrage » ; règle proposée en décision, révisable par Ali). Module pur.
 *
 * La déclaration est facultative et ne bloque rien. Seul « Fatigué » agit, et seulement contre une HAUSSE de charge ce jour-là : une proposition
 * qui montait (ou, pour un exercice assisté, qui baissait l'assistance) garde la charge de référence, arrondie au cran inférieur du matériel
 * actuel (assisté : au cran supérieur, plus d'assistance), avec les répétitions de la référence. Jamais de baisse imposée : une proposition qui
 * ne montait pas reste telle quelle. Raison `declared-fatigue`, phrase dédiée.
 */

export const DECLARED_FATIGUE_LEVELS = ['fresh', 'normal', 'tired'] as const;
export type DeclaredFatigue = (typeof DECLARED_FATIGUE_LEVELS)[number];

/** Valeur du réglage LOCAL `training.declaredFatigue` : `{ v: 1, workoutId, level }` ; ne vaut que pour la séance nommée. */
export interface DeclaredFatigueValue {
  readonly v: 1;
  readonly workoutId: string;
  readonly level: DeclaredFatigue | null;
}

export function parseDeclaredFatigue(raw: unknown, workoutId: string): DeclaredFatigue | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as { readonly v?: unknown; readonly workoutId?: unknown; readonly level?: unknown };
  if (value.v !== 1 || value.workoutId !== workoutId) return null;
  return (DECLARED_FATIGUE_LEVELS as readonly unknown[]).includes(value.level) ? (value.level as DeclaredFatigue) : null;
}

const EPS = 1e-9;

export interface FatigueHoldOptions {
  /** Exercice assisté : la charge saisie est l'assistance (une valeur plus faible est plus dure). */
  readonly assisted: boolean;
  /** Charges disponibles du matériel actif ; null : sans grille (la référence telle quelle). */
  readonly loads: readonly number[] | null;
}

function heldLoad(referenceKg: number, options: FatigueHoldOptions): number | null {
  if (options.loads === null || options.loads.length === 0) return referenceKg;
  let best: number | null = null;
  for (const kg of options.loads) {
    if (options.assisted ? kg >= referenceKg - EPS && (best === null || kg < best) : kg <= referenceKg + EPS && (best === null || kg > best)) best = kg;
  }
  return best;
}

export function holdForDeclaredFatigue(p: Prescription, level: DeclaredFatigue | null, options: FatigueHoldOptions): Prescription {
  if (level !== 'tired' || p.status !== 'prescribed' || p.loadKg === null || p.reference === null) return p;
  const ref = p.reference.loadKg;
  const harder = options.assisted ? p.loadKg < ref - EPS : p.loadKg > ref + EPS;
  if (!harder) return p;
  const load = heldLoad(ref, options);
  if (load === null || (options.assisted ? load <= p.loadKg + EPS : load >= p.loadKg - EPS)) return p;
  const reps = p.reference.reps;
  return {
    ...p,
    loadKg: load,
    deltaKg: roundKg(load - ref),
    sets: p.sets.map((s, i) => ({ reps: reps[i] ?? s.reps, loadKg: load })),
    ladderSetIndex: null,
    reasons: [...p.reasons, 'declared-fatigue'],
  };
}
