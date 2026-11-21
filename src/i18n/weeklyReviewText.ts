import type { FactKey, ReviewSentence, ReviewSource, ReviewTheme, WeekReview } from '../domain/review/weeklyReview';
import type { LocalDate } from '../domain/types';
import { weeklyReviewFr } from './fr.weeklyReview';
import { tPlural } from './plural';

/**
 * BILAN-029 : rendu du bilan de la semaine (catalogue à part, importé seulement par le bloc à la demande de Progrès › Bilan). Les paramètres
 * d'une phrase ne viennent que de ses sources (§ 17.3 : aucun chiffre inventé) ; la mise en forme d'une valeur est la même dans la phrase
 * et dans la liste de ses sources (`reviewSourceValues`), ce que vérifie weeklyReviewText.test.ts.
 */
export type WeeklyReviewTextKey = keyof typeof weeklyReviewFr;

export function tWeeklyReview(key: WeeklyReviewTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = weeklyReviewFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

const SOURCE: Readonly<Record<ReviewTheme, WeeklyReviewTextKey>> = {
  sessions: 'sourceSessions',
  records: 'sourceRecords',
  volume: 'sourceVolume',
  weight: 'sourceWeight',
  nutrition: 'sourceNutrition',
  sleep: 'sourceSleep',
  cycle: 'sourceCycle',
};
const INSUFFICIENT: Readonly<Record<ReviewTheme, WeeklyReviewTextKey>> = {
  sessions: 'insufficientSessions',
  records: 'insufficientRecords',
  volume: 'insufficientVolume',
  weight: 'insufficientWeight',
  nutrition: 'insufficientNutrition',
  sleep: 'insufficientSleep',
  cycle: 'insufficientCycle',
};

const KCAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const MINUS = String.fromCharCode(0x2212);
const decimal = (n: number): string => String(n).replace('.', ',');
const signed = (n: number): string => (n > 0 ? `+${decimal(n)}` : n < 0 ? `${MINUS}${decimal(-n)}` : '0');
const duration = (minutes: number): string => `${String(Math.floor(minutes / 60))} h ${String(minutes % 60).padStart(2, '0')}`;

/** Valeur d'une source mise en forme comme dans la phrase. */
function formatValue(source: ReviewSource, muscleName: (id: string) => string): string {
  const { fact, value } = source;
  if (typeof value === 'boolean') return '';
  if (typeof value === 'string') return fact === 'volume.muscle' ? muscleName(value) : value;
  if (fact === 'weight.rateKg') return signed(value);
  if (fact === 'sleep.meanMinutes') return duration(value);
  if (fact === 'nutrition.meanKcal' || fact === 'nutrition.targetKcal') return KCAL.format(value);
  return decimal(value);
}

/** Valeurs des sources d'une phrase, mises en forme (vérification « aucun chiffre inventé », export). */
export function reviewSourceValues(sentence: ReviewSentence, muscleName: (id: string) => string): string[] {
  return sentence.sources.map((s) => formatValue(s, muscleName));
}

function numberOf(sentence: ReviewSentence, fact: FactKey): number {
  const value = sentence.sources.find((s) => s.fact === fact)?.value;
  return typeof value === 'number' ? value : 0;
}

function sessionCount(n: number): string {
  return tPlural(tWeeklyReview, n, 'sessionCountOne', 'sessionCount');
}

function nightsText(n: number): string {
  return n === 0 ? tWeeklyReview('nightsNone') : tPlural(tWeeklyReview, n, 'nightsOne', 'nights');
}

function recordsText(sentence: ReviewSentence): string {
  const n = numberOf(sentence, 'records.count');
  const listed = sentence.sources.filter((s) => s.fact === 'records.exercise').map((s) => String(s.value)).join(', ');
  const others = numberOf(sentence, 'records.others');
  const names = others > 0 ? tPlural(tWeeklyReview, others, 'recordsOtherOne', 'recordsOther', { names: listed }) : listed;
  return tPlural(tWeeklyReview, n, 'recordsOne', 'records', { names });
}

function volumeText(sentence: ReviewSentence, muscleName: (id: string) => string): string {
  const items: string[] = [];
  for (let i = 0; i + 1 < sentence.sources.length; i += 2) {
    const muscle = sentence.sources[i];
    const sets = sentence.sources[i + 1];
    if (muscle === undefined || sets === undefined || typeof sets.value !== 'number') continue;
    items.push(tPlural(tWeeklyReview, sets.value, 'volumeItemOne', 'volumeItem', { muscle: formatValue(muscle, muscleName), n: formatValue(sets, muscleName) }));
  }
  return tWeeklyReview('volumeTop', { items: items.join(', ') });
}

/** Texte d'une phrase (sans sa source). */
export function reviewText(sentence: ReviewSentence, muscleName: (id: string) => string): string {
  const v = (fact: FactKey): string => {
    const source = sentence.sources.find((s) => s.fact === fact);
    return source === undefined ? '' : formatValue(source, muscleName);
  };
  switch (sentence.kind) {
    case 'insufficient':
      return sentence.theme === 'sleep' ? tWeeklyReview('insufficientSleep', { nights: nightsText(numberOf(sentence, 'sleep.nights')) }) : tWeeklyReview(INSUFFICIENT[sentence.theme]);
    case 'sessionsPlanned':
      return tPlural(tWeeklyReview, numberOf(sentence, 'sessions.planned'), 'sessionsPlannedOne', 'sessionsPlanned', { count: sessionCount(numberOf(sentence, 'sessions.done')), planned: v('sessions.planned') });
    case 'sessionsDone':
      return tPlural(tWeeklyReview, numberOf(sentence, 'sessions.done'), 'sessionsDoneOne', 'sessionsDone');
    case 'sessionsPaused':
      return tWeeklyReview('sessionsPaused', { count: sessionCount(numberOf(sentence, 'sessions.done')) });
    case 'recordsSome':
      return recordsText(sentence);
    case 'recordsNone':
      return tWeeklyReview('recordsNone');
    case 'volumeTop':
      return volumeText(sentence, muscleName);
    case 'weightTrend':
      return tWeeklyReview('weightTrend', { kg: v('weight.trendKg') });
    case 'weightTrendRate':
      return tWeeklyReview('weightTrendRate', { kg: v('weight.trendKg'), rate: v('weight.rateKg') });
    case 'nutritionDays':
    case 'nutritionTarget': {
      const days = tPlural(tWeeklyReview, numberOf(sentence, 'nutrition.completeDays'), 'daysCountOne', 'daysCount');
      return tWeeklyReview(sentence.kind, { days, kcal: v('nutrition.meanKcal'), target: v('nutrition.targetKcal') });
    }
    case 'sleepMean':
      return tWeeklyReview('sleepMean', { duration: v('sleep.meanMinutes'), nights: nightsText(numberOf(sentence, 'sleep.nights')) });
    case 'cycleWeek':
    case 'cycleDeload':
      return tWeeklyReview(sentence.kind, { week: v('cycle.week'), total: v('cycle.total') });
    case 'cycleNone':
      return tWeeklyReview('cycleNone');
  }
}

/** Phrase et source lisible : « 4 séances sur 4 prévues · source : séances closes ». */
export function reviewLine(sentence: ReviewSentence, muscleName: (id: string) => string): string {
  return `${reviewText(sentence, muscleName)} · ${tWeeklyReview('sourceLabel', { label: tWeeklyReview(SOURCE[sentence.theme]) })}`;
}

/*
 * Dates écrites ici avec Intl plutôt qu'avec i18n/format.ts (même raison que Progrès › Entraînement : ses fonctions inutilisées entreraient
 * dans ce bloc).
 */
const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayText = (day: LocalDate, withYear: boolean): string => (withYear ? DAY_MONTH_YEAR : DAY_MONTH).format(new Date(`${day}T00:00:00.000Z`)).replace(/^1 /, '1er ');

/** « Semaine du 9 au 15 novembre », « Semaine du 26 octobre au 1er novembre » ; années écrites si elles diffèrent. */
export function reviewWeekLabel(weekStart: LocalDate, weekEnd: LocalDate): string {
  const years = weekStart.slice(0, 4) !== weekEnd.slice(0, 4);
  const sameMonth = weekStart.slice(0, 7) === weekEnd.slice(0, 7);
  const from = sameMonth ? (weekStart.slice(8) === '01' ? '1er' : String(Number(weekStart.slice(8)))) : dayText(weekStart, years);
  return tWeeklyReview('weekLabel', { from, to: dayText(weekEnd, years) });
}

export function reviewFileName(weekStart: LocalDate): string {
  return tWeeklyReview('fileName', { date: weekStart });
}

/** Fichier Markdown du bilan d'une semaine : titre, semaine, une ligne par phrase avec sa source, mention locale. */
export function reviewMarkdown(review: WeekReview, muscleName: (id: string) => string): string {
  return [`# ${tWeeklyReview('title')}`, '', `## ${reviewWeekLabel(review.weekStart, review.weekEnd)}`, '', ...review.sentences.map((s) => `- ${reviewLine(s, muscleName)}`), '', tWeeklyReview('exportFoot'), ''].join('\n');
}
