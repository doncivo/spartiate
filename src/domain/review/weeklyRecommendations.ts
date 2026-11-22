import type { LocalDate } from '../types';
import { DEFAULT_PROGRESS_CONFIG } from '../training/config';
import { weeklyReview, type FactKey, type ReviewData, type ReviewSentence } from './weeklyReview';

/**
 * BL-125 (décision d'Ali du 21/11, D-452 ; règles D-457, révisables par Ali) : une recommandation par thème du bilan de la semaine
 * (entraînement, nutrition, sommeil et récupération). Chacune vient d'une règle nommée (`rule`), écrite ici et dite à l'écran avec sa
 * source ; ses paramètres ne viennent que des FAITS du bilan (`weeklyReview`, mêmes sources) et des seuils de la règle, portés eux aussi
 * en sources (aucun chiffre inventé). Sans les données d'une règle : `none`, jamais un conseil par défaut. Règles pures, sans horloge.
 */

export const RECOMMENDATION_CONFIG = {
  /** Plage de séries difficiles par muscle et par semaine (D-448), celle de Progrès › Volume. */
  setRange: DEFAULT_PROGRESS_CONFIG.volumeRange,
  /** Jours complets du journal sous lesquels la moyenne n'est pas jugée (même minimum que les nuits de sommeil). */
  minCompleteDays: 3,
  /** Écart toléré entre la moyenne et la cible calorique, en pour cent de la cible (bornes comprises). */
  targetTolerancePct: 10,
  /** Sommeil minimal recommandé à l'adulte (consensus AASM et SRS, 2015 : 7 h ou plus par nuit), en minutes. */
  minSleepMinutes: 420,
} as const;

export const RECOMMENDATION_THEMES = ['training', 'nutrition', 'recovery'] as const;
export type RecommendationTheme = (typeof RECOMMENDATION_THEMES)[number];

/** Règles nommées (texte et source dans le catalogue du bilan). */
export type RecommendationRule = 'plannedSessions' | 'lightWeek' | 'setRange' | 'completeDays' | 'targetGap' | 'sleepDuration';

export type RecommendationKind =
  | 'none'
  | 'trainingSessions'
  | 'trainingLight'
  | 'trainingDeload'
  | 'trainingVolumeHigh'
  | 'trainingVolumeLow'
  | 'trainingKeep'
  | 'nutritionLog'
  | 'nutritionAbove'
  | 'nutritionBelow'
  | 'nutritionKeep'
  | 'recoverySleep'
  | 'recoveryKeep';

export type RecommendationFact = FactKey | 'range.min' | 'range.max' | 'nutrition.minDays' | 'nutrition.tolerancePct' | 'sleep.minMinutes';

export interface RecommendationSource {
  readonly fact: RecommendationFact;
  readonly value: number | string;
}

export interface Recommendation {
  readonly theme: RecommendationTheme;
  readonly kind: RecommendationKind;
  /** `null` pour `none`. */
  readonly rule: RecommendationRule | null;
  readonly sources: readonly RecommendationSource[];
}

const none = (theme: RecommendationTheme): Recommendation => ({ theme, kind: 'none', rule: null, sources: [] });
const numberIn = (sentence: ReviewSentence | undefined, fact: FactKey): number | null => {
  const value = sentence?.sources.find((s) => s.fact === fact)?.value;
  return typeof value === 'number' ? value : null;
};
const sentenceOf = (sentences: readonly ReviewSentence[], theme: ReviewSentence['theme']): ReviewSentence | undefined => sentences.find((s) => s.theme === theme);

function training(sentences: readonly ReviewSentence[]): Recommendation {
  const sessions = sentenceOf(sentences, 'sessions');
  const done = numberIn(sessions, 'sessions.done');
  const planned = numberIn(sessions, 'sessions.planned');
  if (sessions === undefined || sessions.kind === 'insufficient' || done === null) return none('training');
  // Règle « séances prévues » : une semaine non en pause sous l'objectif du programme suivi.
  if (sessions.kind === 'sessionsPlanned' && planned !== null && done < planned) {
    return { theme: 'training', kind: 'trainingSessions', rule: 'plannedSessions', sources: [{ fact: 'sessions.done', value: done }, { fact: 'sessions.planned', value: planned }] };
  }
  if (done === 0) return none('training');
  // Revue à froid : règle « semaine allégée » d'abord. En pause ou en décharge, un volume bas est voulu : jamais « ajoute des séries ».
  const cycle = sentenceOf(sentences, 'cycle');
  if (sessions.kind === 'sessionsPaused' || cycle?.kind === 'cycleDeload') {
    const sources: RecommendationSource[] =
      cycle?.kind === 'cycleDeload'
        ? [
            { fact: 'cycle.week', value: numberIn(cycle, 'cycle.week') ?? 0 },
            { fact: 'cycle.total', value: numberIn(cycle, 'cycle.total') ?? 0 },
          ]
        : [{ fact: 'sessions.done', value: done }];
    return { theme: 'training', kind: cycle?.kind === 'cycleDeload' ? 'trainingDeload' : 'trainingLight', rule: 'lightWeek', sources };
  }
  // Règle « plage de séries » : le muscle le plus travaillé de la semaine (premier du volume) comparé à la plage (D-448).
  const volume = sentenceOf(sentences, 'volume');
  const muscle = volume?.kind === 'volumeTop' ? volume.sources.find((s) => s.fact === 'volume.muscle')?.value : undefined;
  const sets = volume?.kind === 'volumeTop' ? volume.sources.find((s) => s.fact === 'volume.sets')?.value : undefined;
  if (typeof muscle !== 'string' || typeof sets !== 'number') return none('training');
  const { min, max } = RECOMMENDATION_CONFIG.setRange;
  const sources: RecommendationSource[] = [
    { fact: 'volume.muscle', value: muscle },
    { fact: 'volume.sets', value: sets },
    { fact: 'range.min', value: min },
    { fact: 'range.max', value: max },
  ];
  const kind: RecommendationKind = sets > max ? 'trainingVolumeHigh' : sets < min ? 'trainingVolumeLow' : 'trainingKeep';
  return { theme: 'training', kind, rule: 'setRange', sources };
}

function nutrition(sentences: readonly ReviewSentence[]): Recommendation {
  const sentence = sentenceOf(sentences, 'nutrition');
  const days = numberIn(sentence, 'nutrition.completeDays');
  if (sentence === undefined || sentence.kind === 'insufficient' || days === null || days === 0) return none('nutrition');
  // Règle « jours complets » : une moyenne sur moins de 3 jours complets ne se juge pas ; il faut d'abord compléter le journal.
  if (days < RECOMMENDATION_CONFIG.minCompleteDays) {
    return { theme: 'nutrition', kind: 'nutritionLog', rule: 'completeDays', sources: [{ fact: 'nutrition.completeDays', value: days }, { fact: 'nutrition.minDays', value: RECOMMENDATION_CONFIG.minCompleteDays }] };
  }
  const mean = numberIn(sentence, 'nutrition.meanKcal');
  const target = numberIn(sentence, 'nutrition.targetKcal');
  if (sentence.kind !== 'nutritionTarget' || mean === null || target === null || target <= 0) return none('nutrition');
  // Règle « écart à la cible » : moyenne des jours complets comparée à la cible calorique unique en vigueur, à 10 % près.
  const tolerance = RECOMMENDATION_CONFIG.targetTolerancePct;
  const gap = ((mean - target) / target) * 100;
  const kind: RecommendationKind = gap > tolerance ? 'nutritionAbove' : gap < -tolerance ? 'nutritionBelow' : 'nutritionKeep';
  return {
    theme: 'nutrition',
    kind,
    rule: 'targetGap',
    sources: [
      { fact: 'nutrition.completeDays', value: days },
      { fact: 'nutrition.meanKcal', value: mean },
      { fact: 'nutrition.targetKcal', value: target },
      { fact: 'nutrition.tolerancePct', value: tolerance },
    ],
  };
}

function recovery(sentences: readonly ReviewSentence[]): Recommendation {
  const sentence = sentenceOf(sentences, 'sleep');
  const nights = numberIn(sentence, 'sleep.nights');
  const mean = numberIn(sentence, 'sleep.meanMinutes');
  // Le bilan ne donne une moyenne qu'à partir de 3 nuits mesurées (REVIEW_CONFIG.minSleepNights).
  if (sentence?.kind !== 'sleepMean' || nights === null || mean === null) return none('recovery');
  // Règle « durée de sommeil » : 7 h ou plus par nuit chez l'adulte (consensus AASM et SRS, 2015).
  const kind: RecommendationKind = mean < RECOMMENDATION_CONFIG.minSleepMinutes ? 'recoverySleep' : 'recoveryKeep';
  return {
    theme: 'recovery',
    kind,
    rule: 'sleepDuration',
    sources: [
      { fact: 'sleep.nights', value: nights },
      { fact: 'sleep.meanMinutes', value: mean },
      { fact: 'sleep.minMinutes', value: RECOMMENDATION_CONFIG.minSleepMinutes },
    ],
  };
}

/** Recommandations des faits d'un bilan déjà calculé (mêmes sources que ses phrases). */
export function recommendationsOf(sentences: readonly ReviewSentence[]): Recommendation[] {
  return [training(sentences), nutrition(sentences), recovery(sentences)];
}

/** Recommandations de la semaine qui commence à `weekStart` (faits de `weeklyReview`). */
export function weeklyRecommendations(data: ReviewData, weekStart: LocalDate): Recommendation[] {
  return recommendationsOf(weeklyReview(data, weekStart).sentences);
}
