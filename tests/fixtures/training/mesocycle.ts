import type { LocalDate } from '../../../src/domain/types';

/**
 * Vecteurs synthétiques du mésocycle (I3-02 ; PRD § 12.2, § 12.5, § 12.6 ; D-73 points 3, 8, 9). Aucune donnée réelle.
 *
 * `PRD_FIVE_WEEKS` : tableau « Périodisation du mésocycle » du § 12.5 pour une ligne de routine à 3 séries (valeurs de la semaine 2) :
 * semaines de travail 2-3-3-4 séries, RIR 3-2-1-1 (la semaine 4 « 0–1 » devient 1 : jamais de RIR 0 par défaut, D-73 point 3), semaine 5
 * deload (volume réduit par le deload I2 de la proposition, D-72 point 9).
 */
export const PRD_FIVE_WEEKS = [
  { week: 1, kind: 'work', sets: 2, rir: 3 },
  { week: 2, kind: 'work', sets: 3, rir: 2 },
  { week: 3, kind: 'work', sets: 3, rir: 1 },
  { week: 4, kind: 'work', sets: 4, rir: 1 },
  { week: 5, kind: 'deload', sets: 3, rir: 4 },
] as const;

/** Lundi 2 novembre 2026 : début des cycles de test. */
export const START = '2026-11-02' as LocalDate;
export const ROUTINE_ID = '7c1e2d3a-0000-4000-8000-000000000001';
export const OTHER_ROUTINE_ID = '7c1e2d3a-0000-4000-8000-000000000002';

/** Date locale `n` jours après `START`. */
export function day(n: number, from: string = START): LocalDate {
  const [y, m, d] = from.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}` as LocalDate;
}
