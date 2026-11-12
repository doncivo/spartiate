/**
 * Split proposé et plafond de durée (PRD § 10.1 écrans 4 et 7 ; § 12.5 programmes de départ). Pur. Le split est une PROPOSITION : le choix
 * d'un programme de départ n'écrit rien et ne remplace aucune routine (la création d'une routine nouvelle est faite par l'appelant).
 */

import { estimateSessionSec } from '../training/generateSession';
import type { GenerationConfig } from '../training/config';
import type { EquipmentProfileKind } from '../training/types';
import type { SplitKind } from '../training/generationTypes';

/** Programmes de départ embarqués (content/programs) et leur nombre de jours ; l'accord avec le contenu est testé côté écran. */
export const STARTER_PROGRAM_DAYS = {
  'full-body-3j': 3,
  'haut-bas-4j': 4,
  'ppl-6j': 6,
  'maison-halteres-3j': 3,
} as const;
export type StarterProgramId = keyof typeof STARTER_PROGRAM_DAYS;

export interface SplitProposal {
  readonly split: SplitKind;
  readonly programId: StarterProgramId;
  readonly programDays: number;
  /** Le programme a exactement autant de jours que de séances par semaine demandées. */
  readonly matchesFrequency: boolean;
}

/**
 * Salle : 1 à 3 séances corps entier (3 jours), 4 haut / bas, 5 et 6 poussée / tirage / jambes (6 jours). Maison ou voyage : le seul programme à
 * domicile (corps entier, 3 jours). Fréquence ou matériel non choisis : 3 séances en salle (le plus prudent).
 */
export function proposeSplit(input: { readonly sessionsPerWeek: number | null; readonly equipmentKind: EquipmentProfileKind | null }): SplitProposal {
  const { sessionsPerWeek, equipmentKind } = input;
  let split: SplitKind;
  let programId: StarterProgramId;
  if (equipmentKind === 'maison' || equipmentKind === 'voyage') {
    split = 'full-body';
    programId = 'maison-halteres-3j';
  } else if (sessionsPerWeek === 4) {
    split = 'upper-lower';
    programId = 'haut-bas-4j';
  } else if (sessionsPerWeek === 5 || sessionsPerWeek === 6 || (sessionsPerWeek !== null && sessionsPerWeek > 6)) {
    split = 'ppl';
    programId = 'ppl-6j';
  } else {
    split = 'full-body';
    programId = 'full-body-3j';
  }
  const programDays = STARTER_PROGRAM_DAYS[programId];
  return { split, programId, programDays, matchesFrequency: sessionsPerWeek !== null && sessionsPerWeek === programDays };
}

export interface CappedSession {
  readonly keptCount: number;
  readonly droppedCount: number;
  /** Durée estimée des lignes gardées, en minutes entières (par excès). */
  readonly estimatedMin: number;
}

/**
 * § 10.1 écran 4 : « La durée plafonne les séries ». Les dernières lignes sont retirées tant que la durée estimée (45 s par série + repos,
 * D-73) dépasse la durée choisie ; la première ligne reste toujours. Sans durée : aucun plafond.
 */
export function capLinesToDuration(lines: readonly { readonly sets: number; readonly restSec: number }[], durationMin: number | null, config: GenerationConfig): CappedSession {
  let kept = lines.length;
  if (durationMin !== null) {
    while (kept > 1 && estimateSessionSec(lines.slice(0, kept), config) > durationMin * 60) kept -= 1;
  }
  const sec = estimateSessionSec(lines.slice(0, kept), config);
  return { keptCount: kept, droppedCount: lines.length - kept, estimatedMin: Math.ceil(sec / 60) };
}
