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

describe('NUTRI-0299 (D-649) : aucun « Logs » visible dans les textes de Santé', () => {
  it('les renvois au journal technique donnent le chemin des deux appareils (Plus › Journaux, Plus › APP › Journaux)', () => {
    const texts = Object.values(healthFr).filter((v): v is string => typeof v === 'string');
    expect(texts.filter((t) => /\bLogs\b/.test(t))).toEqual([]);
    for (const key of ['recFailed', 'recDoneFailed', 'technicalShare', 'bodyFailedLast', 'bodyFailed'] as const) {
      expect(healthFr[key], key).toContain('Plus › Journaux sur le PC, Plus › APP › Journaux sur l’iPhone');
    }
  });
});
