import { haversineM, type TrackPoint } from '../../domain/cardio';

/**
 * ERGO-02 : chiffres d'affichage du suivi GPS en cours (aperçu Cardio-apres), lus des points déjà retenus par `addTrackPoint` (aucun filtrage
 * neuf). Rien n'est écrit, journalisé ni envoyé ; le tracé n'est dessiné que sur l'appareil qui l'a enregistré (D-222).
 */

/** Allure du dernier kilomètre parcouru (s / km, arrondie), depuis la fin du tracé ; null tant que le tracé ne couvre pas 1 km. */
export function lastKmSecPerKm(points: readonly TrackPoint[]): number | null {
  const last = points.at(-1);
  if (last === undefined) return null;
  let distance = 0;
  for (let i = points.length - 1; i > 0; i -= 1) {
    const a = points[i - 1] as TrackPoint;
    distance += haversineM(a, points[i] as TrackPoint);
    if (distance >= 1000) return Math.round(((last.at - a.at) / 1000) * (1000 / distance));
  }
  return null;
}

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
