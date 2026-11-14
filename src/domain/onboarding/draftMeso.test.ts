import { describe, expect, it } from 'vitest';
import { emptyDraft, parseDraft } from './draft';

/** PROG-01 (D-267, D-269 (7)) : étape 7, durée du mésocycle (4, 5 ou 6, défaut 5) et semaine de reprise (désactivée par défaut). */
describe('brouillon de l’onboarding : mésocycle', () => {
  it('défauts : 5 semaines, semaine de reprise désactivée', () => {
    expect(emptyDraft()).toMatchObject({ mesoWeeks: 5, rampUp: false });
  });
  it('relecture : 4 / 6 admis, autre valeur ramenée au défaut', () => {
    expect(parseDraft({ mesoWeeks: 4, rampUp: true })).toMatchObject({ mesoWeeks: 4, rampUp: true });
    expect(parseDraft({ mesoWeeks: 6 })).toMatchObject({ mesoWeeks: 6, rampUp: false });
    expect(parseDraft({ mesoWeeks: 7, rampUp: 'oui' })).toMatchObject({ mesoWeeks: 5, rampUp: false });
  });
});
