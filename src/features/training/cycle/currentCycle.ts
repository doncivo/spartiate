import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { mesocycleState, type MesocycleState } from '../../../domain/training/mesocycle';
import type { LocalDate } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { MesocycleRecord } from '../../../db/repositories/mesocycleRepository';

/**
 * Cycle suivi et son état à une date (I3-02), pour la section Cycle, « Proposer une séance » et la proposition d'un exercice. Petit module
 * des blocs à la demande (jamais dans le départ).
 */

/** Date locale de l'appareil (`AAAA-MM-JJ`) d'un instant. */
export function localDayOf(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as LocalDate;
}

export interface CurrentCycle {
  readonly record: MesocycleRecord;
  readonly state: MesocycleState;
  /** Cycles actifs (plus d'un : commencés sur deux appareils). */
  readonly activeCount: number;
}

/** Cycle suivi et son état au jour `day` ; `null` sans cycle actif. */
export async function loadCurrentCycle(access: DataAccess, day: LocalDate): Promise<CurrentCycle | null> {
  const repo = await access.repos.mesocycles();
  const [record, activeCount] = await Promise.all([repo.current(), repo.activeCount()]);
  return record === null ? null : { record, state: mesocycleState(record, day, DEFAULT_GENERATION_CONFIG), activeCount };
}
