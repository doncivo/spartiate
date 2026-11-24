import { describe, expect, it } from 'vitest';
import { bodyFr } from './fr.body';
import { nutritionFr } from './fr.nutrition';
import { nutritionQuickFr } from './fr.nutritionQuick';
import { recipesFr } from './fr.recipes';
import { supplementsFr } from './fr.supplements';
import { fr } from './fr';

/** C-106 : pas d'anglicisme dans les textes de nutrition ; deux réglages « Objectif » qui ne portent pas le même nom ; catalogue hérité hors du départ. */
const values = (catalogue: Record<string, unknown>): string[] => Object.values(catalogue).flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'object' && v !== null ? values(v as Record<string, unknown>) : []));

describe('C-106', () => {
  it('aucun « Dashboard », « loggé », « logué » ni « Cache OFF » dans les textes de nutrition', () => {
    const all = [nutritionFr, nutritionQuickFr, recipesFr, supplementsFr].flatMap((c) => values(c as Record<string, unknown>));
    expect(all.filter((text) => /dashboard|\blogg?u?[ée]s?\b|cache off/i.test(text))).toEqual([]);
  });

  it('l’objectif du profil et l’objectif de nutrition portent deux libellés différents', () => {
    expect(bodyFr.goal).not.toBe(nutritionFr.goalTitle);
  });

  it('le catalogue hérité du scan de tâches n’est plus dans l’arbre de départ', () => {
    expect(Object.keys(fr)).not.toContain('scan');
  });
});
