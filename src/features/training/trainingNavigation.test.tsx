import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { TrainingScreen } from '../app/lazyScreens';

/** I1-01 (critère 6) : l'onglet Entraînement ouvre ses écrans à la demande ; la section revient à son dernier écran. */

const source = (path: string): string => readFileSync(join(import.meta.dirname, path), 'utf8');

describe('Entraînement : navigation et chargement à la demande', () => {
  beforeEach(() => useNavigationStore.setState(INITIAL_NAVIGATION));

  it('revenir sur Entraînement restaure la bibliothèque ouverte', () => {
    const nav = useNavigationStore.getState();
    nav.navigate({ tab: 'training', screen: 'library' });
    nav.goToTab('today');
    nav.goToTab('training');
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'library' });
  });

  it('écran paresseux : import dynamique seulement, ni l’App ni le départ n’importent la feature training', async () => {
    expect(typeof TrainingScreen.preload).toBe('function');
    expect(source('../app/lazyScreens.tsx')).toContain("import('../training/TrainingScreen')");
    for (const file of ['../../App.tsx', '../app/lazyScreens.tsx', '../app/navigation.ts']) expect(source(file), file).not.toMatch(/from '[./]*\/?(features\/)?training\//);
    await TrainingScreen.preload();
    expect(document.documentElement.getAttribute('data-ct-loaded-trainingscreen')).toBe('true');
  });

  it('I1-03 : journal et résumé de fin sont chargés à la demande (import dynamique, aucun import statique)', () => {
    expect(source('./TrainingScreen.tsx')).toContain("import('./history/HistoryView')");
    expect(source('./session/SessionScreen.tsx')).toContain("import('./WorkoutSummary')");
    for (const [file, target] of [
      ['./TrainingScreen.tsx', 'history/HistoryView'],
      ['./session/SessionScreen.tsx', 'WorkoutSummary'],
      ['./session/ActiveSession.tsx', 'WorkoutSummary'],
      ['./session/TodaySessionCard.tsx', 'history/'],
    ] as const)
      expect(source(file), file).not.toMatch(new RegExp(`from '[^']*${target}`));
  });

  it('le contenu embarqué et le catalogue de textes ne sont importés que par des modules de la feature', () => {
    expect(source('./content.ts')).toMatch(/import\('\.\.\/\.\.\/\.\.\/content\/exercises\/exercises\.json'\)/);
    expect(source('../../i18n/trainingText.ts')).toContain("from './fr.training'");
  });
});
