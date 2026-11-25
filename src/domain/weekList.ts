import type { ChecklistSummary, Task } from './model';
import { buildTodayList, type TodayEventEntry, type TodayList, type TodayRoutineEntry } from './todayList';
import type { LocalDate, SpaceFilter } from './types';
import { weekDays } from './week';

/**
 * Semaine assemblée jour par jour (S-01, S-02, héritage de CircleTasks) : sortie de `week.ts` en DATA-0295 (BL-035) pour rompre le cycle
 * statique `goalRules → week → todayList → goalRules` ; `week.ts` (dates de semaine, dans le bundle de départ) n'importe plus `todayList`.
 */

/** Éléments d'un jour fournis par les autres modules (routines, événements, checklists) : même forme que pour Aujourd'hui. */
export interface WeekDayExtras {
  readonly routines?: readonly TodayRoutineEntry[];
  readonly events?: readonly TodayEventEntry[];
  readonly checklists?: readonly ChecklistSummary[];
}

export interface WeekInput {
  readonly weekStart: LocalDate;
  readonly filter: SpaceFilter;
  readonly tasks: readonly Task[];
  /** Éléments des autres modules par jour ; un jour absent n'a que ses tâches. */
  readonly extras?: ReadonlyMap<LocalDate, WeekDayExtras>;
  /** Événements des agendas externes par jour (S-05, `externalEventsByDay`) : ajoutés aux événements fournis par les sources. */
  readonly externalEvents?: ReadonlyMap<LocalDate, readonly TodayEventEntry[]>;
}

export interface WeekDay {
  readonly date: LocalDate;
  /** Liste du jour, assemblée comme celle d'Aujourd'hui (`buildTodayList` : événements, éléments à faire, terminés). */
  readonly list: TodayList;
}

/**
 * Assemble les sept jours de la semaine en réutilisant `buildTodayList` pour chacun (S-01 critère 4) : événements en tête,
 * éléments avec heure par heure, puis sans heure dans leur ordre manuel (Q11), terminés en bas (T-04). Les tâches sont
 * réparties par date en une seule passe (5 000 tâches : une lecture, pas sept).
 */
export function buildWeek(input: WeekInput): WeekDay[] {
  const days = weekDays(input.weekStart);
  const byDate = new Map<LocalDate, Task[]>(days.map((date) => [date, []]));
  for (const task of input.tasks) {
    if (task.date === null) continue;
    byDate.get(task.date)?.push(task);
  }
  return days.map((date) => {
    const extras = input.extras?.get(date);
    const external = input.externalEvents?.get(date);
    const events = external ? [...(extras?.events ?? []), ...external] : extras?.events;
    return {
      date,
      list: buildTodayList({
        date,
        filter: input.filter,
        tasks: byDate.get(date) ?? [],
        ...(extras?.routines ? { routines: extras.routines } : {}),
        ...(events ? { events } : {}),
        ...(extras?.checklists ? { checklists: extras.checklists } : {}),
      }),
    };
  });
}

/**
 * Position finale, dans les éléments à faire du jour (`rows`, routines comprises), de la tâche `draggedId` lâchée à la position
 * `dropIndex` parmi les AUTRES tâches du jour (à faire puis terminées, dans l'ordre affiché), telle que la mesure le glisser :
 * nombre d'autres tâches situées au-dessus du pointeur. Lâchée après la dernière tâche à faire, elle passe en fin de liste.
 * Le domaine (`moveTaskRow`) ramène ensuite cette position dans le groupe autorisé par l'heure (Q11).
 */
export function rowIndexForDrop(list: Pick<TodayList, 'rows' | 'doneRows'>, draggedId: string, dropIndex: number): number {
  const others = [...list.rows, ...list.doneRows].filter((row) => row.kind === 'task' && row.id !== draggedId);
  const rowsWithout = list.rows.filter((row) => row.id !== draggedId);
  const anchor = others[Math.max(0, Math.trunc(dropIndex))];
  if (!anchor) return rowsWithout.length;
  const position = rowsWithout.findIndex((row) => row.id === anchor.id);
  return position < 0 ? rowsWithout.length : position;
}
