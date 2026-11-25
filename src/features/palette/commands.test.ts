import { describe, expect, it } from 'vitest';
import { buildPaletteCommands, filterPaletteCommands } from './commands';

/** C-135 (D-480), § 18.1 b : commandes de la palette Ctrl+K du PC, logique pure. */
describe('palette de commandes : liste et filtre', () => {
  const commands = buildPaletteCommands();
  const find = (id: string) => commands.find((c) => c.id === id);

  it('offre les cinq sections, la séance du jour et l’ajout d’un repas', () => {
    expect(find('tab.today')?.route).toEqual({ tab: 'today' });
    expect(find('tab.training')?.route).toEqual({ tab: 'training' });
    expect(find('tab.nutrition')?.route).toEqual({ tab: 'nutrition' });
    expect(find('tab.progress')?.route).toEqual({ tab: 'progress' });
    expect(find('tab.more')?.route).toEqual({ tab: 'more', screen: 'home' });
    expect(find('action.startSession')?.route).toEqual({ tab: 'training', screen: 'session' });
    expect(find('action.addMeal')?.route).toEqual({ tab: 'nutrition', screen: 'journal', meals: true });
  });

  it('chaque commande a un identifiant unique et un libellé français', () => {
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    for (const c of commands) expect(c.label.length).toBeGreaterThan(0);
  });

  it('le filtre ignore casse et accents et exige tous les mots', () => {
    expect(filterPaletteCommands(commands, 'ENTRAINEMENT').map((c) => c.id)).toContain('tab.training');
    expect(filterPaletteCommands(commands, 'ajouter repas').map((c) => c.id)).toEqual(['action.addMeal']);
    expect(filterPaletteCommands(commands, 'demarrer seance').map((c) => c.id)).toEqual(['action.startSession']);
    expect(filterPaletteCommands(commands, 'zzzz')).toEqual([]);
    expect(filterPaletteCommands(commands, '  ')).toEqual(commands);
  });
});
