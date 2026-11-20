import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { routineDiff } from './closure';
import { programDayFor } from './programDay';
import { validateRoutine } from './routineRules';

/** FIX-PROGRAMME (lot 0.28.0) : constats C-003 (écart de routine sur deux lignes du même exercice) et C-063 (séance du jour déjà faite). */

const D = (s: string) => s as LocalDate;
const line = (id: string, sets: number, position: number, exerciseId = 'bench') => ({ id, exerciseId, exerciseName: exerciseId, sets, deletedAt: null, position });
const set = (position: number, exerciseId = 'bench', extra: Record<string, unknown> = {}) => ({
  id: `s${position}`,
  position,
  exerciseId,
  exerciseName: exerciseId,
  setKind: 'work',
  deletedAt: null,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetRestSec: 120,
  ...extra,
});
/** Jour : développé couché 3 séries, rowing 3 séries, développé couché 2 séries (deux lignes du même exercice, hors groupe). */
const day = { id: 'd1', deletedAt: null, exercises: [line('L1', 3, 0), line('R', 3, 1, 'row'), line('L2', 2, 2)] };
const diffOf = (sets: readonly ReturnType<typeof set>[]) => routineDiff({ routineDayId: 'd1', sets } as never, day as never);
/** Séance faite à l'identique : 3 couché, 3 rowing, 2 couché. */
const identical = () => [set(0), set(1), set(2), set(3, 'row'), set(4, 'row'), set(5, 'row'), set(6), set(7)];

describe('C-003 « Mettre à jour la routine ? » : séries appariées aux lignes, jamais agrégées par exercice', () => {
  it('preuve de l’audit : deux lignes consécutives 3 + 2, séance identique (5 séries) : aucun écart', () => {
    const twoLines = { id: 'd1', deletedAt: null, exercises: [line('L1', 3, 0), line('L2', 2, 1)] };
    const diff = routineDiff({ routineDayId: 'd1', sets: [0, 1, 2, 3, 4].map((p) => set(p)) } as never, twoLines as never);
    expect(diff.setsChanged).toEqual([]);
    expect(diff.hasChanges).toBe(false);
  });

  it('séance identique, lignes séparées par un autre exercice : aucun écart', () => {
    expect(diffOf(identical()).hasChanges).toBe(false);
  });

  it('une série retirée du premier bloc : écart sur la ligne 1 seule (3 → 2)', () => {
    const diff = diffOf(identical().filter((s) => s.position !== 2));
    expect(diff.setsChanged).toEqual([{ lineId: 'L1', exerciseId: 'bench', exerciseName: 'bench', from: 3, to: 2 }]);
    expect(diff.removed).toEqual([]);
  });

  it('une série ajoutée au second bloc : écart sur la ligne 2 seule (2 → 3)', () => {
    const diff = diffOf([...identical(), set(8)]);
    expect(diff.setsChanged).toEqual([{ lineId: 'L2', exerciseId: 'bench', exerciseName: 'bench', from: 2, to: 3 }]);
  });

  it('second bloc entièrement retiré : la ligne 2 est « retirée », la ligne 1 inchangée', () => {
    const diff = diffOf(identical().filter((s) => s.position < 6));
    expect(diff.setsChanged).toEqual([]);
    expect(diff.removed).toEqual([{ lineId: 'L2', exerciseId: 'bench', exerciseName: 'bench' }]);
  });

  it('échauffements ignorés, une seule ligne par exercice : comportement d’avant (3 → 4)', () => {
    const single = { id: 'd1', deletedAt: null, exercises: [line('L1', 3, 0)] };
    const sets = [set(0, 'bench', { setKind: 'warmup' }), set(1), set(2), set(3), set(4)];
    expect(routineDiff({ routineDayId: 'd1', sets } as never, single as never).setsChanged).toEqual([{ lineId: 'L1', exerciseId: 'bench', exerciseName: 'bench', from: 3, to: 4 }]);
  });

  it('séries entremêlées (autre ordre que les blocs) : réparties dans l’ordre des lignes, jamais le total sur chaque ligne', () => {
    const sets = [set(0), set(1, 'row'), set(2), set(3, 'row'), set(4), set(5, 'row'), set(6), set(7)];
    const diff = diffOf(sets);
    // Cinq séries de couché pour 3 + 2 : aucune ligne ne reçoit 5.
    expect(diff.setsChanged.filter((c) => c.exerciseId === 'bench')).toEqual([]);
  });
});

describe('C-063 séance du jour déjà faite aujourd’hui (jours rattachés, D-316)', () => {
  const days = [
    { id: 'L', dayOrder: 1, weekday: 1, exercises: [1] },
    { id: 'J', dayOrder: 2, weekday: 4, exercises: [1] },
  ];
  it('lundi 16/11, séance « Lundi » close le jour même : « faite », prochaine séance jeudi', () => {
    const r = programDayFor(days, [{ routineId: 'r', routineDayId: 'L', day: D('2026-11-16') }], 'r', D('2026-11-16'));
    expect(r).toEqual({ kind: 'done', dayId: 'L', nextDayId: 'J', nextWeekday: 4 });
  });
  it('même séance close le lundi précédent : le jour reste proposé', () => {
    expect(programDayFor(days, [{ routineId: 'r', routineDayId: 'L', day: D('2026-11-09') }], 'r', D('2026-11-16'))).toEqual({ kind: 'day', dayId: 'L' });
  });
  it('séance du jour faite d’une autre routine, ou sans date connue : le jour reste proposé', () => {
    expect(programDayFor(days, [{ routineId: 'x', routineDayId: 'L', day: D('2026-11-16') }], 'r', D('2026-11-16'))).toEqual({ kind: 'day', dayId: 'L' });
    expect(programDayFor(days, [{ routineId: 'r', routineDayId: 'L' }], 'r', D('2026-11-16'))).toEqual({ kind: 'day', dayId: 'L' });
  });
  it('un seul jour rattaché, fait aujourd’hui : la prochaine séance est le même jour la semaine suivante', () => {
    const only = [{ id: 'L', dayOrder: 1, weekday: 1, exercises: [1] }];
    expect(programDayFor(only, [{ routineId: 'r', routineDayId: 'L', day: D('2026-11-16') }], 'r', D('2026-11-16'))).toEqual({ kind: 'done', dayId: 'L', nextDayId: 'L', nextWeekday: 1 });
  });
});

describe('C-065 échange de deux jours de la semaine : le brouillon seul est contrôlé', () => {
  it('Jour 1 mardi, Jour 2 lundi (échange) : admis ; deux jours au lundi : refusé', () => {
    const d = (weekday: number | null, dayOrder: number) => ({ name: `Jour ${dayOrder}`, dayOrder, weekday, exercises: [] });
    expect(validateRoutine({ name: 'R', mode: 'programme', days: [d(2, 1), d(1, 2)] } as never)).toEqual([]);
    expect(validateRoutine({ name: 'R', mode: 'programme', days: [d(1, 1), d(1, 2)] } as never).map((i) => i.code)).toEqual(['day-weekday-duplicate']);
  });
});
