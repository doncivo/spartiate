import { describe, expect, it } from 'vitest';
import { progressionNoteText } from './progressionText';

/** SEANCE-0291 revue (BL-106) : paramètres numériques des notes du moteur écrits à la française, charge d'une paire dite « 2 × ». */
describe('progressionNoteText', () => {
  it('22,5 kg (jamais 22.5), paire d’haltères « 2 × 22,5 kg »', () => {
    expect(progressionNoteText({ key: 'noteReferenceOffGrid', params: { load: 22.5 } }, 1)).toContain('(22,5 kg)');
    expect(progressionNoteText({ key: 'noteReferenceOffGrid', params: { load: 22.5 } }, 2)).toContain('(2 × 22,5 kg)');
    expect(progressionNoteText({ key: 'noteGridToVerify', params: {} }, 1)).not.toMatch(/{/);
  });

  it('SEANCE-0292b BL-106 (D-496) : la charge retenue « kept » est écrite comme « load » (à la française, en paire)', () => {
    const text = progressionNoteText({ key: 'noteReferenceOffGrid', params: { load: 44, kept: 42.5 } }, 2);
    expect(text).toContain('(2 × 44 kg)');
    expect(text).toContain('2 × 42,5 kg');
    expect(text).not.toMatch(/[{}]/);
  });

  // Relecture (H) : le vert BL-112 (c35aa706) ajoutait ce texte sans test ; le rouge 5a037a24 couvrait la clé de note, pas son texte.
  it('SEANCE-0292b BL-112 (D-539) : décote de position d’un exercice sans charge dite sur les répétitions ou la durée, jamais la charge', () => {
    const text = progressionNoteText({ key: 'notePositionValues', params: { rank: 2, cut: 7 } }, 1);
    expect(text).toBe('Répétitions ou durée réduites de 7 % : 2ᵉ exercice de ce muscle dans la séance.');
    expect(text).not.toMatch(/[{}]|[Cc]harge/);
  });
});
