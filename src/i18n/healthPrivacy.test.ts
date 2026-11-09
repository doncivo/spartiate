import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { healthFr } from './fr.health';

/** I5-01, correction de revue 3 : aucun énoncé « rien ne quitte l'iPhone » (Raccourcis écrit dans iCloud Drive, les résumés passent par la synchro chiffrée). */
const SENTENCE = 'Aucune donnée n’est envoyée à un service tiers ; les résumés passent par ta synchro chiffrée.';

describe('énoncés de confidentialité de l’écran Apple Santé', () => {
  it('recHint dit que rien n’est envoyé à un service tiers et que les résumés passent par la synchro chiffrée', () => {
    expect(healthFr.recHint).toContain(SENTENCE);
  });

  it('aucun texte de l’écran ni le guide ne prétend que rien ne quitte l’iPhone', () => {
    for (const value of Object.values(healthFr)) expect(value).not.toMatch(/ne quitte (l’|l'|ton )iPhone/i);
    expect(readFileSync('docs/guide-raccourcis-sante.md', 'utf8')).not.toMatch(/ne quitte ton iPhone/i);
  });
});
