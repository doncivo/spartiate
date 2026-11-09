import { describe, expect, it } from 'vitest';
import { EXPLANATION_KEYS, parseExplanationKeys } from './recoveryJson';

/** I5-01, correction de revue 6 : une clé d'explication inconnue (iPhone plus récent) est ignorée, les connues sont gardées. */
describe('parseExplanationKeys', () => {
  it('ignore une clé inconnue et garde les connues, sans doublon', () => {
    expect(parseExplanationKeys(JSON.stringify(['sleep_short', 'cle_du_futur', 'sleep_short', 'sleep_debt']))).toEqual(['sleep_short', 'sleep_debt']);
  });

  it('seules des clés inconnues : liste vide (la ligne reste lisible) ; texte illisible ou non tableau : null', () => {
    expect(parseExplanationKeys('["autre"]')).toEqual([]);
    expect(parseExplanationKeys('pas du json')).toBeNull();
    expect(parseExplanationKeys('{"a":1}')).toBeNull();
    expect(parseExplanationKeys(JSON.stringify([...EXPLANATION_KEYS]))).toEqual([...EXPLANATION_KEYS]);
  });

  it('un élément qui n’est pas un texte reste refusé', () => {
    expect(parseExplanationKeys('[1]')).toBeNull();
  });
});
