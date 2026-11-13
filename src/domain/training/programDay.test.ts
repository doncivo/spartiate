import { describe, expect, it } from 'vitest';
import { nextProgramDay } from './programDay';

/** ERGO-01b P1 (D-238, D-240) : jour du programme désigné pour la séance du jour. */
const day = (id: string, dayOrder: number, exercises = 1) => ({ id, dayOrder, exercises: Array.from({ length: exercises }, () => ({})) });
const DAYS = [day('b', 2), day('a', 1), day('c', 3), day('vide', 4, 0)];

describe('nextProgramDay', () => {
  it('sans séance close du programme : premier jour (ordre des jours), jamais un jour vide', () => {
    expect(nextProgramDay(DAYS, [], 'r')).toBe('a');
    expect(nextProgramDay(DAYS, [{ routineId: 'autre', routineDayId: 'a' }], 'r')).toBe('a');
  });

  it('après le dernier jour fait (séances récentes d’abord), le suivant, en boucle ; les jours vides sont sautés', () => {
    expect(nextProgramDay(DAYS, [{ routineId: 'r', routineDayId: 'a' }], 'r')).toBe('b');
    expect(nextProgramDay(DAYS, [{ routineId: 'r', routineDayId: 'b' }, { routineId: 'r', routineDayId: 'a' }], 'r')).toBe('c');
    expect(nextProgramDay(DAYS, [{ routineId: 'r', routineDayId: 'c' }], 'r')).toBe('a');
  });

  it('séance libre ou jour disparu : ignorés, on remonte à la précédente séance du programme', () => {
    expect(nextProgramDay(DAYS, [{ routineId: null, routineDayId: null }, { routineId: 'r', routineDayId: 'supprimé' }, { routineId: 'r', routineDayId: 'b' }], 'r')).toBe('c');
  });

  it('aucun jour non vide : null (la carte reste celle d’avant)', () => {
    expect(nextProgramDay([day('vide', 1, 0)], [], 'r')).toBeNull();
    expect(nextProgramDay([], [], 'r')).toBeNull();
  });
});
