import { describe, expect, it } from 'vitest';
import { stepsToday, stepsWeeks, type StepsDay } from './steps';

/** SUIVIS-029a : objectif de pas. Source `pas.csv` (H-25 UNVERIFIED) : sans total lisible, « — » et sa raison, jamais 0. */
const d = (day: string, steps: number): StepsDay => ({ day, steps });

describe('stepsToday', () => {
  const base = { platform: 'phone' as const, everRead: true, today: '2026-11-21', goal: 8000 };

  it('total du jour : pas, objectif, pourcentage arrondi, objectif atteint ou non', () => {
    expect(stepsToday({ ...base, days: [d('2026-11-20', 9000), d('2026-11-21', 6500)] })).toEqual({ kind: 'value', steps: 6500, goal: 8000, percent: 81, reached: false });
    expect(stepsToday({ ...base, days: [d('2026-11-21', 8000)] })).toEqual({ kind: 'value', steps: 8000, goal: 8000, percent: 100, reached: true });
    expect(stepsToday({ ...base, days: [d('2026-11-21', 12000)] })).toMatchObject({ percent: 150, reached: true });
  });

  it('raisons : PC, lecture impossible, pas.csv jamais lu, aucun total aujourd’hui — jamais une valeur 0', () => {
    expect(stepsToday({ ...base, platform: 'pc', days: [d('2026-11-21', 6500)] })).toEqual({ kind: 'unknown', reason: 'on_pc', goal: 8000 });
    expect(stepsToday({ ...base, days: null })).toEqual({ kind: 'unknown', reason: 'read_failed', goal: 8000 });
    expect(stepsToday({ ...base, everRead: false, days: [] })).toEqual({ kind: 'unknown', reason: 'never_read', goal: 8000 });
    expect(stepsToday({ ...base, days: [d('2026-11-20', 9000)] })).toEqual({ kind: 'unknown', reason: 'no_today', goal: 8000 });
  });

  it('un total à 0 pas lu dans le fichier est un fait (0 %), pas une absence', () => {
    expect(stepsToday({ ...base, days: [d('2026-11-21', 0)] })).toEqual({ kind: 'value', steps: 0, goal: 8000, percent: 0, reached: false });
  });
});

describe('stepsWeeks', () => {
  it('4 semaines du lundi, la plus récente d’abord ; moyenne sur les jours connus ; jours à l’objectif', () => {
    const weeks = stepsWeeks([d('2026-11-16', 10000), d('2026-11-17', 6000), d('2026-11-21', 8000), d('2026-11-10', 4000), d('2026-10-01', 9999)], '2026-11-21', 8000);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02', '2026-10-26']);
    expect(weeks[0]).toEqual({ weekStart: '2026-11-16', average: 8000, knownDays: 3, daysAtGoal: 2 });
    expect(weeks[1]).toEqual({ weekStart: '2026-11-09', average: 4000, knownDays: 1, daysAtGoal: 0 });
    expect(weeks[2]).toEqual({ weekStart: '2026-11-02', average: null, knownDays: 0, daysAtGoal: 0 });
  });

  it('jour futur ignoré ; deux totaux du même jour : le dernier gagne (jamais additionnés) ; nombre de semaines réglable', () => {
    const weeks = stepsWeeks([d('2026-11-22', 50000), d('2026-11-21', 1000), d('2026-11-21', 3000)], '2026-11-21', 8000, 1);
    expect(weeks).toEqual([{ weekStart: '2026-11-16', average: 3000, knownDays: 1, daysAtGoal: 0 }]);
  });

  it('moyenne arrondie au pas', () => {
    expect(stepsWeeks([d('2026-11-16', 1000), d('2026-11-17', 1001)], '2026-11-21', 8000, 1)[0]?.average).toBe(1001);
  });
});
