import { paletteFr } from './fr.palette';

/** Textes de la palette de commandes ; importé seulement par des blocs chargés à la demande. */
export type PaletteTextKey = keyof typeof paletteFr;

export function tPalette(key: PaletteTextKey): string {
  return paletteFr[key];
}
