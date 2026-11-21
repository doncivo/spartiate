import { programWeeklyTarget, type WeeklyTarget } from '../../domain/training/progressStats';
import type { MesocyclePause } from '../../domain/training/mesocycle';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { loadCurrentCycle, localDayOf } from '../training/cycle/currentCycle';

/**
 * Lecture de la constance (PROGRES-b et d) : jours locaux des séances closes, objectif du programme suivi (cycle actif et sa routine) et
 * pauses. Partagée par Progrès et la carte d'Aujourd'hui (blocs à la demande, jamais dans le départ).
 */
export interface ConstancyData {
  readonly days: readonly LocalDate[];
  readonly target: WeeklyTarget | null;
  readonly pauses: readonly MesocyclePause[];
}

/** Tables lues : un lot reçu qui en touche une relit la constance. */
export const CONSTANCY_TABLES = ['workout', 'mesocycle', 'routine', 'routine_day', 'routine_exercise'] as const;

export async function readConstancy(access: DataAccess, today: LocalDate): Promise<ConstancyData> {
  const [starts, cycle] = await Promise.all([(await access.repos.workouts()).closedStarts(), loadCurrentCycle(access, today)]);
  const days = starts.map((iso) => localDayOf(Date.parse(iso)));
  if (cycle === null) return { days, target: null, pauses: [] };
  const routine = await (await access.repos.trainingRoutines()).get(cycle.record.routineId);
  const perWeek = routine === null ? null : programWeeklyTarget(routine.days);
  return { days, target: perWeek === null ? null : { perWeek, since: cycle.record.startDate }, pauses: cycle.record.pauses };
}
