import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { trainingGenerationFr } from './fr.trainingGeneration';

/** Textes de la séance proposée (I3-01) ; importé seulement par le bloc à la demande `GeneratedSession`. */
export type TrainingGenerationTextKey = keyof typeof trainingGenerationFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type TrainingGenerationPlainKey = PlainCatalogKey<typeof trainingGenerationFr>;

function translate(key: TrainingGenerationTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingGenerationFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tGeneration: CatalogTranslator<typeof trainingGenerationFr> = translate;
