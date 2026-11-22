import { describe, expect, it } from 'vitest';
import { progressionNoteText } from './progressionText';

/** SEANCE-0291 revue (BL-106) : paramètres numériques des notes du moteur écrits à la française, charge d'une paire dite « 2 × ». */
describe('progressionNoteText', () => {
  it('22,5 kg (jamais 22.5), paire d’haltères « 2 × 22,5 kg »', () => {
    expect(progressionNoteText({ key: 'noteReferenceOffGrid', params: { load: 22.5 } }, 1)).toContain('(22,5 kg)');
    expect(progressionNoteText({ key: 'noteReferenceOffGrid', params: { load: 22.5 } }, 2)).toContain('(2 × 22,5 kg)');
    expect(progressionNoteText({ key: 'noteGridToVerify', params: {} }, 1)).not.toMatch(/{/);
  });
});
