import { describe, expect, it } from 'vitest';
import { aggregateDays } from '../../../domain/nutrition/dayTotals';
import type { MealEntryInput, WeighIn } from '../../../domain/nutrition/types';
import type { LocalDate } from '../../../domain/types';
import { firstCheckIn } from './firstCheckIn';

const SUNDAY = '2026-11-08' as LocalDate; // check-in le lundi (ISO 1) : dernier jour passé = lundi 2 novembre, semaine du 26 octobre au 1er novembre
const w = (date: string): WeighIn => ({ date: date as LocalDate, kg: 104 });
const days = (entries: MealEntryInput[] = []) => aggregateDays('2026-10-01' as LocalDate, SUNDAY, entries, {});

describe('0.7.1 point 8 : premier check-in', () => {
  it('dimanche 8 nov., 3 pesées cette semaine seulement : premier check-in lundi 9 nov., avec le décompte de la semaine', () => {
    const r = firstCheckIn(SUNDAY, 1, days(), [w('2026-11-03'), w('2026-11-05'), w('2026-11-06')]);
    expect(r.first).toBe(true);
    if (!r.first) return;
    expect(r.date).toBe('2026-11-09');
    expect(r.weekStart).toBe('2026-11-02');
    expect(r.weekEnd).toBe('2026-11-08');
    expect(r.coverage.weighInDays).toBe(3);
    expect(r.coverage.completeDays).toBe(0);
    expect(r.needDays).toBe(4);
    expect(r.needWeighIns).toBe(2);
  });

  it('aucune donnée du tout : premier check-in', () => {
    expect(firstCheckIn(SUNDAY, 1, days(), []).first).toBe(true);
  });

  it('une donnée dans ou avant la semaine du check-in passé : pas un premier check-in', () => {
    expect(firstCheckIn(SUNDAY, 1, days(), [w('2026-10-28')]).first).toBe(false);
    expect(firstCheckIn(SUNDAY, 1, days(), [w('2026-10-10')]).first).toBe(false);
  });

  it('le jour du check-in lui-même (lundi 9) avec des pesées de la semaine écoulée : plus un premier check-in', () => {
    expect(firstCheckIn('2026-11-09' as LocalDate, 1, days(), [w('2026-11-03')]).first).toBe(false);
  });
});
