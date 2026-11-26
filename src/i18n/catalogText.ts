import type { ParamNames } from './types';

/** Arguments d'une clé d'un catalogue à part : aucun si le texte n'a pas de `{x}`, sinon exactement ses paramètres (comme `t()`). */
export type CatalogArgs<C, K extends keyof C> = [ParamNames<C[K]>] extends [never] ? [] : [params: Readonly<Record<ParamNames<C[K]>, string | number>>];

/** CLEAN-0296 (C-085, D-644) : type d'un traducteur de catalogue à part (celui que rend `catalogText`). */
export type CatalogTranslator<C> = <K extends keyof C & string>(key: K, ...args: CatalogArgs<C, K>) => string;

/** CLEAN-0296 (C-085) : clés d'un catalogue à part dont le texte n'a aucun `{x}` (tables de libellés passées sans paramètre). */
export type PlainCatalogKey<C> = { [K in keyof C & string]: CatalogArgs<C, K> extends [] ? K : never }[keyof C & string];

/**
 * CLEAN-0296 (C-085, D-644) : le corps vit dans `units.ts`, pour rester dans le bloc partagé `units` : importé par vingt traducteurs, il
 * formerait sinon un bloc de plus, nommé par la table de préchargement du départ (+34 octets mesurés).
 */
export { catalogText } from './units';
