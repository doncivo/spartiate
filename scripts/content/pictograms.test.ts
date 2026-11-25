// MEDIA-03a : gabarit commun des pictogrammes et six essais (D-413). Le gabarit est fixe, les couleurs viennent de la charte.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pictogramFor } from './build-pictograms.mjs';
import { TEMPLATE } from './pictograms/skeleton.mjs';
import { SPECS, TRIAL_IDS } from './pictograms/specs.mjs';

const ROOT = resolve(__dirname, '..', '..');
const exercises = (JSON.parse(readFileSync(resolve(ROOT, 'content/exercises/exercises.json'), 'utf8')) as { exercises: Array<{ id: string; muscles: unknown[]; media: { images: string[] } }> }).exercises;
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
    // SHELL-0294d (BL-144, D-611), écart consigné : l'accent est une classe (le style en ligne est bloqué par la CSP) ; la feuille livrée porte le bronze.
    expect(svg).toContain('class="ct-picto-muscle"');
    expect(svg).not.toMatch(/style=/);
    expect(svg.length).toBeLessThan(6000);
  });

  it.each(TRIAL_IDS)('%s : le fichier de la proposition est celui que le script produit', (id) => {
    expect(readFileSync(resolve(ROOT, 'docs/maquettes/propositions/pictogrammes', `${id}.svg`), 'utf8')).toBe(render(id));
  });
});

// MEDIA-03b : tous les exercices sans photo ont leur pictogramme, produit par le script (D-51), les huit de la routine d'abord.
const noPhoto = exercises.filter((e) => e.media.images.length === 0).map((e) => e.id);
const ROUTINE_EIGHT = ['cable-crunch', 'overhead-triceps-extension-cable', 'split-squat-bulgarian', 'hip-thrust-barbell', 'hanging-leg-raise', 'chest-supported-row-machine', 'face-pull', 'lateral-raise-cable'];

describe('pictogrammes : exercices sans photo (MEDIA-03b)', () => {
  it('chaque exercice sans photo a une description, et seulement eux', () => {
    expect(noPhoto.length).toBeGreaterThan(0);
    expect(Object.keys(SPECS).sort()).toEqual([...noPhoto].sort());
  });

  it('les huit exercices de la routine d’Ali sont servis', () => {
    for (const id of ROUTINE_EIGHT) expect(Object.keys(SPECS)).toContain(id);
  });

  it.each(noPhoto)('%s : le fichier du dossier de contenu est celui que le script produit, sans couleur en dur', (id) => {
    const file = readFileSync(resolve(ROOT, 'content/exercises/pictograms', `${id}.svg`), 'utf8');
    expect(file).toBe(render(id));
    expect(file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|<script|href|foreignObject/);
  });
});

describe('pictogrammes : aucun style en ligne (SHELL-0294d, BL-144)', () => {
  it('aucun pictogramme livré ne porte un attribut style', () => {
    const dir = resolve(ROOT, 'content/exercises/pictograms');
    const withStyle = readdirSync(dir).filter((file) => /style=/.test(readFileSync(resolve(dir, file), 'utf8')));
    expect(withStyle).toEqual([]);
  });

  it('la feuille livrée donne le bronze à la classe d’accent', () => {
    const css = readFileSync(resolve(ROOT, 'src/features/training/media/ExerciseMedia.css'), 'utf8');
    expect(css).toMatch(/[.]ct-picto-muscle[\s]*[{][^}]*stroke:[\s]*var[\(]--ct-color-bronze/);
  });
});
