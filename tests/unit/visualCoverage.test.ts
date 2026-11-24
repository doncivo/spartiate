import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-193 (PRD § 18.5 et § 23.1) : `npm run visual` a une scène par onglet à chaque largeur (440 et 1 440 px) et une scène par état dégradé
 * atteignable dans le navigateur de test ; chaque maquette citée existe. Contrôle statique de tests/visual/capture.spec.ts : les captures
 * elles-mêmes sont produites en CI (job « visual », artefact visual-pairs), jamais en local.
 */
const root = resolve(import.meta.dirname, '..', '..');
const spec = readFileSync(resolve(root, 'tests/visual/capture.spec.ts'), 'utf8');
const scenes = [...spec.matchAll(/name: '([^']+)'(?:, mockup: '([^']+)')?/g)].map((m) => ({ name: m[1] as string, mockup: m[2] }));
const names = new Set(scenes.map((s) => s.name));

describe('C-193 : scènes de npm run visual', () => {
  it.each([
    ['Aujourd’hui', 'Aujourdhui', 'PC-Aujourdhui'],
    ['Entraînement', 'Entrainement-routines', 'PC-Entrainement-routines'],
    ['Nutrition', 'Nutrition-journal-fiche', 'PC-Nutrition-journal'],
    ['Progrès', 'Progres', 'PC-Progres'],
    ['Plus', 'Plus', 'PC-Plus'],
  ])('onglet %s : une scène à 440 px et une à 1 440 px', (_tab, phone, pc) => {
    expect(names.has(phone), phone).toBe(true);
    expect(names.has(pc), pc).toBe(true);
  });

  it('séance active, résumé et fiche d’exercice (§ 18.5) ont leur paire app / maquette', () => {
    for (const name of ['Seance-active', 'PC-Seance-active', 'Seance-resume', 'Entrainement-fiche', 'PC-Entrainement-fiche']) expect(names.has(name), name).toBe(true);
  });

  it('états dégradés (§ 18.3) atteignables : apprentissage, signature sous 24 h, signature expirée', () => {
    for (const name of ['Degrade-apprentissage', 'Degrade-signature-24h', 'Degrade-signature-expiree']) expect(names.has(name), name).toBe(true);
  });

  it('chaque maquette citée existe dans docs/maquettes/', () => {
    const missing = scenes.filter((s) => s.mockup && !existsSync(resolve(root, 'docs/maquettes', s.mockup))).map((s) => `${s.name} : ${s.mockup}`);
    expect(missing).toEqual([]);
  });

  it('aucun nom de scène en double (un fichier de capture écraserait l’autre)', () => {
    expect(scenes.length).toBe(names.size);
  });
});
