import type { TrackPoint } from '../../domain/cardio';

/**
 * ERGO-02 : tracé d'affichage du suivi GPS en cours (aperçu Cardio-apres), lu des points déjà retenus par `addTrackPoint` (aucun filtrage
 * neuf ; l'allure du dernier km est une règle du domaine, `lastKmSecPerKm`).
 * Rien n'est écrit, journalisé ni envoyé ; le tracé n'est dessiné que sur l'appareil qui l'a enregistré (D-222).
 */

/** Tracé schématique : points ramenés dans une boîte `width` × `height` (marge comprise), proportions gardées ; moins de 2 points : vide. */
export function trackPath(points: readonly TrackPoint[], width: number, height: number, margin: number): string {
  if (points.length < 2) return '';
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const shrink = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * shrink);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const scale = Math.min(width, height) - 2 * margin;
  const offsetX = (width - ((Math.max(...xs) - minX) / span) * scale) / 2;
  const offsetY = (height - ((Math.max(...ys) - minY) / span) * scale) / 2;
  return xs
    .map((x, i) => {
      const px = offsetX + ((x - minX) / span) * scale;
      const py = height - (offsetY + (((ys[i] as number) - minY) / span) * scale);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');
}
