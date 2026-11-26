import { describe, expect, it } from 'vitest';
import { tLogs } from './logsText';

/** Catalogue de l'écran Logs (I-04), à part du catalogue principal pour le bundle de départ (français seul). */
describe('textes de l’écran Logs', () => {
  it('lit le français et interpole', () => {
    expect(tLogs('errorCode', { code: 'io' })).toBe('Code : io');
    // @ts-expect-error CLEAN-0297 (C-085) : le type exige `{count}` ; à l'exécution, un paramètre absent reste visible.
    expect(tLogs('repeated', {})).toBe('×{count}');
  });
});
