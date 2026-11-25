import type { ParamNames } from './types';

/** Arguments d'une clé d'un catalogue à part : aucun si le texte n'a pas de `{x}`, sinon exactement ses paramètres (comme `t()`). */
export type CatalogArgs<C, K extends keyof C> = [ParamNames<C[K]>] extends [never] ? [] : [params: Readonly<Record<ParamNames<C[K]>, string | number>>];

/**
 * SHELL-0295 (C-085, D-638) : traducteur d'un catalogue chargé avec son écran, hors de l'arbre `fr.ts` du départ. Les paramètres sont
 * typés depuis le texte français ; un paramètre absent reste visible sous la forme `{nom}`.
 */
export function catalogText<C extends Readonly<Record<string, string>>>(catalog: C) {
  return <K extends keyof C & string>(key: K, ...args: CatalogArgs<C, K>): string => {
    const text = catalog[key] as string;
    const params = args[0] as Readonly<Record<string, string | number>> | undefined;
    return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
  };
}
