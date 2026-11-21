// MEDIA-03a : gabarit commun des pictogrammes et six essais (D-413). Le gabarit est fixe, les couleurs viennent de la charte.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pictogramFor } from './build-pictograms.mjs';
import { TEMPLATE } from './pictograms/skeleton.mjs';
import { SPECS, TRIAL_IDS } from './pictograms/specs.mjs';

const ROOT = resolve(__dirname, '..', '..');
const exercises = (JSON.parse(readFileSync(resolve(ROOT, 'content/exercises/exercises.json'), 'utf8')) as { exercises: Array<{ id: string; muscles: unknown[] }> }).exercises;
const byId = new Map(exercises.map((e) => [e.id, e]));
const render = (id: string): string => {
  const ex = byId.get(id);
  if (!ex) throw new Error(`exercice inconnu : ${id}`);
  const svg: unknown = pictogramFor(ex);
  if (typeof svg !== 'string') throw new Error(`aucun pictogramme : ${id}`);
  return svg;
};

describe('pictogrammes : gabarit et essais (MEDIA-03a)', () => {
  it('les six essais comptent les trois exercices de la routine d’Ali', () => {
    expect(TRIAL_IDS).toHaveLength(6);
    for (const id of ['split-squat-bulgarian', 'hip-thrust-barbell', 'face-pull']) expect(TRIAL_IDS).toContain(id);
    for (const id of TRIAL_IDS) expect(Object.keys(SPECS)).toContain(id);
  });

  it.each(TRIAL_IDS)('%s : même gabarit, couleurs de la charte seulement, rien d’actif', (id) => {
    const svg = render(id);
    expect(svg).toContain(`viewBox="0 0 ${TEMPLATE.width} ${TEMPLATE.height}"`);
    expect(svg.replace(" xmlns=\"http://www.w3.org/2000/svg\"", "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb|hsl|<script|\son\w+=|href|foreignObject|<style|https?:/i);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('var(--ct-color-bronze)');
    expect(svg.length).toBeLessThan(6000);
  });

  it.each(TRIAL_IDS)('%s : le fichier de la proposition est celui que le script produit', (id) => {
    expect(readFileSync(resolve(ROOT, 'docs/maquettes/propositions/pictogrammes', `${id}.svg`), 'utf8')).toBe(render(id));
  });
});
