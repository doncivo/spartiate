import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- module JavaScript sans déclaration de types (script de documentation)
import { extractPrudent, renderReview, idsInReview, applyReview, START, END } from './prudent-review.mjs';

/**
 * BL-149 (audit du projet du 24/11, N-12 ; D-490) : la revue par thème des choix prudents de l'agent est produite par script
 * (`node scripts/release/prudent-review.mjs --write`, D-51) dans docs/decisions-a-prendre.md. Ce test échoue dès qu'une D-
 * « choix prudent » de docs/decisions.md manque du relevé (nouvelle décision ajoutée sans relancer le script).
 */
const SAMPLE = [
  '| ID | Décision | Source |',
  '| --- | --- | --- |',
  '| D-1 | **Seuil de décharge du moteur.** La charge baisse de 10 % ; `ENGINE_VERSION` relevée. | Claude (choix prudent) ; révisable par Ali |',
  '| D-2 | Décision d\'Ali sur la séance. | Ali |',
  '| D-3 | **Nom du job de CI.** Le workflow garde son nom. | Claude (choix prudent) |',
  '| D-4 | **Synchro : époque publiée, migration 0099.** Colonne additive publiée. Choix prudent révisable par Ali. |',
  '| D-5 | **RESET : décision d\'Ali (non révisable par l\'agent).** Rien. |',
  '| D-6 | **Texte de l\'écran Nutrition.** Le libellé dit « kcal ». | Claude (choix prudent) ; **validée par Ali le 20/11/2026 (D-318)** |',
  '| D-7 | **Ali valide D-3.** | Ali (décision du 24/11) |',
].join('\n');

describe('BL-149 : relevé des choix prudents (D-490)', () => {
  it('retient la colonne source « Claude » ou « choix prudent » et le texte « révisable par Ali », jamais « non révisable » ni « validée »', () => {
    expect(extractPrudent(SAMPLE).map((d: { id: string }) => d.id)).toEqual(['D-1', 'D-3', 'D-4']);
  });

  it('classe par thème, met la plus lourde en tête et sépare « à trancher » de « à confirmer seulement »', () => {
    const items = extractPrudent(SAMPLE);
    const byId = Object.fromEntries(items.map((d: { id: string }) => [d.id, d]));
    expect(byId['D-1'].theme).toBe('séance et moteur');
    expect(byId['D-3'].theme).toBe('CI et outillage');
    expect(byId['D-4'].theme).toBe('synchro et données');
    expect(byId['D-1'].kind).toBe('à trancher');
    expect(byId['D-3'].kind).toBe('à confirmer seulement');
    expect(byId['D-4'].weight).toBeGreaterThan(byId['D-3'].weight);
    expect(byId['D-3'].citedByAli).toEqual(['D-7']);
  });

  it('rend une section balisée dont chaque D- retenue a sa ligne, sans accent grave ni barre verticale dans les résumés', () => {
    const out = renderReview(extractPrudent(SAMPLE));
    expect(out.startsWith(START)).toBe(true);
    expect(out.trimEnd().endsWith(END)).toBe(true);
    expect([...idsInReview(out)].sort()).toEqual(['D-1', 'D-3', 'D-4']);
    expect(out.includes('`')).toBe(false);
  });

  it('docs/decisions-a-prendre.md contient chaque D- « choix prudent » de docs/decisions.md, et aucune autre', () => {
    const expected = extractPrudent(readFileSync('docs/decisions.md', 'utf8')).map((d: { id: string }) => d.id);
    expect(expected.length).toBeGreaterThan(200);
    const doc = readFileSync('docs/decisions-a-prendre.md', 'utf8');
    const got = idsInReview(doc);
    const missing = expected.filter((id: string) => !got.has(id));
    expect(missing, 'relancer `node scripts/release/prudent-review.mjs --write`').toEqual([]);
    expect([...got].filter((id) => !expected.includes(id))).toEqual([]);
  });

  it('la section générée est identique octet à octet au rendu du script (aucune retouche à la main)', () => {
    const doc = readFileSync('docs/decisions-a-prendre.md', 'utf8');
    const section = renderReview(extractPrudent(readFileSync('docs/decisions.md', 'utf8')));
    expect(applyReview(doc, section) === doc, 'relancer `node scripts/release/prudent-review.mjs --write`').toBe(true);
  });
});
