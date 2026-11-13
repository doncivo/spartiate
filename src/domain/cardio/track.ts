/**
 * I6-06 (D-222) : tracé GPS d'une séance cardio, règles pures. Le tracé reste sur l'appareil qui l'a enregistré (table locale `cardio_track`,
 * jamais publiée ni exportée) ; seules la durée et la distance passent dans `cardio_session`. Aucune position n'est écrite dans un journal.
 */

export interface TrackPoint {
  /** Degrés décimaux. */
  readonly lat: number;
  readonly lon: number;
  /** Instant de la mesure, millisecondes depuis l'époque Unix. */
  readonly at: number;
  /** Précision horizontale annoncée par le système, en mètres. */
  readonly accuracyM: number;
}

/** Règles de filtrage, constantes nommées (proposition de l'agent, révisable par Ali). */
export const TRACK_RULES = {
  /** Point moins précis que 50 m : ignoré. */
  maxAccuracyM: 50,
  /** Segment plus rapide que 15 m/s (54 km/h) : saut de signal, ignoré. */
  maxSpeedMps: 15,
  /** Pas de moins de 3 m depuis le dernier point gardé : bruit à l'arrêt, ni gardé ni compté. */
  minStepM: 3,
  /** Points gardés au plus (au-delà, la distance continue de compter, le tracé n'est plus prolongé). */
  maxPoints: 10_000,
  /** Rayon moyen de la Terre, en mètres. */
  earthRadiusM: 6_371_000,
} as const;

export interface TrackState {
  readonly points: readonly TrackPoint[];
  readonly distanceM: number;
  /** Dernier point retenu (gardé ou compté au-delà du plafond). */
  readonly last: TrackPoint | null;
  readonly truncated: boolean;
}

export const emptyTrack = (): TrackState => ({ points: [], distanceM: 0, last: null, truncated: false });

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Distance du grand cercle entre deux points, en mètres. */
export function haversineM(a: TrackPoint, b: TrackPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * TRACK_RULES.earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const isUsable = (p: TrackPoint): boolean =>
  Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.at) && Number.isFinite(p.accuracyM) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && p.accuracyM >= 0 && p.accuracyM <= TRACK_RULES.maxAccuracyM;

/** Ajoute une mesure au tracé : imprécise, instant qui recule, saut irréaliste ou pas trop court : état inchangé. */
export function addTrackPoint(state: TrackState, p: TrackPoint): TrackState {
  if (!isUsable(p)) return state;
  const last = state.last;
  if (last === null) return { points: [p], distanceM: 0, last: p, truncated: false };
  const dt = (p.at - last.at) / 1000;
  if (dt <= 0) return state;
  const d = haversineM(last, p);
  if (d / dt > TRACK_RULES.maxSpeedMps || d < TRACK_RULES.minStepM) return state;
  const full = state.points.length >= TRACK_RULES.maxPoints;
  return { points: full ? state.points : [...state.points, p], distanceM: state.distanceM + d, last: p, truncated: state.truncated || full };
}

/** Distance d'une liste de points déjà retenus. */
export function trackDistanceM(points: readonly TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i += 1) d += haversineM(points[i - 1] as TrackPoint, points[i] as TrackPoint);
  return d;
}

const E6 = 1e6;

/** Codage local compact : `{ v: 1, p: [[lat×1e6, lon×1e6, instant ms, précision m], …] }` en entiers. */
export function encodeTrack(points: readonly TrackPoint[]): string {
  return JSON.stringify({ v: 1, p: points.map((q) => [Math.round(q.lat * E6), Math.round(q.lon * E6), Math.round(q.at), Math.round(q.accuracyM)]) });
}

/** Lecture du codage local ; forme inattendue : null (jamais deviné). */
export function decodeTrack(text: string): TrackPoint[] | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || (value as { v?: unknown }).v !== 1) return null;
  const p = (value as { p?: unknown }).p;
  if (!Array.isArray(p)) return null;
  const out: TrackPoint[] = [];
  for (const item of p as unknown[]) {
    if (!Array.isArray(item) || item.length !== 4 || !item.every((n) => typeof n === 'number' && Number.isInteger(n))) return null;
    const [lat, lon, at, acc] = item as [number, number, number, number];
    out.push({ lat: lat / E6, lon: lon / E6, at, accuracyM: acc });
  }
  return out;
}
