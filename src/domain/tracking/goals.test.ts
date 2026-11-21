import { describe, expect, it } from 'vitest';
import { parseGoalText, parseTrackingGoals, serializeTrackingGoals, TRACKING_DEFAULTS, TRACKING_GOAL_BOUNDS } from './goals';

/** SUIVIS-029a/b : objectifs de suivi (réglage local `tracking.goals`), valeur brute relue sans jamais casser l'écran. */
describe('parseTrackingGoals', () => {
  it('valeur absente ou illisible : objectifs par défaut (8 000 pas, 150 min de zone 2, FC max non saisie)', () => {
    expect(TRACKING_DEFAULTS).toEqual({ stepsDaily: 8000, zone2WeeklyMin: 150, hrMax: null });
    for (const raw of [null, undefined, 'x', 3, [], { v: 2, stepsDaily: 9000 }]) expect(parseTrackingGoals(raw)).toEqual(TRACKING_DEFAULTS);
  });

  it('valeur valide relue ; champ hors bornes ou non entier : sa valeur par défaut, les autres gardés', () => {
    expect(parseTrackingGoals({ v: 1, stepsDaily: 10000, zone2WeeklyMin: 90, hrMax: 182 })).toEqual({ stepsDaily: 10000, zone2WeeklyMin: 90, hrMax: 182 });
    expect(parseTrackingGoals({ v: 1, stepsDaily: 500, zone2WeeklyMin: 90.5, hrMax: 260 })).toEqual(TRACKING_DEFAULTS);
    expect(parseTrackingGoals({ v: 1, stepsDaily: 12000, zone2WeeklyMin: '90', hrMax: null })).toEqual({ stepsDaily: 12000, zone2WeeklyMin: 150, hrMax: null });
  });

  it('aller-retour sérialisé', () => {
    const goals = { stepsDaily: 7500, zone2WeeklyMin: 120, hrMax: 175 };
    expect(serializeTrackingGoals(goals)).toEqual({ v: 1, ...goals });
    expect(parseTrackingGoals(serializeTrackingGoals(goals))).toEqual(goals);
  });
});

describe('parseGoalText', () => {
  it('pas : entier dans les bornes, espaces de milliers admis', () => {
    expect(parseGoalText('stepsDaily', '10 000')).toEqual({ ok: true, value: 10000 });
    expect(parseGoalText('stepsDaily', '8000')).toEqual({ ok: true, value: 8000 });
    expect(parseGoalText('stepsDaily', '')).toEqual({ ok: false, issue: 'empty' });
    expect(parseGoalText('stepsDaily', '8,5')).toEqual({ ok: false, issue: 'format' });
    expect(parseGoalText('stepsDaily', String(TRACKING_GOAL_BOUNDS.stepsDaily.min - 1))).toEqual({ ok: false, issue: 'range' });
    expect(parseGoalText('stepsDaily', String(TRACKING_GOAL_BOUNDS.stepsDaily.max + 1))).toEqual({ ok: false, issue: 'range' });
  });

  it('zone 2 : minutes par semaine bornées ; FC max : vide = non saisie (220 − âge), sinon bornée', () => {
    expect(parseGoalText('zone2WeeklyMin', '150')).toEqual({ ok: true, value: 150 });
    expect(parseGoalText('zone2WeeklyMin', '5')).toEqual({ ok: false, issue: 'range' });
    expect(parseGoalText('hrMax', '  ')).toEqual({ ok: true, value: null });
    expect(parseGoalText('hrMax', '185')).toEqual({ ok: true, value: 185 });
    expect(parseGoalText('hrMax', '90')).toEqual({ ok: false, issue: 'range' });
    expect(parseGoalText('hrMax', 'abc')).toEqual({ ok: false, issue: 'format' });
  });
});
