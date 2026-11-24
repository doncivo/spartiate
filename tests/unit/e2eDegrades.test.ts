import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-193 (relecture 1, point 4) : l'e2e de l'état « aucune donnée » prouve que l'état dégradé est affiché (texte et indication), pas l'absence d'un texte jamais rendu.
const spec = readFileSync(resolve(import.meta.dirname, '..', 'e2e', 'C193-degrades.spec.ts'), 'utf8');

describe('C193-degrades.spec.ts : assertions qui peuvent échouer', () => {
  it('aucune assertion sur « J+0/14 » (texte que cet état ne rend jamais)', () => {
    expect(spec).not.toContain('J+0/14');
  });
  it('l\'indication qui suit le texte d\'absence est exigée, iPhone et PC', () => {
    expect(spec).toContain('Va dans Plus → Apple Santé → Raccourcis pour importer ton sommeil, ta HRV et ta FC de repos.');
    expect(spec).toContain('L’iPhone calcule la récupération depuis ses imports Raccourcis et la publie ici par la synchro.');
  });
});

// Run CI 45372804746 : « Curl marteau » se fait aux haltères, le champ s'appelle « Charge par haltère (kg) » ; un libellé « Charge (kg) » exact ne le trouve pas.
describe('saisie de la charge dans les specs de séance', () => {
  it.each(['tests/e2e/C193-seance-clavier.spec.ts', 'tests/visual/capture.spec.ts'])('%s accepte « Charge par haltère (kg) »', (file) => {
    const text = readFileSync(resolve(import.meta.dirname, '..', '..', file), 'utf8');
    expect(text).not.toContain("getByLabel('Charge (kg)', { exact: true })");
    expect(text).toContain('Charge( par haltère)? \(kg\)');
  });
});
