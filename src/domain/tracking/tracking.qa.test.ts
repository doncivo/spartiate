import { describe, expect, it } from 'vitest';
import { parseVisbodyForm, visbodyChange, visbodyReports } from '../bodyProgress/visbody';
import { stepsToday, stepsWeeks } from './steps';
import { hrMaxOf, zone2Range, zone2Weeks } from './zone2';
import { ratingSeries } from './ratings';

/** SUIVIS-029, passe qa-test : cas limites (valeurs illisibles, bornes exactes, changement d'année, semaine du lundi). */
describe('cas limites des suivis', () => {
  it('pas : total négatif ou non fini ignoré (jamais compté) ; jour illisible ignoré dans les semaines', () => {
    const days = [{ day: '2026-11-21', steps: Number.NaN }, { day: '2026-11-21', steps: -5 }];
    expect(stepsToday({ platform: 'phone', days, everRead: true, today: '2026-11-21', goal: 8000 })).toEqual({ kind: 'unknown', reason: 'no_today', goal: 8000 });
    expect(stepsWeeks([{ day: 'pas-une-date', steps: 5000 }], '2026-11-21', 8000, 1)[0]?.knownDays).toBe(0);
  });

  it('pas : semaine du lundi même quand aujourd’hui est lundi ou dimanche', () => {
    expect(stepsWeeks([], '2026-11-16', 8000, 1)[0]?.weekStart).toBe('2026-11-16');
    expect(stepsWeeks([], '2026-11-22', 8000, 1)[0]?.weekStart).toBe('2026-11-16');
  });

  it('zone 2 : bornes exactes comptées, une unité de part et d’autre exclue ; durée exacte (secondes) arrondie à la minute', () => {
    const range = zone2Range(184);
    const s = (avgHr: number) => ({ startedAt: '2026-11-17T07:00:00.000Z', durationSec: 1530, avgHr });
    const week = (avgHr: number) => zone2Weeks([s(avgHr)], range, '2026-11-21', 'Europe/Paris', 1)[0];
    expect(week(range.low)?.minutes).toBe(26);
    expect(week(range.high)?.minutes).toBe(26);
    expect(week(range.low - 1)?.minutes).toBe(0);
    expect(week(range.high + 1)?.sessionsInZone).toBe(0);
  });

  it('zone 2 : âge limite (10 et 110 ans) admis, au-delà aucune FC max', () => {
    expect(hrMaxOf({ entered: null, birthYear: 2016, currentYear: 2026 })?.value).toBe(210);
    expect(hrMaxOf({ entered: null, birthYear: 1916, currentYear: 2026 })?.value).toBe(110);
    expect(hrMaxOf({ entered: null, birthYear: 2017, currentYear: 2026 })).toBeNull();
  });

  it('notes : valeur hors 1–10 ignorée dans la courbe (jamais tracée)', () => {
    expect(ratingSeries([{ day: '2026-11-21', value: 12 }], '2026-11-21', 1)).toEqual({ points: [null], average: null, days: 0 });
  });

  it('VISBODY : bornes de saisie exactes admises ; métabolisme arrondi au kcal avant stockage', () => {
    expect(parseVisbodyForm({ visbody_weight_kg: '20', visbody_fat_pct: '70', visbody_bmr_dakcal: '5000' }, '2026-11-21', '2026-11-21')).toMatchObject({ ok: true, values: { visbody_weight_kg: 20, visbody_fat_pct: 70, visbody_bmr_dakcal: 500 } });
    expect(parseVisbodyForm({ visbody_weight_kg: '19,9' }, '2026-11-21', '2026-11-21')).toMatchObject({ ok: false, fields: { visbody_weight_kg: 'range' } });
    expect(parseVisbodyForm({ visbody_weight_kg: '' }, '', '2026-11-21')).toMatchObject({ ok: false, empty: true, date: 'date' });
  });

  it('VISBODY : écart au bilan PRÉCÉDENT qui porte la mesure (un bilan intermédiaire sans elle est sauté)', () => {
    const reports = visbodyReports([
      { day: '2026-10-01', kind: 'visbody_fat_pct', value: 20 },
      { day: '2026-10-15', kind: 'visbody_weight_kg', value: 80 },
      { day: '2026-11-01', kind: 'visbody_fat_pct', value: 18.5 },
    ]);
    expect(visbodyChange(reports, 'visbody_fat_pct')).toMatchObject({ previous: { date: '2026-10-01', value: 20 }, delta: -1.5 });
  });
});
