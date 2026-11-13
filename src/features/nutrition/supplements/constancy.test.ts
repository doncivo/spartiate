import { describe, expect, it } from 'vitest';
import type { Supplement, SupplementIntake } from '../../../domain/nutrition/supplements';
import type { LocalDate, LocalTime } from '../../../domain/types';
import { constancyDays } from './constancy';

const d = (s: string): LocalDate => s as LocalDate;
const t = (s: string): LocalTime => s as LocalTime;
const supp = (id: string, times: string[], since = '2026-10-01'): Supplement =>
  ({ id, name: id, dose: null, unit: null, times: times.map(t), days: 127, active: true, since: d(since) }) as unknown as Supplement;
const taken = (id: string, date: string, time: string): SupplementIntake => ({ supplementId: id, date: d(date), moment: t(time) });

/** ERGO-02 (C1) : la bande « Constance · 14 jours » de l'écran Compléments (niveau par jour, texte pour chaque niveau). */
describe('constancyDays', () => {
  const today = d('2026-11-13');

  it('14 jours, du plus ancien au plus récent, aujourd’hui en dernier', () => {
    const days = constancyDays([supp('a', ['08:00'])], [], today, 14);
    expect(days).toHaveLength(14);
    expect(days[0]!.date).toBe('2026-10-31');
    expect(days[13]!.date).toBe('2026-11-13');
  });

  it('plein : tout pris ; partiel : en partie ; vide : rien pris ; libre : rien de prévu', () => {
    const s = [supp('a', ['08:00', '20:00']), supp('b', ['08:00'], '2026-11-12')];
    const intakes = [taken('a', '2026-11-12', '08:00'), taken('a', '2026-11-12', '20:00'), taken('b', '2026-11-12', '08:00'), taken('a', '2026-11-13', '08:00')];
    const days = constancyDays(s, intakes, today, 14);
    expect(days.find((x) => x.date === '2026-11-12')).toMatchObject({ level: 'full', due: 3, taken: 3 });
    expect(days.find((x) => x.date === '2026-11-13')).toMatchObject({ level: 'partial', due: 3, taken: 1 });
    expect(days.find((x) => x.date === '2026-11-11')).toMatchObject({ level: 'none', due: 2, taken: 0 });
    expect(constancyDays([], [], today, 14).every((x) => x.level === 'free' && x.due === 0)).toBe(true);
  });

  it('un complément créé aujourd’hui ne rend aucun jour passé « dû »', () => {
    const days = constancyDays([supp('a', ['08:00'], '2026-11-13')], [], today, 14);
    expect(days.slice(0, 13).every((x) => x.level === 'free')).toBe(true);
  });
});
