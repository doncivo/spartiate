import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import type { MuscleWeight } from '../training/types';
import { numbersIn, REVIEW_CONFIG, REVIEW_THEMES, reviewWeekStarts, weeklyReview, type ReviewData, type ReviewSentence } from './weeklyReview';

/**
 * BILAN-029 (§ 17.3, modèle de secours ; D-294, D-410) : vecteurs du bilan hebdomadaire par règles. Valeurs synthétiques ; semaine du lundi
 * 9 au dimanche 15 novembre 2026, « aujourd'hui » le mercredi 18.
 */

const d = (s: string): LocalDate => s as LocalDate;
const WEEK = d('2026-11-09');
const MUSCLES: Record<string, readonly MuscleWeight[]> = {
  bench: [
    { id: 'chest', weight: 1 },
    { id: 'triceps', weight: 0.5 },
  ],
  row: [{ id: 'back', weight: 1 }],
  squat: [{ id: 'quads', weight: 1 }],
};
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

const FULL: ReviewData = {
  ...EMPTY,
  sessionDays: [d('2026-11-02'), d('2026-11-09'), d('2026-11-11'), d('2026-11-13'), d('2026-11-14')],
  target: { perWeek: 4, since: d('2026-10-19') },
  workouts: [
    { day: d('2026-11-09'), sets: [...work('bench', 4), ...work('row', 3)] },
    { day: d('2026-11-11'), sets: [...work('squat', 5), { exerciseId: 'bench', setKind: 'warmup', done: true }] },
    { day: d('2026-11-13'), sets: [...work('bench', 3), ...work('row', 3), { exerciseId: 'row', setKind: 'work', done: false }] },
    { day: d('2026-11-14'), sets: work('squat', 2) },
    { day: d('2026-11-02'), sets: work('bench', 10) },
  ],
  records: [
    { day: d('2026-11-09'), exerciseName: 'Développé couché' },
    { day: d('2026-11-09'), exerciseName: 'Développé couché' },
    { day: d('2026-11-11'), exerciseName: 'Squat' },
    { day: d('2026-11-03'), exerciseName: 'Rowing' },
  ],
  weighIns: [
    { date: d('2026-11-01'), kg: 81 },
    { date: d('2026-11-08'), kg: 80.8 },
    { date: d('2026-11-12'), kg: 80.4 },
    { date: d('2026-11-15'), kg: 80.2 },
  ],
  nutritionDays: [
    { date: d('2026-11-09'), usableForTdee: true, kcal: 2400 },
    { date: d('2026-11-10'), usableForTdee: true, kcal: 2601 },
    { date: d('2026-11-11'), usableForTdee: false, kcal: 900 },
    { date: d('2026-11-12'), usableForTdee: true, kcal: 2500 },
    { date: d('2026-11-16'), usableForTdee: true, kcal: 5000 },
  ],
  targetKcal: (end) => (end === d('2026-11-15') ? 2500 : null),
  sleep: [
    { day: d('2026-11-09'), minutes: 420 },
    { day: d('2026-11-10'), minutes: 450 },
    { day: d('2026-11-11'), minutes: null },
    { day: d('2026-11-12'), minutes: 401 },
    { day: d('2026-11-16'), minutes: 600 },
  ],
  cycleAt: (end) => (end === d('2026-11-15') ? { week: 4, total: 5, deload: false } : null),
};

const byTheme = (sentences: readonly ReviewSentence[], theme: ReviewSentence['theme']): ReviewSentence => {
  const s = sentences.find((x) => x.theme === theme);
  if (s === undefined) throw new Error(theme);
  return s;
};
const value = (s: ReviewSentence, fact: string): unknown => s.sources.find((x) => x.fact === fact)?.value;

describe('BILAN-029 : semaines du bilan', () => {
  it('dernière semaine COMPLÈTE d’abord, puis les précédentes ; au réglage « Début de semaine »', () => {
    expect(reviewWeekStarts(d('2026-11-18'), 'monday', 3)).toEqual(['2026-11-09', '2026-11-02', '2026-10-26']);
    expect(reviewWeekStarts(d('2026-11-18'), 'sunday', 2)).toEqual(['2026-11-08', '2026-11-01']);
    expect(reviewWeekStarts(d('2026-11-18'), 'saturday', 1)).toEqual(['2026-11-07']);
    // Le jour même du début de semaine, la semaine qui commence n'est pas complète.
    expect(reviewWeekStarts(d('2026-11-16'), 'monday', 1)).toEqual(['2026-11-09']);
    expect(reviewWeekStarts(d('2026-11-18'), 'monday').length).toBe(REVIEW_CONFIG.archiveWeeks);
  });
});

describe('BILAN-029 : vecteur nominal (C-1)', () => {
  const review = weeklyReview(FULL, WEEK);

  it('une phrase par thème, dans l’ordre, bornes de la semaine', () => {
    expect(review.weekStart).toBe('2026-11-09');
    expect(review.weekEnd).toBe('2026-11-15');
    expect(review.sentences.map((s) => s.theme)).toEqual([...REVIEW_THEMES]);
    expect(REVIEW_THEMES).toEqual(['sessions', 'records', 'volume', 'weight', 'nutrition', 'sleep', 'cycle']);
  });

  it('séances : 4 sur 4 prévues', () => {
    const s = byTheme(review.sentences, 'sessions');
    expect(s.kind).toBe('sessionsPlanned');
    expect(s.sources).toEqual([
      { fact: 'sessions.done', value: 4 },
      { fact: 'sessions.planned', value: 4 },
    ]);
  });

  it('records : 3 de la semaine (celui du 3 novembre exclu), noms distincts', () => {
    const s = byTheme(review.sentences, 'records');
    expect(s.kind).toBe('recordsSome');
    expect(value(s, 'records.count')).toBe(3);
    expect(s.sources.filter((x) => x.fact === 'records.exercise').map((x) => x.value)).toEqual(['Développé couché', 'Squat']);
    expect(value(s, 'records.others')).toBeUndefined();
  });

  it('volume : 3 muscles en tête, séries de travail validées de la semaine seulement', () => {
    const s = byTheme(review.sentences, 'volume');
    expect(s.kind).toBe('volumeTop');
    expect(s.sources).toEqual([
      { fact: 'volume.muscle', value: 'chest' },
      { fact: 'volume.sets', value: 7 },
      { fact: 'volume.muscle', value: 'quads' },
      { fact: 'volume.sets', value: 7 },
      { fact: 'volume.muscle', value: 'back' },
      { fact: 'volume.sets', value: 6 },
    ]);
  });

  it('poids : tendance au dixième et variation au centième', () => {
    const s = byTheme(review.sentences, 'weight');
    expect(s.kind).toBe('weightTrendRate');
    const trend = value(s, 'weight.trendKg') as number;
    const rate = value(s, 'weight.rateKg') as number;
    expect(Math.round(trend * 10) / 10).toBe(trend);
    expect(Math.round(rate * 100) / 100).toBe(rate);
    expect(trend).toBeGreaterThan(80.2);
    expect(trend).toBeLessThan(81);
    expect(rate).toBeLessThan(0);
  });

  it('nutrition : jours complets, moyenne et cible unique', () => {
    const s = byTheme(review.sentences, 'nutrition');
    expect(s.kind).toBe('nutritionTarget');
    expect(s.sources).toEqual([
      { fact: 'nutrition.completeDays', value: 3 },
      { fact: 'nutrition.meanKcal', value: 2500 },
      { fact: 'nutrition.targetKcal', value: 2500 },
    ]);
  });

  it('sommeil : moyenne des nuits mesurées (nuit inconnue ignorée, jamais 0)', () => {
    const s = byTheme(review.sentences, 'sleep');
    expect(s.kind).toBe('sleepMean');
    expect(s.sources).toEqual([
      { fact: 'sleep.nights', value: 3 },
      { fact: 'sleep.meanMinutes', value: 424 },
    ]);
  });

  it('cycle : semaine 4 sur 5', () => {
    const s = byTheme(review.sentences, 'cycle');
    expect(s.kind).toBe('cycleWeek');
    expect(s.sources).toEqual([
      { fact: 'cycle.week', value: 4 },
      { fact: 'cycle.total', value: 5 },
    ]);
  });

  it('déterministe, entrées non modifiées', () => {
    const before = JSON.stringify(FULL);
    expect(weeklyReview(FULL, WEEK)).toEqual(review);
    expect(JSON.stringify(FULL)).toBe(before);
  });
});

describe('BILAN-029 : donnée absente = « pas assez de données », jamais 0 (C-3)', () => {
  it('aucune donnée : chaque thème (sauf le cycle) est insuffisant, sans valeur inventée', () => {
    const review = weeklyReview(EMPTY, WEEK);
    for (const theme of ['sessions', 'records', 'volume', 'weight', 'nutrition', 'sleep'] as const) {
      const s = byTheme(review.sentences, theme);
      expect(s.kind, theme).toBe('insufficient');
      expect(s.sources.every((x) => x.fact !== 'sessions.done' && x.fact !== 'nutrition.meanKcal'), theme).toBe(true);
    }
    expect(byTheme(review.sentences, 'sleep').sources).toEqual([{ fact: 'sleep.nights', value: 0 }]);
    expect(byTheme(review.sentences, 'cycle').kind).toBe('cycleNone');
    expect(byTheme(review.sentences, 'cycle').sources).toEqual([]);
  });

  it('séances antérieures sans programme : 0 séance est un fait ; records et volume insuffisants', () => {
    const review = weeklyReview({ ...EMPTY, sessionDays: [d('2026-11-02')] }, WEEK);
    expect(byTheme(review.sentences, 'sessions')).toMatchObject({ kind: 'sessionsDone', sources: [{ fact: 'sessions.done', value: 0 }] });
    expect(byTheme(review.sentences, 'records').kind).toBe('insufficient');
    expect(byTheme(review.sentences, 'volume').kind).toBe('insufficient');
  });

  it('programme suivi, aucune séance : 0 sur 4 prévues', () => {
    const review = weeklyReview({ ...EMPTY, target: { perWeek: 4, since: d('2026-10-19') } }, WEEK);
    expect(byTheme(review.sentences, 'sessions').sources).toEqual([
      { fact: 'sessions.done', value: 0 },
      { fact: 'sessions.planned', value: 4 },
    ]);
  });

  it('programme commencé après la semaine : pas de « prévues »', () => {
    const review = weeklyReview({ ...FULL, target: { perWeek: 4, since: d('2026-11-16') } }, WEEK);
    expect(byTheme(review.sentences, 'sessions')).toMatchObject({ kind: 'sessionsDone', sources: [{ fact: 'sessions.done', value: 4 }] });
  });

  it('semaine avec un jour de pause : « semaine en pause », sans prévues', () => {
    const review = weeklyReview({ ...FULL, pauses: [{ from: d('2026-11-14'), to: d('2026-11-20') }] }, WEEK);
    expect(byTheme(review.sentences, 'sessions')).toMatchObject({ kind: 'sessionsPaused', sources: [{ fact: 'sessions.done', value: 4 }] });
  });

  it('séances sans record : « aucun record » (0 est un fait)', () => {
    const review = weeklyReview({ ...FULL, records: [] }, WEEK);
    expect(byTheme(review.sentences, 'records')).toMatchObject({ kind: 'recordsNone', sources: [{ fact: 'records.count', value: 0 }] });
  });

  it('plus de 3 exercices en record : 3 noms puis « autres »', () => {
    const names = ['A', 'B', 'C', 'D', 'E'];
    const review = weeklyReview({ ...FULL, records: names.map((exerciseName) => ({ day: d('2026-11-10'), exerciseName })) }, WEEK);
    const s = byTheme(review.sentences, 'records');
    expect(s.sources.filter((x) => x.fact === 'records.exercise').map((x) => x.value)).toEqual(['A', 'B', 'C']);
    expect(value(s, 'records.others')).toBe(2);
    expect(value(s, 'records.count')).toBe(5);
  });

  it('séries seulement d’exercices inconnus ou non validées : volume insuffisant', () => {
    const review = weeklyReview({ ...FULL, workouts: [{ day: d('2026-11-10'), sets: [...work('ghost', 3), { exerciseId: 'bench', setKind: 'work', done: false }] }] }, WEEK);
    expect(byTheme(review.sentences, 'volume').kind).toBe('insufficient');
  });

  it('pesée unique dans la semaine : tendance seule ; aucune pesée récente : insuffisant', () => {
    const one = weeklyReview({ ...FULL, weighIns: [{ date: d('2026-11-12'), kg: 80 }] }, WEEK);
    expect(byTheme(one.sentences, 'weight')).toMatchObject({ kind: 'weightTrend', sources: [{ fact: 'weight.trendKg', value: 80 }] });
    const old = weeklyReview({ ...FULL, weighIns: [{ date: d('2026-10-01'), kg: 80 }] }, WEEK);
    expect(byTheme(old.sentences, 'weight').kind).toBe('insufficient');
  });

  it('nutrition sans cible : jours et moyenne ; aucun jour complet : insuffisant', () => {
    const noTarget = weeklyReview({ ...FULL, targetKcal: () => null }, WEEK);
    expect(byTheme(noTarget.sentences, 'nutrition')).toMatchObject({ kind: 'nutritionDays' });
    expect(byTheme(noTarget.sentences, 'nutrition').sources.map((x) => x.fact)).toEqual(['nutrition.completeDays', 'nutrition.meanKcal']);
    const partial = weeklyReview({ ...FULL, nutritionDays: [{ date: d('2026-11-11'), usableForTdee: false, kcal: 900 }] }, WEEK);
    expect(byTheme(partial.sentences, 'nutrition').kind).toBe('insufficient');
  });

  it(`sommeil : moins de ${String(REVIEW_CONFIG.minSleepNights)} nuits mesurées : insuffisant, nombre de nuits dit`, () => {
    const review = weeklyReview({ ...FULL, sleep: FULL.sleep.slice(0, 2) }, WEEK);
    expect(byTheme(review.sentences, 'sleep')).toEqual({ theme: 'sleep', kind: 'insufficient', sources: [{ fact: 'sleep.nights', value: 2 }] });
  });

  it('semaine de décharge', () => {
    const review = weeklyReview({ ...FULL, cycleAt: () => ({ week: 5, total: 5, deload: true }) }, WEEK);
    expect(byTheme(review.sentences, 'cycle')).toMatchObject({ kind: 'cycleDeload', sources: [{ fact: 'cycle.week', value: 5 }, { fact: 'cycle.total', value: 5 }, { fact: 'cycle.deload', value: true }] });
  });

  it('début de semaine au dimanche : la semaine du 8 au 14 compte 4 séances', () => {
    const review = weeklyReview({ ...FULL, firstWeekday: 'sunday', target: null }, d('2026-11-08'));
    expect(review.weekEnd).toBe('2026-11-14');
    expect(byTheme(review.sentences, 'sessions').sources).toEqual([{ fact: 'sessions.done', value: 4 }]);
  });
});

describe('BILAN-029 : nombres d’un texte (vérification § 17.3)', () => {
  it('extrait entiers, décimaux à virgule, signes et espaces insécables de milliers', () => {
    expect(numbersIn('4 séances sur 4 prévues')).toEqual(['4', '4']);
    expect(numbersIn('80,2 kg (−0,25 kg)')).toEqual(['80,2', '0,25']);
    expect(numbersIn('2\u202f500 kcal, 7 h 04')).toEqual(['2500', '7', '04']);
    expect(numbersIn('4 500')).toEqual(['4', '500']);
    expect(numbersIn('aucun')).toEqual([]);
  });
});
