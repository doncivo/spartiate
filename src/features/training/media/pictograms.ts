/**
 * Pictogrammes SVG des exercices sans photo (MEDIA-03, D-413) : dessinés pour le projet, générés par scripts/content/build-pictograms.mjs,
 * contrôlés par validate-content (aucun script, lien ni couleur en dur). Chargement à la demande, un fichier par exercice, lu seulement à
 * l'affichage de la fiche ou de la séance ; aucun octet de pictogramme dans le bloc de départ.
 */
const LOADERS = import.meta.glob<string>('../../../../content/exercises/pictograms/*.svg', { query: '?raw', import: 'default' });

const BY_ID: ReadonlyMap<string, () => Promise<string>> = new Map(Object.entries(LOADERS).map(([path, load]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), load]));

/** Vrai si l'exercice a un pictogramme dans le paquet. */
export function hasPictogram(exerciseId: string): boolean {
  return BY_ID.has(exerciseId);
}

/** Texte SVG du pictogramme, `null` s'il n'existe pas ou n'est pas lisible. */
export async function loadPictogram(exerciseId: string): Promise<string | null> {
  const load = BY_ID.get(exerciseId);
  if (!load) return null;
  try {
    return await load();
  } catch {
    return null;
  }
}
