import type { CatalogTranslator } from './catalogText';
import { appUpdateRestoreFr } from './fr.appUpdateRestore';

/** Textes de « Restaurer la sauvegarde d'avant la mise à jour » (I-06), chargés avec l'action, jamais au démarrage. */
export type AppUpdateRestoreTextKey = keyof typeof appUpdateRestoreFr;

function translate(key: AppUpdateRestoreTextKey, params: Readonly<Record<string, string | number>> = {}): string {
  const text = appUpdateRestoreFr[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tUpdateRestore: CatalogTranslator<typeof appUpdateRestoreFr> = translate;
