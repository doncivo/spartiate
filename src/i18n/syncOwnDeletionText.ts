import type { CatalogTranslator } from './catalogText';
import { syncOwnDeletionFr } from './fr.syncOwnDeletion';

/** Catalogue chargé avec la ligne d'échec, jamais au départ. */
function translate(key: keyof typeof syncOwnDeletionFr, args: Readonly<Record<string, string | number>> = {}): string {
  return syncOwnDeletionFr[key].replace(/\{(\w+)\}/g, (_, name: string) => String(args[name] ?? ''));
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tOwnDeletion: CatalogTranslator<typeof syncOwnDeletionFr> = translate;
