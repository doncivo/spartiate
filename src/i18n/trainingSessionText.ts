import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { trainingSessionFr } from './fr.trainingSession';

/** Textes des ajouts SESS-01 de la séance active ; importé seulement par des blocs chargés à la demande. */
export type TrainingSessionTextKey = keyof typeof trainingSessionFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type TrainingSessionPlainKey = PlainCatalogKey<typeof trainingSessionFr>;

function translate(key: TrainingSessionTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingSessionFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tSession: CatalogTranslator<typeof trainingSessionFr> = translate;
