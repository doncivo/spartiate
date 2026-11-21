import { useEffect, useState } from 'react';
import type { Exercise } from '../../../domain/training';
import { exerciseImage } from '../../../domain/training/media';
import { tTrainingMedia } from '../../../i18n/trainingMediaText';
import { mediaAttribution, mediaUrl } from './exerciseMediaFiles';
import { hasPictogram, loadPictogram } from './pictograms';
import './ExerciseMedia.css';

/**
 * Illustration d'un exercice sous sa fiche (I6-07, D-235), bloc à la demande (`React.lazy` dans LibraryView). Une photo sous licence est
 * prioritaire. Sans photo : le pictogramme dessiné pour le projet (MEDIA-03, D-413), avec la mention « pictogramme ». Sans l'un ni l'autre :
 * rien (D-71). Fichier absent du paquet ou illisible : « Illustration indisponible », visible, jamais d'icône cassée. Attribution sous la
 * photo (CC BY-SA 4.0).
 */
export default function ExerciseMedia({ exercise }: { readonly exercise: Exercise }) {
  const image = exerciseImage(exercise.media);
  if (image) return <Photo exercise={exercise} file={image.file} sourceId={image.sourceId} />;
  if (hasPictogram(exercise.id)) return <Pictogram exercise={exercise} />;
  return null;
}

function Photo({ exercise, file, sourceId }: { readonly exercise: Exercise; readonly file: string; readonly sourceId: string }) {
  const [failed, setFailed] = useState(false);
  const url = mediaUrl(file);
  const attribution = mediaAttribution(sourceId);
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

/** SVG du dossier de contenu, contrôlé par validate-content (aucun script, lien ni couleur en dur) : inséré tel quel pour hériter des couleurs. */
function Pictogram({ exercise }: { readonly exercise: Exercise }) {
  const [loaded, setLoaded] = useState<{ readonly id: string; readonly svg: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    // Revue : jamais le dessin de l'exercice précédent sous le nom du suivant (dessin rattaché à son id) ; un échec n'affiche rien.
    loadPictogram(exercise.id).then(
      (text) => {
        if (live) setLoaded({ id: exercise.id, svg: text });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [exercise.id]);
  const svg = loaded !== null && loaded.id === exercise.id ? loaded.svg : null;
  if (svg === null) return null;
  return (
    <figure className="ct-exmedia">
      <div className="ct-exmedia__picto" role="img" aria-label={tTrainingMedia('pictogramAlt', { name: exercise.nameFr })} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="ct-exmedia__caption">{tTrainingMedia('pictogramLabel')}</figcaption>
    </figure>
  );
}
