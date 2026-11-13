/**
 * ERGO-01b P1 (D-238, D-243) : jour du programme désigné pour la séance du jour. Règle pure, sans date : le jour qui suit, dans l'ordre des
 * jours de la routine du programme, le dernier jour fait (séance close issue de cette routine) ; en boucle ; les jours sans exercice sont
 * sautés. Sans séance du programme : le premier jour. Une séance libre, d'une autre routine ou d'un jour disparu ne compte pas.
 */

export interface ProgramDayLike {
  readonly id: string;
  readonly dayOrder: number;
  readonly exercises: readonly unknown[];
}

export interface ClosedWorkoutLike {
  readonly routineId: string | null;
  readonly routineDayId: string | null;
}

/** `recentClosed` : séances closes, les plus récentes d'abord. Rend l'identifiant du jour, ou null si aucun jour n'a d'exercice. */
export function nextProgramDay(days: readonly ProgramDayLike[], recentClosed: readonly ClosedWorkoutLike[], routineId: string): string | null {
  const ordered = days.filter((d) => d.exercises.length > 0).sort((a, b) => a.dayOrder - b.dayOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (ordered.length === 0) return null;
  for (const w of recentClosed) {
    if (w.routineId !== routineId || w.routineDayId === null) continue;
    const index = ordered.findIndex((d) => d.id === w.routineDayId);
    if (index < 0) continue;
    return (ordered[(index + 1) % ordered.length] as ProgramDayLike).id;
  }
  return (ordered[0] as ProgramDayLike).id;
}
