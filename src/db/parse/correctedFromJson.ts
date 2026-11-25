import { REPS_MAX, RIR_MAX } from '../../domain/training/routineRules';
import { DURATION_MAX_SEC, LOAD_MAX_KG } from '../../domain/training/session';
import { decodeJson } from './jsonText';

/** DATA-0293 (C-072, Q-13 B) : valeurs d'une série avant sa dernière correction, stockées en JSON dans `workout_set.corrected_from` (écrit à la main, ADR 0008). */
export interface CorrectedFrom {
  readonly reps: number | null;
  readonly loadKg: number | null;
  readonly durationSec: number | null;
  readonly rir: number | null;
}

const inRange = (v: unknown, min: number, max: number, integer: boolean): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v));
const field = (v: unknown, min: number, max: number, integer: boolean): number | null | undefined => (v === null || v === undefined ? null : inRange(v, min, max, integer) ? v : undefined);

/** Lecture tolérante : texte absent, illisible ou hors bornes : `null` (jamais d'exception). */
export function parseCorrectedFrom(text: string | null): CorrectedFrom | null {
  const raw = decodeJson(text);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const reps = field(o['reps'], 1, REPS_MAX, true);
  const loadKg = field(o['loadKg'], 0, LOAD_MAX_KG, false);
  const durationSec = field(o['durationSec'], 1, DURATION_MAX_SEC, true);
  const rir = field(o['rir'], 0, RIR_MAX, true);
  if (reps === undefined || loadKg === undefined || durationSec === undefined || rir === undefined) return null;
  return { reps, loadKg, durationSec, rir };
}

/** Texte à stocker (toujours les quatre clés), borné à 200 caractères par la colonne. */
export const serializeCorrectedFrom = (v: CorrectedFrom): string => JSON.stringify({ reps: v.reps, loadKg: v.loadKg, durationSec: v.durationSec, rir: v.rir });
