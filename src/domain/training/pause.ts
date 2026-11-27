/**
 * SESS-0302 (BL-110, D-658, § 13.2 « Pause / abandonner ») : pause de séance. Module pur.
 *
 * Deux champs de `workout` (migration 0024) : `pausedAt`, instant du début de la pause EN COURS (null hors pause), et `pausedMs`, cumul des pauses
 * terminées. Absents (ligne d'avant la 0024, ancien export ou journal) : aucune pause, cumul 0. La durée effective d'une séance est fin − début − pauses ;
 * elle sert au chrono, au résumé, à l'énergie envoyée à Apple Santé et au replay. Une horloge reculée ou un instant illisible ne produit jamais de
 * durée négative ni NaN.
 */

export interface PauseFields {
  readonly pausedAt?: string | null;
  readonly pausedMs?: number | null;
}

export interface PauseState {
  readonly pausedAt: string | null;
  readonly pausedMs: number;
}

const cumul = (w: PauseFields): number => (typeof w.pausedMs === 'number' && Number.isFinite(w.pausedMs) && w.pausedMs > 0 ? Math.round(w.pausedMs) : 0);
const instant = (value: string | null | undefined): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/** Une pause est-elle en cours ? */
export function isPaused(w: PauseFields): boolean {
  return typeof w.pausedAt === 'string';
}

/** Temps de pause total à l'instant `atMs` : cumul plus la pause en cours jusqu'à `atMs` (jamais négative). */
export function pausedMsAt(w: PauseFields, atMs: number): number {
  const since = instant(w.pausedAt);
  return cumul(w) + (since === null ? 0 : Math.max(0, atMs - since));
}

/** Début d'une pause à `atMs` ; déjà en pause : inchangée. */
export function startPause(w: PauseFields, atMs: number): PauseState {
  if (isPaused(w)) return { pausedAt: w.pausedAt as string, pausedMs: cumul(w) };
  return { pausedAt: new Date(atMs).toISOString(), pausedMs: cumul(w) };
}

/** Fin de la pause en cours à `atMs` : sa durée rejoint le cumul ; hors pause : inchangée. */
export function endPause(w: PauseFields, atMs: number): PauseState {
  return { pausedAt: null, pausedMs: pausedMsAt(w, atMs) };
}

/**
 * Durée effective (ms) d'une séance à `nowMs` : (fin, sinon maintenant) − début − pauses comptées jusqu'à cette fin ; au moins 0. Début illisible : null.
 */
export function effectiveElapsedMs(w: PauseFields & { readonly startedAt: string; readonly endedAt?: string | null }, nowMs: number): number | null {
  const start = instant(w.startedAt);
  if (start === null) return null;
  const end = instant(w.endedAt) ?? nowMs;
  return Math.max(0, end - start - pausedMsAt(w, end));
}
