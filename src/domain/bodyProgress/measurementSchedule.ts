import { addDays } from '../localDate';
import { isLocalDate, type LocalDate } from '../types';
import { isMeasurementKind } from './measurements';
import { daysBetween, type BodySample } from './period';

/**
 * PROG-0301b (BL-178, D-710, D-713, D-734) : dernière et prochaine séance de mesures. Dernière séance = date de la dernière mesure saisie de
 * l'une des 11 zones (hors `health_*`, `note_*`, `visbody_*`) jusqu'à aujourd'hui ; prochaine = dernière + rythme ; échéance passée :
 * conseillée aujourd'hui, jamais un nombre négatif. Le réglage lui-même (table `settings`) et le rappel iPhone relèvent de BL-180.
 */

export const MEASUREMENT_RHYTHMS_DAYS = [7, 14, 28] as const;
export type MeasurementRhythmDays = (typeof MEASUREMENT_RHYTHMS_DAYS)[number];
export const DEFAULT_MEASUREMENT_RHYTHM_DAYS: MeasurementRhythmDays = 7;

/** Rythme lu (nombre, ou texte décimal exact du réglage) ; toute autre valeur : 7 jours (D-734). */
export function parseMeasurementRhythm(value: unknown): MeasurementRhythmDays {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return (MEASUREMENT_RHYTHMS_DAYS as readonly number[]).includes(n) ? (n as MeasurementRhythmDays) : DEFAULT_MEASUREMENT_RHYTHM_DAYS;
}

/** Date de la dernière séance de mesures ; `null` sans zone saisie. Une date après `today` est ignorée (D-734). */
export function lastMeasurementSession(samples: readonly Pick<BodySample, 'kind' | 'date'>[], today: LocalDate): LocalDate | null {
  let last: LocalDate | null = null;
  for (const s of samples) if (isMeasurementKind(s.kind) && isLocalDate(s.date) && s.date <= today && (last === null || s.date > last)) last = s.date;
  return last;
}

export type MeasurementSchedule =
  | { readonly status: 'none' }
  | {
      readonly status: 'scheduled';
      readonly last: LocalDate;
      readonly daysSince: number;
      /** Dernière + rythme, brute (le rappel iPhone de BL-180 en part). */
      readonly dueDate: LocalDate;
      /** Prochaine conseillée : l'échéance, ou aujourd'hui si elle est passée. */
      readonly nextDate: LocalDate;
      readonly daysUntil: number;
      readonly overdue: boolean;
    };

export function measurementSchedule(samples: readonly Pick<BodySample, 'kind' | 'date'>[], rhythm: MeasurementRhythmDays, today: LocalDate): MeasurementSchedule {
  const last = lastMeasurementSession(samples, today);
  if (last === null) return { status: 'none' };
  const dueDate = addDays(last, parseMeasurementRhythm(rhythm));
  const overdue = dueDate < today;
  const nextDate = overdue ? today : dueDate;
  return { status: 'scheduled', last, daysSince: daysBetween(last, today), dueDate, nextDate, daysUntil: daysBetween(today, nextDate), overdue };
}
