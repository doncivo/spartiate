// ios-identite : la source SideStore décrit Spartiate (musculation, nutrition, récupération), jamais l'ancien projet.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const template = JSON.parse(read('scripts/ios/source.template.json')) as {
  description: string;
  apps: { subtitle: string; localizedDescription: string; tintColor: string }[];
};

describe('gabarit de la source SideStore', () => {
  const app = template.apps[0];

  it('sous-titre et descriptions propres à Spartiate', () => {
    expect(app?.subtitle).toBe('Musculation, nutrition et récupération');
    expect(app?.localizedDescription).toMatch(/musculation/);
    expect(app?.localizedDescription).toMatch(/nutrition/);
    expect(app?.localizedDescription).toMatch(/récupération/);
    expect(template.description).toMatch(/musculation, nutrition et récupération/);
  });

  it('teinte rouge de la charte', () => {
    expect(app?.tintColor).toBe('#B8322A');
  });

  it('aucun vocabulaire ni couleur de l’ancien projet', () => {
    const text = read('scripts/ios/source.template.json');
    expect(text).not.toMatch(/tâches|routines|checklists|planificateur/i);
    expect(text).not.toMatch(/#C2410C/i);
  });
});

describe('build-ios.yml : plus de Google hérité', () => {
  const workflow = read('.github/workflows/build-ios.yml');
  it('ni étape « ID client Google iOS compilé » ni commentaire Google', () => {
    expect(workflow).not.toMatch(/google/i);
  });
});
