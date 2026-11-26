import type { CatalogTranslator } from './catalogText';
import { syncRestoreFr } from './fr.syncRestore';

/**
 * Textes de la fenêtre de choix après une restauration, à part du catalogue principal (bundle de départ, PRD 8) ; importé seulement par
 * des modules chargés à la demande (`RestoreChoiceDialog`, `BackupSheet`). L'anglais est servi quand la langue courante est `en`.
 */
export type SyncRestoreTextKey = keyof typeof syncRestoreFr;

function translate(key: SyncRestoreTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = syncRestoreFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0296 (C-085, D-644) : paramètres typés comme par `catalogText` ; corps gardé ici, l'écran ne précharge aucun bloc de plus. */
export const tRestore: CatalogTranslator<typeof syncRestoreFr> = translate;
