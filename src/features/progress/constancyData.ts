import { programWeeklyTarget, type WeeklyTarget } from '../../domain/training/progressStats';
import type { MesocyclePause } from '../../domain/training/mesocycle';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';

/**
 * Lecture de la constance (PROGRES-b et d) : jours locaux des séances closes, objectif du programme suivi (cycle actif et sa routine) et
 * pauses. Partagée par Progrès et la carte d'Aujourd'hui (blocs à la demande, jamais dans le départ).
 */
/** Date locale de l'appareil d'un instant (recopiée de cycle/currentCycle.ts : l'importer partageait un bloc avec la carte Séance et allongeait la
 * liste de préchargement du départ, mesure du bundle). */
export function localDayOf(ms: number): LocalDate {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as LocalDate;
}

export interface ConstancyData {
  readonly days: readonly LocalDate[];
  readonly target: WeeklyTarget | null;
  readonly pauses: readonly MesocyclePause[];
}

/** Tables lues : un lot reçu qui en touche une relit la constance. */
export const CONSTANCY_TABLES = ['workout', 'mesocycle', 'routine', 'routine_day', 'routine_exercise'] as const;

/** Cycle suivi : le cycle actif non supprimé le plus récent (`MesocycleRepository.current`). */
export async function readConstancy(access: DataAccess): Promise<ConstancyData> {
  const [starts, cycle] = await Promise.all([(await access.repos.workouts()).closedStarts(), (await access.repos.mesocycles()).current()]);
  const days = starts.map((iso) => localDayOf(Date.parse(iso)));
  if (cycle === null) return { days, target: null, pauses: [] };
  const routine = await (await access.repos.trainingRoutines()).get(cycle.routineId);
  const perWeek = routine === null ? null : programWeeklyTarget(routine.days);
  return { days, target: perWeek === null ? null : { perWeek, since: cycle.startDate }, pauses: cycle.pauses };
}
