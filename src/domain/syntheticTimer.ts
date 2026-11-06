/**
 * Minuteur synthétique de 60 s (SPA-007, H-4) : sert à éprouver la Live Activity et le repli (minuteur dans l'app + notification locale). Il
 * n'a aucun rôle métier. Règle : le temps restant se recalcule TOUJOURS depuis la date de fin persistée, jamais depuis un compteur JavaScript
 * (suspendu en arrière-plan, donc faux à la reprise). Pur : ni Tauri ni React.
 */

export const SYNTHETIC_TIMER_MS = 60_000;
/** Notification de l'échéance : identifiant réservé hors plan (1 à 65 535 ; 1 = fin de session Focus), le même à chaque reprise (aucun doublon). */
export const TIMER_NOTIFICATION_ID = 7;
export const TIMER_LABEL_MAX = 80;
const MAX_END_MS = 4_102_444_800_000; // 2100-01-01

export interface SyntheticTimerState {
  /** Fin du minuteur, ms depuis 1970 (UTC). */
  readonly endMs: number;
  readonly label: string;
}

export type TimerPhase = 'idle' | 'running' | 'finished';

/** Valeur persistée (réglage local, brute) : état valide ou null. Jamais une exception ni une date inventée. */
export function parseSyntheticTimer(raw: unknown): SyntheticTimerState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { endMs, label } = raw as Record<string, unknown>;
  if (typeof endMs !== 'number' || !Number.isFinite(endMs) || endMs <= 0 || endMs > MAX_END_MS) return null;
  if (typeof label !== 'string' || label.trim() === '') return null;
  return { endMs, label: label.slice(0, TIMER_LABEL_MAX) };
}

export function timerRemainingMs(state: SyntheticTimerState, nowMs: number): number {
  return Math.max(0, state.endMs - nowMs);
}

export function timerPhase(state: SyntheticTimerState | null, nowMs: number): TimerPhase {
  if (state === null) return 'idle';
  return timerRemainingMs(state, nowMs) > 0 ? 'running' : 'finished';
}

/** « 1:00 », « 0:59 » : arrondi vers le haut, « 0:00 » seulement à l'échéance. */
export function formatTimerRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}
