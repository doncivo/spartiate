import { describe, expect, it } from 'vitest';
import { numbersIn, weeklyReview, type ReviewData, type ReviewSentence, type WeekReview } from '../domain/review/weeklyReview';
import type { LocalDate } from '../domain/types';
import { reviewFileName, reviewLine, reviewMarkdown, reviewSourceValues, reviewText, reviewWeekLabel, tWeeklyReview } from './weeklyReviewText';

/** BILAN-029 : rendu des phrases du bilan (C-2, C-6). Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;
const names: Record<string, string> = { chest: 'Pectoraux', back: 'Dos', quads: 'Quadriceps' };
const muscleName = (id: string): string => names[id] ?? id;
const S = (sentence: ReviewSentence): ReviewSentence => sentence;

describe('BILAN-029 : phrases et sources lisibles', () => {
  it('séances : « 4 séances sur 4 prévues · source : séances closes »', () => {
    const s = S({ theme: 'sessions', kind: 'sessionsPlanned', sources: [{ fact: 'sessions.done', value: 4 }, { fact: 'sessions.planned', value: 4 }] });
    expect(reviewText(s, muscleName)).toBe('4 séances sur 4 prévues');
    expect(reviewLine(s, muscleName)).toBe(`${reviewText(s, muscleName)} · ${tWeeklyReview('sourceLabel', { label: tWeeklyReview('sourceSessions') })}`);
    expect(reviewLine(s, muscleName)).toBe('4 séances sur 4 prévues · source : séances closes');
  });

  it('singulier : 1 séance, 0 séance', () => {
    expect(reviewText(S({ theme: 'sessions', kind: 'sessionsDone', sources: [{ fact: 'sessions.done', value: 1 }] }), muscleName)).toBe('1 séance close');
    expect(reviewText(S({ theme: 'sessions', kind: 'sessionsPlanned', sources: [{ fact: 'sessions.done', value: 0 }, { fact: 'sessions.planned', value: 3 }] }), muscleName)).toBe('0 séance sur 3 prévues');
  });

  it('volume : noms des muscles, dixièmes à virgule', () => {
    const s = S({ theme: 'volume', kind: 'volumeTop', sources: [{ fact: 'volume.muscle', value: 'chest' }, { fact: 'volume.sets', value: 7.5 }, { fact: 'volume.muscle', value: 'back' }, { fact: 'volume.sets', value: 6 }] });
    expect(reviewText(s, muscleName)).toBe('Volume : Pectoraux 7,5 séries, Dos 6 séries');
  });

  it('poids : signe de la variation, tendance au dixième', () => {
    const s = S({ theme: 'weight', kind: 'weightTrendRate', sources: [{ fact: 'weight.trendKg', value: 80.4 }, { fact: 'weight.rateKg', value: -0.25 }] });
    expect(reviewText(s, muscleName)).toBe('Poids tendance 80,4 kg, −0,25 kg sur la semaine');
    expect(reviewText(S({ ...s, sources: [{ fact: 'weight.trendKg', value: 80 }, { fact: 'weight.rateKg', value: 0.1 }] }), muscleName)).toBe('Poids tendance 80 kg, +0,1 kg sur la semaine');
  });

  it('sommeil : heures et minutes', () => {
    expect(reviewText(S({ theme: 'sleep', kind: 'sleepMean', sources: [{ fact: 'sleep.nights', value: 3 }, { fact: 'sleep.meanMinutes', value: 424 }] }), muscleName)).toBe('Sommeil moyen 7 h 04 sur 3 nuits mesurées');
  });

  it('donnée absente : « pas assez de données » par thème, source dite', () => {
    const s = S({ theme: 'nutrition', kind: 'insufficient', sources: [] });
    expect(reviewText(s, muscleName)).toBe(tWeeklyReview('insufficientNutrition'));
    expect(reviewText(s, muscleName)).toMatch(/pas assez de données/);
    expect(reviewLine(s, muscleName)).toContain(tWeeklyReview('sourceNutrition'));
  });

  it('semaine : « Semaine du 9 au 15 novembre », à cheval sur deux mois, nom de fichier', () => {
    expect(reviewWeekLabel(d('2026-11-09'), d('2026-11-15'))).toBe('Semaine du 9 au 15 novembre');
    expect(reviewWeekLabel(d('2026-10-26'), d('2026-11-01'))).toBe('Semaine du 26 octobre au 1er novembre');
    expect(reviewFileName(d('2026-11-09'))).toBe('spartiate-bilan-2026-11-09.md');
  });
});

/** Générateur déterministe (LCG) pour la propriété « aucun chiffre inventé ». */
function rng(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function randomData(seed: number): ReviewData {
  const r = rng(seed);
  const day = (): LocalDate => d(`2026-11-${String(1 + Math.floor(r() * 16)).padStart(2, '0')}`);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const n = (max: number): number => Math.floor(r() * (max + 1));
  const days = Array.from({ length: n(8) }, day);
  return {
    firstWeekday: pick(['monday', 'sunday', 'saturday'] as const),
    sessionDays: days,
    target: r() < 0.5 ? null : { perWeek: 1 + n(5), since: day() },
    pauses: r() < 0.2 ? [{ from: day(), to: null, lightWeek: false }] : [],
    workouts: days.map((dd) => ({ day: dd, sets: Array.from({ length: n(12) }, () => ({ exerciseId: pick(['bench', 'row', 'squat', 'ghost']), setKind: pick(['work', 'warmup', 'drop'] as const), done: r() < 0.8 })) })),
    musclesOf: (id) => ({ bench: [{ id: 'chest', weight: 1 }, { id: 'triceps', weight: 0.35 }], row: [{ id: 'back', weight: 1 }], squat: [{ id: 'quads', weight: 1 }] })[id] ?? null,
    records: Array.from({ length: n(6) }, () => ({ day: day(), exerciseName: pick(['Développé couché', 'Squat', 'Rowing', 'Tirage', 'Fente']) })),
    weighIns: Array.from({ length: n(6) }, () => ({ date: day(), kg: 70 + Math.round(r() * 200) / 10 })),
    nutritionDays: Array.from({ length: n(7) }, () => ({ date: day(), usableForTdee: r() < 0.7, kcal: r() < 0.1 ? null : 1500 + n(2000) })),
    targetKcal: () => (r() < 0.5 ? null : 1800 + n(1500)),
    sleep: Array.from({ length: n(7) }, () => ({ day: day(), minutes: r() < 0.15 ? null : 240 + n(360) })),
    cycleAt: () => (r() < 0.4 ? null : { week: 1 + n(4), total: 5, deload: r() < 0.3 }),
  };
}

describe('BILAN-029 : aucun chiffre inventé (§ 17.3, C-2)', () => {
  it('300 bilans aléatoires : chaque nombre de chaque phrase est une valeur de ses sources', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const review = weeklyReview(randomData(seed), d('2026-11-08'));
      for (const s of review.sentences) {
        const allowed = new Set(numbersIn(reviewSourceValues(s, muscleName).join(' ')));
        for (const number of numbersIn(reviewText(s, muscleName))) expect(allowed.has(number), `${String(seed)} ${s.theme} ${reviewText(s, muscleName)}`).toBe(true);
      }
    }
  });
});

describe('BILAN-029 : export Markdown (C-6)', () => {
  it('titre, semaine, une ligne par phrase avec sa source, mention locale', () => {
    const review: WeekReview = {
      weekStart: d('2026-11-09'),
      weekEnd: d('2026-11-15'),
      sentences: [
        { theme: 'sessions', kind: 'sessionsPlanned', sources: [{ fact: 'sessions.done', value: 4 }, { fact: 'sessions.planned', value: 4 }] },
        { theme: 'sleep', kind: 'insufficient', sources: [{ fact: 'sleep.nights', value: 1 }] },
      ],
    };
    const md = reviewMarkdown(review, muscleName);
    expect(md.split('\n')).toEqual([
      `# ${tWeeklyReview('title')}`,
      '',
      `## ${reviewWeekLabel(d('2026-11-09'), d('2026-11-15'))}`,
      '',
      `- ${reviewLine(review.sentences[0] as ReviewSentence, muscleName)}`,
      `- ${reviewLine(review.sentences[1] as ReviewSentence, muscleName)}`,
      '',
      tWeeklyReview('exportFoot'),
      '',
    ]);
  });
});
