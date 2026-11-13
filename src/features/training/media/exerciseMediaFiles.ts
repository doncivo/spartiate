import { tTrainingMedia, type TrainingMediaTextKey } from '../../../i18n/trainingMediaText';

/**
 * Médias d'exercice embarqués (I6-07, D-235) : les images de content/exercises/media sont des fichiers du paquet, émis par Vite avec un nom
 * haché ; cette table ne contient que leurs adresses locales (aucun octet d'image), dans le bloc à la demande `ExerciseMedia`. L'image n'est
 * lue qu'à l'affichage de la fiche. Aucune adresse réseau : la CSP (`img-src 'self' …`) est inchangée.
 */
const URLS = import.meta.glob<string>('../../../../content/exercises/media/*.png', { eager: true, query: '?url', import: 'default' });

const BY_FILE: ReadonlyMap<string, string> = new Map(Object.entries(URLS).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]));

/** Adresse locale d'un fichier du catalogue, `null` s'il n'est pas dans le paquet. */
export function mediaUrl(file: string): string | null {
  return BY_FILE.get(file) ?? null;
}

/** Attribution par source vérifiée (D-231) ; `null` pour une source inconnue (le validateur de contenu la refuse). */
const ATTRIBUTION: Readonly<Record<string, TrainingMediaTextKey>> = { everkinetic: 'attributionEverkinetic' };

export function mediaAttribution(sourceId: string): string | null {
  const key = Object.hasOwn(ATTRIBUTION, sourceId) ? ATTRIBUTION[sourceId] : undefined;
  return key === undefined ? null : tTrainingMedia(key);
}
