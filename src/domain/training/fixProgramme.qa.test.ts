import { describe, expect, it } from 'vitest';
import { cycleWeeksToWrite, emptyDraft, reviewCycleWeeks, reviewStart, NO_CURRENT } from '../onboarding';
import type { LocalDate } from '../types';
import { routineDiff } from './closure';
import { programDayFor } from './programDay';
import { weekdaysToRelease } from './routineRules';

/** FIX-PROGRAMME, passe qa-test : cas limites des cinq corrections. */

const D = (s: string) => s as LocalDate;
const line = (id: string, exerciseId: string, sets: number, position: number) => ({ id, exerciseId, exerciseName: exerciseId, sets, deletedAt: null, position });
const set = (position: number, exerciseId: string, circuitId: string | null = null, extra: Record<string, unknown> = {}) => ({
  id: `s${position}`,
  position,
  exerciseId,
  exerciseName: exerciseId,
  setKind: 'work',
  deletedAt: null,
  circuitId,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetRestSec: 120,
  ...extra,
});

describe('C-003 qa : groupes, séries supprimées, lignes supprimées', () => {
  // Ligne 1 : couché dans un groupe avec le rowing (2 tours) ; ligne 3 : couché hors groupe, 2 séries.
  const day = { id: 'd1', deletedAt: null, exercises: [line('A', 'bench', 2, 0), line('B', 'row', 2, 1), line('C', 'bench', 2, 2)] };
  const diffOf = (sets: readonly ReturnType<typeof set>[]) => routineDiff({ routineDayId: 'd1', sets } as never, day as never);
  it('groupe A1 B1 A2 B2 puis couché libre × 2 : aucun écart', () => {
    expect(diffOf([set(0, 'bench', 'g'), set(1, 'row', 'g'), set(2, 'bench', 'g'), set(3, 'row', 'g'), set(4, 'bench'), set(5, 'bench')]).hasChanges).toBe(false);
  });
  it('un tour ajouté au groupe : écart sur la ligne du groupe (2 → 3) et le rowing (2 → 3), pas sur la ligne libre', () => {
    const diff = diffOf([set(0, 'bench', 'g'), set(1, 'row', 'g'), set(2, 'bench', 'g'), set(3, 'row', 'g'), set(4, 'bench', 'g'), set(5, 'row', 'g'), set(6, 'bench'), set(7, 'bench')]);
    expect(diff.setsChanged.map((c) => [c.lineId, c.from, c.to])).toEqual([
      ['A', 2, 3],
      ['B', 2, 3],
    ]);
  });
  it('série supprimée (deletedAt) ou échauffement entre deux séries : le bloc n’est pas coupé', () => {
    const sets = [set(0, 'bench', 'g'), set(1, 'row', 'g'), set(2, 'bench', 'g'), set(3, 'row', 'g'), set(4, 'bench'), set(5, 'bench', null, { setKind: 'warmup' }), set(6, 'row', null, { deletedAt: '2026-11-16T10:00:00.000Z' }), set(7, 'bench')];
    expect(diffOf(sets).hasChanges).toBe(false);
  });
  it('ligne supprimée du jour : ignorée, la ligne vivante reçoit les séries', () => {
    const withDeleted = { id: 'd1', deletedAt: null, exercises: [{ ...line('X', 'bench', 3, 0), deletedAt: '2026-11-10T10:00:00.000Z' }, line('Y', 'bench', 2, 1)] };
    expect(routineDiff({ routineDayId: 'd1', sets: [set(0, 'bench'), set(1, 'bench')] } as never, withDeleted as never).hasChanges).toBe(false);
  });
});

describe('C-063 qa : bouclage de la semaine', () => {
  const days = [
    { id: 'L', dayOrder: 1, weekday: 1, exercises: [1] },
    { id: 'S', dayOrder: 2, weekday: 7, exercises: [1] },
  ];
  it('dimanche 22/11 fait : prochaine séance lundi', () => {
    expect(programDayFor(days, [{ routineId: 'r', routineDayId: 'S', day: D('2026-11-22') }], 'r', D('2026-11-22'))).toEqual({ kind: 'done', dayId: 'S', nextDayId: 'L', nextWeekday: 1 });
  });
  it('jour de repos (mercredi) : inchangé, prochaine séance dimanche', () => {
    expect(programDayFor(days, [], 'r', D('2026-11-18'))).toEqual({ kind: 'rest', nextDayId: 'S', nextWeekday: 7 });
  });
  it('séance d’un autre jour de la routine close aujourd’hui (« Autre séance… ») : le jour du jour reste proposé', () => {
    expect(programDayFor(days, [{ routineId: 'r', routineDayId: 'S', day: D('2026-11-16') }], 'r', D('2026-11-16'))).toEqual({ kind: 'day', dayId: 'L' });
  });
});

describe('C-065 qa : jours à libérer', () => {
  it('seuls les jours enregistrés dont le jour de la semaine (non vide) change', () => {
    const before = [{ id: 'a', weekday: 1 }, { id: 'b', weekday: null }, { id: 'c', weekday: 3 }, { id: 'd', weekday: 5 }];
    const after = [{ id: 'a', weekday: 2 }, { id: 'b', weekday: 1 }, { id: 'c', weekday: 3 }, { id: 'e', weekday: 5 }];
    expect(weekdaysToRelease(before, after)).toEqual(['a']);
    expect(weekdaysToRelease([{ id: 'a', weekday: 1 }], [{ id: 'a', weekday: null }])).toEqual(['a']);
    expect(weekdaysToRelease([{ id: 'a' }], [{ id: 'a', weekday: 1 }])).toEqual([]);
  });
});

describe('C-117 qa : durée de la revue', () => {
  it('lecture du réglage : 4, 5, 6 seulement', () => {
    expect([4, 5, 6, 7, 'unlimited', null, '6'].map(reviewCycleWeeks)).toEqual([4, 5, 6, null, null, null, null]);
  });
  it('écriture : toujours au premier passage, en revue seulement si changée', () => {
    const draft = { ...emptyDraft(), mesoWeeks: 6 as const };
    expect(cycleWeeksToWrite(draft, null)).toBe(6);
    expect(cycleWeeksToWrite(draft, { ...draft })).toBeNull();
    expect(cycleWeeksToWrite(draft, { ...draft, mesoWeeks: 4 })).toBe(6);
  });
  it('point de départ : réglage courant, sinon la réponse de l’assistant', () => {
    const answers = { ...emptyDraft(), mesoWeeks: 4 as const };
    expect(reviewStart(answers, { ...NO_CURRENT, cycleWeeks: 6 }).mesoWeeks).toBe(6);
    expect(reviewStart(answers, { ...NO_CURRENT, cycleWeeks: null }).mesoWeeks).toBe(4);
    expect(reviewStart(answers, NO_CURRENT).mesoWeeks).toBe(4);
  });
});
