/**
 * Identifiants déterministes de la base neuve (ADR 0011, section 8 ; D-55, D-65).
 *
 * Deux appareils qui créent « la même » ligne doivent lui donner le même identifiant, sinon la fusion par ligne en ferait deux :
 * - `profile` : une seule ligne, `profile|singleton` ;
 * - `body_weight` : une pesée par jour et par origine, `weight|AAAA-MM-JJ|source` (`manual` ou `health`).
 *
 * Aucun repli UUID (D-65). Les CHECK SQL de la migration 0001 portent les mêmes formes. Module pur.
 */

import type { LocalDate } from '../types';
import { isLocalDate } from '../types';

export const PROFILE_ID = 'profile|singleton';

export type WeightSource = 'manual' | 'health';

const WEIGHT_RE = /^weight\|(\d{4}-\d{2}-\d{2})\|(manual|health)$/;

/** Identifiant de la pesée d'un jour et d'une origine. */
export function weightId(date: LocalDate, source: WeightSource): string {
  return `weight|${date}|${source}`;
}

export function isProfileId(id: string): boolean {
  return id === PROFILE_ID;
}

export function isWeightId(id: string): boolean {
  const m = WEIGHT_RE.exec(id);
  return m !== null && m[1] !== undefined && isLocalDate(m[1]);
}

/** Identifiant attendu d'une pesée de ces valeurs (cohérence d'une recréation reçue, section 5.4), ou null si `date` ou `source` manquent. */
export function expectedWeightId(row: ReadonlyMap<string, unknown>): string | null {
  const date = row.get('date');
  const source = row.get('source');
  return typeof date === 'string' && (source === 'manual' || source === 'health') ? `weight|${date}|${source}` : null;
}
