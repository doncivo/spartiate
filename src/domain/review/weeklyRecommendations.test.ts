import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import type { MuscleWeight } from '../training/types';
import { RECOMMENDATION_CONFIG, RECOMMENDATION_THEMES, weeklyRecommendations, type Recommendation } from './weeklyRecommendations';
import type { ReviewData } from './weeklyReview';

/**
 * BL-125 (décision d'Ali du 21/11, D-452 ; règles D-457) : une recommandation par thème (entraînement, nutrition, sommeil et récupération),
 * chacune issue d'une règle nommée et sourcée ; sans données, aucune recommandation (`none`), jamais un conseil inventé. Valeurs
 * synthétiques ; semaine du lundi 9 au dimanche 15 novembre 2026.
 */
const d = (s: string): LocalDate => s as LocalDate;
const WEEK = d('2026-11-09');
const MUSCLES: Record<string, readonly MuscleWeight[]> = { bench: [{ id: 'chest', weight: 1 }, { id: 'triceps', weight: 0.5 }], squat: [{ id: 'quads', weight: 1 }] };
const work = (exerciseId: string, n: number) => Array.from({ length: n }, () => ({ exerciseId, setKind: 'work' as const, done: true }));
const EMPTY: ReviewData = {
  firstWeekday: 'monday',
  sessionDays: [],
  target: null,
  pauses: [],
  workouts: [],
  musclesOf: (id) => MUSCLES[id] ?? null,
  records: [],
  weighIns: [],
  nutritionDays: [],
  targetKcal: () => null,
  sleep: [],
  cycleAt: () => null,
};
const byTheme = (list: readonly Recommendation[], theme: Recommendation['theme']): Recommendation => {
  const found = list.find((r) => r.theme === theme);
  if (found === undefined) throw new Error(theme);
  return found;
};
const days = (n: number, kcal: number) => Array.from({ length: n }, (_, i) => ({ date: d(`2026-11-${String(9 + i).padStart(2, '0')}`), usableForTdee: true, kcal }));
const nights = (n: number, minutes: number) => Array.from({ length: n }, (_, i) => ({ day: d(`2026-11-${String(9 + i).padStart(2, '0')}`), minutes }));
const valueOf = (r: Recommendation, fact: string) => r.sources.find((s) => s.fact === fact)?.value;

describe('weeklyRecommendations (BL-125, D-452, D-457)', () => {
  it('trois thèmes, dans l’ordre ; semaine vide : aucune recommandation, la raison est dite', () => {
    const list = weeklyRecommendations(EMPTY, WEEK);
    expect(list.map((r) => r.theme)).toEqual([...RECOMMENDATION_THEMES]);
    expect(list.map((r) => r.kind)).toEqual(['none', 'none', 'none']);
    expect(list.every((r) => r.sources.length === 0)).toBe(true);
  });

  describe('entraînement', () => {
    const base: ReviewData = { ...EMPTY, target: { perWeek: 3, since: d('2026-10-01') } };

    it('séances prévues manquées : viser les séances prévues (règle « séances prévues »)', () => {
      const r = byTheme(weeklyRecommendations({ ...base, sessionDays: [d('2026-11-10')], workouts: [{ day: d('2026-11-10'), sets: work('bench', 12) }] }, WEEK), 'training');
      expect(r).toMatchObject({ kind: 'trainingSessions', rule: 'plannedSessions' });
      expect(valueOf(r, 'sessions.done')).toBe(1);
      expect(valueOf(r, 'sessions.planned')).toBe(3);
    });

    it('séances tenues, muscle au-dessus de 20 séries : réduire (règle « plage de séries », bornes dans les sources)', () => {
      const sessionDays = [d('2026-11-09'), d('2026-11-11'), d('2026-11-13')];
      const workouts = sessionDays.map((day) => ({ day, sets: work('bench', 8) }));
      const r = byTheme(weeklyRecommendations({ ...base, sessionDays, workouts }, WEEK), 'training');
      expect(r).toMatchObject({ kind: 'trainingVolumeHigh', rule: 'setRange' });
      expect(valueOf(r, 'volume.muscle')).toBe('chest');
      expect(valueOf(r, 'volume.sets')).toBe(24);
      expect(valueOf(r, 'range.max')).toBe(RECOMMENDATION_CONFIG.setRange.max);
    });

    it('séances tenues, muscle le plus travaillé sous 10 séries : ajouter des séries', () => {
      const sessionDays = [d('2026-11-09'), d('2026-11-11'), d('2026-11-13')];
      const workouts = sessionDays.map((day) => ({ day, sets: work('bench', 2) }));
      const r = byTheme(weeklyRecommendations({ ...base, sessionDays, workouts }, WEEK), 'training');
      expect(r).toMatchObject({ kind: 'trainingVolumeLow', rule: 'setRange' });
      expect(valueOf(r, 'volume.muscle')).toBe('chest');
      expect(valueOf(r, 'volume.sets')).toBe(6);
      expect(valueOf(r, 'range.min')).toBe(10);
    });

    it('séances tenues et volume dans la plage : garder le plan ; semaine en pause : la règle des séances ne s’applique pas', () => {
      const sessionDays = [d('2026-11-09'), d('2026-11-11'), d('2026-11-13')];
      const workouts = sessionDays.map((day) => ({ day, sets: [...work('bench', 5), ...work('squat', 4)] }));
      expect(byTheme(weeklyRecommendations({ ...base, sessionDays, workouts }, WEEK), 'training')).toMatchObject({ kind: 'trainingKeep', rule: 'setRange' });
      const paused = { ...base, pauses: [{ from: d('2026-11-09'), to: null, lightWeek: false }], sessionDays: [d('2026-11-10')], workouts: [{ day: d('2026-11-10'), sets: [...work('bench', 12), ...work('squat', 12)] }] };
      expect(byTheme(weeklyRecommendations(paused, WEEK), 'training').kind).toBe('trainingKeep');
    });

    it('revue : semaine de pause ou de décharge, volume bas attendu : jamais « ajoute des séries » (règle « semaine allégée »)', () => {
      const low = { sessionDays: [d('2026-11-10')], workouts: [{ day: d('2026-11-10'), sets: work('bench', 6) }] };
      const paused = byTheme(weeklyRecommendations({ ...base, ...low, pauses: [{ from: d('2026-11-09'), to: null, lightWeek: false }] }, WEEK), 'training');
      expect(paused).toMatchObject({ kind: 'trainingLight', rule: 'lightWeek' });
      const deload = byTheme(weeklyRecommendations({ ...base, ...low, target: null, cycleAt: () => ({ week: 5, total: 5, deload: true }) as never }, WEEK), 'training');
      expect(deload).toMatchObject({ kind: 'trainingLight', rule: 'lightWeek' });
      expect(deload.sources.find((x) => x.fact === 'cycle.week')?.value).toBe(5);
    });

    it('aucune séance dans la semaine ni programme : aucune recommandation', () => {
      expect(byTheme(weeklyRecommendations({ ...EMPTY, sessionDays: [d('2026-11-02')] }, WEEK), 'training').kind).toBe('none');
    });
  });

  describe('nutrition', () => {
    it('moins de 3 jours complets : compléter le journal', () => {
      const r = byTheme(weeklyRecommendations({ ...EMPTY, nutritionDays: days(2, 2500), targetKcal: () => 2400 }, WEEK), 'nutrition');
      expect(r).toMatchObject({ kind: 'nutritionLog', rule: 'completeDays' });
      expect(valueOf(r, 'nutrition.completeDays')).toBe(2);
      expect(valueOf(r, 'nutrition.minDays')).toBe(3);
    });

    it('moyenne à plus de 10 % de la cible : s’en rapprocher (au-dessus, en dessous) ; à 10 % ou moins : garder le cap', () => {
      const at = (kcal: number) => byTheme(weeklyRecommendations({ ...EMPTY, nutritionDays: days(4, kcal), targetKcal: () => 2000 }, WEEK), 'nutrition');
      expect(at(2201)).toMatchObject({ kind: 'nutritionAbove', rule: 'targetGap' });
      expect(at(1799)).toMatchObject({ kind: 'nutritionBelow', rule: 'targetGap' });
      expect(at(2200)).toMatchObject({ kind: 'nutritionKeep', rule: 'targetGap' });
      expect(at(1800).kind).toBe('nutritionKeep');
      expect(valueOf(at(2201), 'nutrition.meanKcal')).toBe(2201);
      expect(valueOf(at(2201), 'nutrition.targetKcal')).toBe(2000);
      expect(valueOf(at(2201), 'nutrition.tolerancePct')).toBe(10);
    });

    it('aucun jour complet, ou aucune cible unique : aucune recommandation', () => {
      expect(byTheme(weeklyRecommendations({ ...EMPTY, targetKcal: () => 2000 }, WEEK), 'nutrition').kind).toBe('none');
      expect(byTheme(weeklyRecommendations({ ...EMPTY, nutritionDays: days(5, 2000) }, WEEK), 'nutrition').kind).toBe('none');
    });
  });

  describe('sommeil et récupération', () => {
    it('moyenne sous 7 h sur au moins 3 nuits : viser 7 h ; à 7 h ou plus : garder le rythme', () => {
      const r = byTheme(weeklyRecommendations({ ...EMPTY, sleep: nights(4, 400) }, WEEK), 'recovery');
      expect(r).toMatchObject({ kind: 'recoverySleep', rule: 'sleepDuration' });
      expect(valueOf(r, 'sleep.meanMinutes')).toBe(400);
      expect(valueOf(r, 'sleep.minMinutes')).toBe(420);
      expect(byTheme(weeklyRecommendations({ ...EMPTY, sleep: nights(3, 420) }, WEEK), 'recovery')).toMatchObject({ kind: 'recoveryKeep', rule: 'sleepDuration' });
    });

    it('moins de 3 nuits mesurées : aucune recommandation', () => {
      expect(byTheme(weeklyRecommendations({ ...EMPTY, sleep: nights(2, 300) }, WEEK), 'recovery').kind).toBe('none');
    });
  });
});
