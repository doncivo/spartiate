import type { ExerciseMedia } from './types';

/** Image d'un exercice (I6-07) : fichier du catalogue, identifiant de la source vérifiée (préfixe de `media.source`), licence. */
export interface ExerciseImage {
  readonly file: string;
  readonly sourceId: string;
  readonly license: string;
}

/**
 * Lecture pure du champ `media` (§ 14.1) : la première image et sa source (`<source>:<chemin d'origine>`). Sans image, ou avec une source
 * sans identifiant, aucun média : l'écran se replie sans visuel (D-71). Un seul média par exercice (D-233, contrôlé par validate-content).
 */
export function exerciseImage(media: ExerciseMedia | null): ExerciseImage | null {
  const file = media?.images[0];
  if (!media || file === undefined) return null;
  const separator = media.source.indexOf(':');
  if (separator <= 0) return null;
  return { file, sourceId: media.source.slice(0, separator), license: media.license };
}
