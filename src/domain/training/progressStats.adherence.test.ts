import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import type { MesocyclePause } from './mesocycle';
import { adherence } from './progressStats';

/** PROGRES-d (I2, § 8) : part des séances prévues faites sur les 4 dernières semaines complètes. Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;
const TODAY = d('2026-11-18'); // semaine en cours (16/11) exclue
const sessions = (monday: string, n: number): LocalDate[] => Array.from({ length: n }, (_, i) => d(`${monday.slice(0, 8)}${String(Number(monday.slice(8)) + i).padStart(2, '0')}`));
// S-1 (09/11) 3, S-2 (02/11) 2, S-3 (26/10) 4, S-4 (19/10) 1 ; S-5 (12/10) 3 hors fenêtre ; cette semaine 3 (non comptée).
const DAYS = [...sessions('2026-11-09', 3), ...sessions('2026-11-02', 2), ...sessions('2026-10-26', 4), ...sessions('2026-10-19', 1), ...sessions('2026-10-12', 3), ...sessions('2026-11-16', 3)];
const TARGET = { perWeek: 3, since: d('2026-10-01') };

describe('adherence', () => {
  it('objectif 3 : (3 + 2 + 3 + 1) / 12 = 75 % ; une semaine au-dessus de l’objectif ne compense pas une autre', () => {
    expect(adherence({ days: DAYS, today: TODAY, target: TARGET, pauses: [] })).toEqual({ percent: 75, done: 9, planned: 12, weeks: 4 });
  });

  it('semaine avec un jour de pause ou antérieure au début du programme : non comptée', () => {
    const pause: MesocyclePause[] = [{ from: d('2026-10-20'), to: d('2026-10-22'), lightWeek: false }];
    expect(adherence({ days: DAYS, today: TODAY, target: TARGET, pauses: pause })).toEqual({ percent: 89, done: 8, planned: 9, weeks: 3 });
    expect(adherence({ days: DAYS, today: TODAY, target: { perWeek: 3, since: d('2026-11-04') }, pauses: [] })).toEqual({ percent: 83, done: 5, planned: 6, weeks: 2 });
  });

  it('sans programme suivi, ou programme commencé cette semaine : non calculée (null)', () => {
    expect(adherence({ days: DAYS, today: TODAY, target: null, pauses: [] })).toBeNull();
    expect(adherence({ days: DAYS, today: TODAY, target: { perWeek: 3, since: d('2026-11-16') }, pauses: [] })).toBeNull();
  });
});
