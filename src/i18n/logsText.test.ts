import { describe, expect, it } from 'vitest';
import { tLogs } from './logsText';

/** Catalogue de l'écran Logs (I-04), à part du catalogue principal pour le bundle de départ (français seul). */
describe('textes de l’écran Logs', () => {
  it('lit le français et interpole', () => {
    expect(tLogs('errorCode', { code: 'io' })).toBe('Code : io');
    expect(tLogs('repeated', {})).toBe('×{count}');
  });
});
