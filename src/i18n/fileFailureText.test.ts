import { describe, expect, it } from 'vitest';
import { fileFailureFr, tFileFailure } from './fileFailureText';

describe('textes des échecs d’enregistrement sans nouvel essai', () => {
  it('chaque clé a un texte français non vide', () => {
    for (const key of Object.keys(fileFailureFr) as (keyof typeof fileFailureFr)[]) expect(tFileFailure(key).length, key).toBeGreaterThan(0);
  });
});
