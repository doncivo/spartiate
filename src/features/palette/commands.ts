import { tPalette, type PaletteTextKey } from '../../i18n/paletteText';
import { DEFAULT_ROUTES, type Route } from '../app/navigation';

/** SHELL-0294a (C-135, D-480) : commandes de la palette Ctrl+K (PC) : aller à un écran, démarrer la séance du jour, ajouter un repas. */
export interface PaletteCommand {
  readonly id: string;
  readonly label: string;
  readonly route: Route;
}

const command = (id: string, key: PaletteTextKey, route: Route): PaletteCommand => ({ id, label: tPalette(key), route });

/** Les actions d'abord, puis les cinq sections, puis les écrans internes. « Repartir de zéro » n'y figure pas : action destructive, jamais en un geste. */
export function buildPaletteCommands(): PaletteCommand[] {
  return [
    command('action.startSession', 'startSession', { tab: 'training', screen: 'session' }),
    command('action.addMeal', 'addMeal', { tab: 'nutrition', screen: 'journal', meals: true }),
    command('tab.today', 'goToday', DEFAULT_ROUTES.today),
    command('tab.training', 'goTraining', DEFAULT_ROUTES.training),
    command('tab.nutrition', 'goNutrition', DEFAULT_ROUTES.nutrition),
    command('tab.progress', 'goProgress', DEFAULT_ROUTES.progress),
    command('tab.more', 'goMore', DEFAULT_ROUTES.more),
    command('training.routines', 'goRoutines', { tab: 'training', screen: 'routines' }),
    command('training.library', 'goLibrary', { tab: 'training', screen: 'library' }),
    command('training.equipment', 'goEquipment', { tab: 'training', screen: 'equipment' }),
    command('training.history', 'goHistory', { tab: 'training', screen: 'history' }),
    command('training.cycle', 'goCycle', { tab: 'training', screen: 'cycle' }),
    command('training.cardio', 'goCardio', { tab: 'training', screen: 'cardio' }),
    command('nutrition.journal', 'goJournal', { tab: 'nutrition', screen: 'journal' }),
    command('nutrition.dashboard', 'goDashboard', { tab: 'nutrition', screen: 'dashboard' }),
    command('nutrition.strategy', 'goStrategy', { tab: 'nutrition', screen: 'strategy' }),
    command('nutrition.checkin', 'goCheckin', { tab: 'nutrition', screen: 'checkin' }),
    command('nutrition.recipes', 'goRecipes', { tab: 'nutrition', screen: 'recipes' }),
    command('nutrition.supplements', 'goSupplements', { tab: 'nutrition', screen: 'supplements' }),
    command('more.appearance', 'goAppearance', { tab: 'more', screen: 'appearance' }),
    command('more.body', 'goBody', { tab: 'more', screen: 'body' }),
    command('more.sync', 'goSync', { tab: 'more', screen: 'sync' }),
    command('more.exportimport', 'goExport', { tab: 'more', screen: 'exportimport' }),
    command('more.logs', 'goLogs', { tab: 'more', screen: 'logs' }),
  ];
}

const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Tous les mots de la saisie figurent dans le libellé, sans tenir compte de la casse ni des accents ; saisie vide : tout. */
export function filterPaletteCommands(commands: readonly PaletteCommand[], query: string): PaletteCommand[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];
  return commands.filter((item) => {
    const label = fold(item.label);
    return words.every((word) => label.includes(word));
  });
}
