import { describe, expect, it } from 'vitest';
import { formatExerciseLoad } from './trainingText';

/** ERGO-02 (D-261) : « 2 × 26 kg » pour deux haltères, « 26 kg » pour un seul ou pour tout autre matériel. */
describe('formatExerciseLoad', () => {
  it('deux haltères', () => {
    expect(formatExerciseLoad(26, 2)).toBe('2 × 26 kg');
    expect(formatExerciseLoad(12.5, 2)).toBe('2 × 12,5 kg');
  });
  it('un seul haltère ou autre matériel', () => {
    expect(formatExerciseLoad(26, 1)).toBe('26 kg');
    expect(formatExerciseLoad(82.5, null)).toBe('82,5 kg');
  });
});
