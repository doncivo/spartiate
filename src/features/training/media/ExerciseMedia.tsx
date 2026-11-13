import { useState } from 'react';
import type { Exercise } from '../../../domain/training';
import { exerciseImage } from '../../../domain/training/media';
import { tTrainingMedia } from '../../../i18n/trainingMediaText';
import { mediaAttribution, mediaUrl } from './exerciseMediaFiles';
import './ExerciseMedia.css';

/**
 * Illustration d'un exercice sous sa fiche (I6-07, D-235), bloc à la demande (`React.lazy` dans LibraryView). Sans média : rien (D-71).
 * Fichier absent du paquet ou illisible : « Illustration indisponible », visible, jamais d'icône cassée. Attribution sous l'image (CC BY-SA 4.0).
 */
export default function ExerciseMedia({ exercise }: { readonly exercise: Exercise }) {
  const [failed, setFailed] = useState(false);
  const image = exerciseImage(exercise.media);
  if (!image) return null;
  const url = mediaUrl(image.file);
  const attribution = mediaAttribution(image.sourceId);
  return (
    <figure className="ct-exmedia">
      {url === null || failed ? (
        <p className="ct-exmedia__missing">{tTrainingMedia('mediaUnavailable')}</p>
      ) : (
        <img className="ct-exmedia__img" src={url} alt={tTrainingMedia('mediaAlt', { name: exercise.nameFr })} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
      {attribution === null ? null : <figcaption className="ct-exmedia__caption">{attribution}</figcaption>}
    </figure>
  );
}
