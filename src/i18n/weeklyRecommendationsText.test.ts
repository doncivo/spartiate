import { describe, expect, it } from 'vitest';
import type { Recommendation } from '../domain/review/weeklyRecommendations';
import { numbersIn } from '../domain/review/weeklyReview';
import { recommendationLine, recommendationSourceValues, recommendationText, tWeeklyReview } from './weeklyReviewText';

/** BL-125 (D-452, D-457) : texte des recommandations, règle dite, aucun chiffre hors des sources. Valeurs synthétiques. */
const muscleName = (id: string): string => (id === 'chest' ? 'Pectoraux' : id);
const R = (r: Recommendation): Recommendation => r;
const CASES: Recommendation[] = [
  R({ theme: 'training', kind: 'trainingSessions', rule: 'plannedSessions', sources: [{ fact: 'sessions.done', value: 1 }, { fact: 'sessions.planned', value: 3 }] }),
  R({ theme: 'training', kind: 'trainingLight', rule: 'lightWeek', sources: [{ fact: 'sessions.done', value: 1 }] }),
  R({ theme: 'training', kind: 'trainingDeload', rule: 'lightWeek', sources: [{ fact: 'cycle.week', value: 5 }, { fact: 'cycle.total', value: 5 }] }),
  ...(['trainingVolumeHigh', 'trainingVolumeLow', 'trainingKeep'] as const).map((kind) =>
    R({ theme: 'training', kind, rule: 'setRange', sources: [{ fact: 'volume.muscle', value: 'chest' }, { fact: 'volume.sets', value: 22.5 }, { fact: 'range.min', value: 10 }, { fact: 'range.max', value: 20 }] }),
  ),
  R({ theme: 'nutrition', kind: 'nutritionLog', rule: 'completeDays', sources: [{ fact: 'nutrition.completeDays', value: 2 }, { fact: 'nutrition.minDays', value: 3 }] }),
  ...(['nutritionAbove', 'nutritionBelow', 'nutritionKeep'] as const).map((kind) =>
    R({ theme: 'nutrition', kind, rule: 'targetGap', sources: [{ fact: 'nutrition.completeDays', value: 4 }, { fact: 'nutrition.meanKcal', value: 2450 }, { fact: 'nutrition.targetKcal', value: 2100 }, { fact: 'nutrition.tolerancePct', value: 10 }] }),
  ),
  ...(['recoverySleep', 'recoveryKeep'] as const).map((kind) =>
    R({ theme: 'recovery', kind, rule: 'sleepDuration', sources: [{ fact: 'sleep.nights', value: 4 }, { fact: 'sleep.meanMinutes', value: 395 }, { fact: 'sleep.minMinutes', value: 420 }] }),
  ),
];

describe('BL-125 : recommandations lisibles', () => {
  it('chaque nombre du texte vient d’une source (§ 17.3 : aucun chiffre inventé), aucun paramètre laissé vide', () => {
    for (const rec of CASES) {
      const text = recommendationText(rec, muscleName);
      expect(text, rec.kind).not.toMatch(/\{\w+\}/);
      // Revue : aucune source ne sort vide, aucun trou dans le texte (paramètre remplacé par une chaîne vide).
      for (const value of recommendationSourceValues(rec, muscleName)) expect(value, rec.kind).not.toBe('');
      expect(text, rec.kind).not.toMatch(/ {2}| ,|\(\)|[:;] *$/);
      const allowed = new Set(recommendationSourceValues(rec, muscleName).flatMap(numbersIn));
      for (const n of numbersIn(text)) expect(allowed.has(n), `${rec.kind} : ${n}`).toBe(true);
    }
  });

  it('textes attendus : séances, plage, sommeil en heures', () => {
    expect(recommendationText(CASES[0] as Recommendation, muscleName)).toBe('Entraînement : séances faites : 1 sur 3 prévues ; cale les séances manquantes dans la semaine suivante');
    expect(recommendationText(CASES[3] as Recommendation, muscleName)).toBe('Entraînement : Pectoraux : volume de 22,5 sur la semaine du bilan, au-dessus de la plage de 10 à 20 ; retire quelques séries de ce muscle');
    expect(recommendationText(CASES[6] as Recommendation, muscleName)).toBe('Nutrition : journal rempli sur 2 jours complets, il en faut 3 ; complète le journal avant de juger la moyenne');
    expect(recommendationText(CASES[10] as Recommendation, muscleName)).toBe('Sommeil et récupération : sommeil moyen de 6 h 35, sous les 7 h 00 recommandées ; avance l’heure du coucher');
  });

  it('règle dite après le texte ; sans données, ni règle ni source', () => {
    const rec = CASES[10] as Recommendation;
    expect(recommendationLine(rec, muscleName)).toBe(`${recommendationText(rec, muscleName)} · règle : ${tWeeklyReview('ruleSleepDuration')}`);
    expect(recommendationLine({ theme: 'nutrition', kind: 'none', rule: null, sources: [] }, muscleName)).toBe('Nutrition : aucune recommandation (pas assez de données)');
  });
});
