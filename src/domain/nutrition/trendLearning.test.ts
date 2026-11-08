import { describe, expect, it } from 'vitest';
import { isTrendLearning, TREND_WEIGH_INS_NEEDED } from './trendLearning';

describe('tendance en apprentissage', () => {
  it('moins de 14 pesées : en apprentissage ; 14 et plus : tendance affichée', () => {
    expect(TREND_WEIGH_INS_NEEDED).toBe(14);
    expect(isTrendLearning(0)).toBe(true);
    expect(isTrendLearning(3)).toBe(true);
    expect(isTrendLearning(13)).toBe(true);
    expect(isTrendLearning(14)).toBe(false);
  });
});
