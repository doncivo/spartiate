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
const scenes = [...spec.matchAll(/{ name: '([^']+)', (?:mockup: '([^']+)', )?viewport:/g)].map((m) => ({ name: m[1] as string, mockup: m[2] }));
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

describe('C-193 (relecture 1, point 6) : préparation de la fiche d\'exercice', () => {
  const start = spec.indexOf('const goFirstExercise');
  const block = spec.slice(start, spec.indexOf('};', start) + 2);
  it('attend le titre de la fiche, jamais un délai fixe', () => {
    expect(start).toBeGreaterThan(0);
    expect(block).not.toContain('waitForTimeout');
    expect(block).toContain('.ct-sheet__title');
  });
});

describe('BL-163 : les scènes attendent l’état visé avant la capture', () => {
  const line = (name: string): string => spec.split('\n').find((l) => l.includes(`{ name: '${name}',`)) ?? '';
  const block = (name: string): string => {
    const start = spec.indexOf(`const ${name} =`);
    return start < 0 ? '' : spec.slice(start, spec.indexOf('\n};', start) + 3);
  };

  it('Entraînement indisponible (440 et 1 440 px) : capture après la fin du chargement, jamais sur « Chargement… »', () => {
    expect(line('Entrainement-indisponible')).toContain('prepare: goTrainingReady');
    expect(line('PC-Entrainement-indisponible')).toContain('prepare: goTrainingReady');
    const ready = block('goTrainingReady');
    expect(ready).toContain("goTab('Entraînement')");
    expect(ready).toContain('waitForFunction');
    expect(ready).toContain('Chargement');
    expect(ready).not.toContain('waitForTimeout');
  });

  it('Dégradé apprentissage : la carte de récupération (rendue sans résumé dans cette scène : pas de cadrans) est attendue puis amenée dans le cadre', () => {
    expect(line('Degrade-apprentissage')).toContain('prepare: showLearning');
    const learning = block('showLearning');
    // Correctif du run 45611919752 : sans résumé de récupération, la carte n'a pas de cadrans (.ct-recovery__dials jamais rendu).
    expect(learning).toContain("locator('section.ct-recovery')");
    expect(learning).not.toContain('ct-recovery__dials');
    expect(learning).toContain('scrollIntoViewIfNeeded');
    expect(learning).not.toContain('waitForTimeout');
  });
});

describe('A-004 (SHELL-0295, D-640) : aucune pause fixe dans les captures, un signal observable à la place', () => {
  it('capture.spec.ts n’appelle jamais waitForTimeout', () => {
    expect(spec.match(/waitForTimeout\(/g) ?? []).toEqual([]);
  });

  it('les captures attendent la fin des animations et deux images peintes (settled), et la largeur demandée après un redimensionnement', () => {
    const start = spec.indexOf('async function settled(');
    const block = spec.slice(start, spec.indexOf('\n}', start) + 2);
    expect(start).toBeGreaterThan(0);
    expect(block).toContain('document.getAnimations()');
    expect(block).toContain('requestAnimationFrame');
    expect(spec).toContain('window.innerWidth === w');
    expect(spec.match(/await settled\(page\)/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
});
