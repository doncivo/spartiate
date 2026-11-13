import { addDays, weekdayOf } from '../localDate';
import { isLocalTime, type Id, type LocalDate, type LocalTime } from '../types';

/**
 * Compléments (I6-05, § 15.3 ; D-210, D-211) : règles pures. Un complément a un nom, une dose et une unité facultatives, 1 à 4 heures de prise
 * (« moments », heure locale 24 h), des jours de la semaine (masque : lundi = 1, mardi = 2 … dimanche = 64) et un état actif ou en pause.
 * Une prise est identifiée par (complément, date, heure) : cochée sur les deux appareils, c'est la même.
 */
export const SUPPLEMENT_NAME_MAX = 80;
export const SUPPLEMENT_UNIT_MAX = 16;
export const SUPPLEMENT_TIMES_MAX = 4;
export const SUPPLEMENT_DOSE_MAX = 100_000;
export const ALL_DAYS = 127;

export interface SupplementDraft {
  readonly name: string;
  readonly dose: number | null;
  readonly unit: string | null;
  readonly times: readonly LocalTime[];
  readonly days: number;
  readonly active: boolean;
}

export interface Supplement extends SupplementDraft {
  readonly id: Id | string;
  /** Jour local de création : aucune prise n'est due avant. */
  readonly since: LocalDate;
}

export interface SupplementIntake {
  readonly supplementId: string;
  readonly date: LocalDate;
  readonly moment: LocalTime;
}

export type SupplementDraftError = 'name' | 'dose' | 'unit' | 'times' | 'days';

export interface SupplementDraftInput {
  readonly name: string;
  readonly dose: number | null;
  readonly unit: string | null;
  readonly times: readonly string[];
  readonly days: number;
  readonly active: boolean;
}

/** Heures valides, triées, sans doublon ; null hors de 1 à 4. */
function normalizeTimes(times: readonly unknown[]): LocalTime[] | null {
  if (!times.every((x): x is string => typeof x === 'string' && isLocalTime(x))) return null;
  const out = [...new Set(times as string[])].sort() as LocalTime[];
  return out.length >= 1 && out.length <= SUPPLEMENT_TIMES_MAX ? out : null;
}

export function validateSupplementDraft(input: SupplementDraftInput): { readonly ok: true; readonly value: SupplementDraft } | { readonly ok: false; readonly error: SupplementDraftError } {
  const name = input.name.trim();
  if (name.length < 1 || name.length > SUPPLEMENT_NAME_MAX) return { ok: false, error: 'name' };
  const dose = input.dose;
  if (dose !== null && !(Number.isFinite(dose) && dose > 0 && dose <= SUPPLEMENT_DOSE_MAX)) return { ok: false, error: 'dose' };
  const unitText = input.unit?.trim() ?? '';
  if (unitText.length > SUPPLEMENT_UNIT_MAX) return { ok: false, error: 'unit' };
  const times = normalizeTimes(input.times);
  if (times === null) return { ok: false, error: 'times' };
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > ALL_DAYS) return { ok: false, error: 'days' };
  return { ok: true, value: { name, dose, unit: unitText === '' ? null : unitText, times, days: input.days, active: input.active } };
}

/** Colonne `times` (tableau JSON d'heures) ; null si illisible. */
export function parseSupplementTimes(json: string): LocalTime[] | null {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? normalizeTimes(value) : null;
  } catch {
    return null;
  }
}

/** Bit du jour de semaine ISO (lundi = 1 … dimanche = 64). */
export const dayBit = (date: LocalDate): number => 1 << (weekdayOf(date) - 1);

export function isDueOn(supplement: Supplement, date: LocalDate): boolean {
  return supplement.active && date >= supplement.since && (supplement.days & dayBit(date)) !== 0;
}

export interface DueIntake {
  readonly supplement: Supplement;
  readonly moment: LocalTime;
  readonly taken: boolean;
}

const intakeKey = (supplementId: string, date: string, moment: string): string => `${supplementId}|${date}|${moment}`;

/** Prises dues de la journée, triées par heure puis par nom ; `taken` d'après les prises cochées. */
export function dueIntakes(supplements: readonly Supplement[], intakes: readonly SupplementIntake[], date: LocalDate): DueIntake[] {
  const taken = new Set(intakes.map((i) => intakeKey(i.supplementId, i.date, i.moment)));
  const out: DueIntake[] = [];
  for (const supplement of supplements) {
    if (!isDueOn(supplement, date)) continue;
    for (const moment of supplement.times) out.push({ supplement, moment, taken: taken.has(intakeKey(supplement.id, date, moment)) });
  }
  return out.sort((a, b) => (a.moment < b.moment ? -1 : a.moment > b.moment ? 1 : a.supplement.name.localeCompare(b.supplement.name, 'fr')));
}

export interface SupplementAdherence {
  readonly due: number;
  readonly taken: number;
  /** null : aucune prise due sur la période (jamais un faux zéro). */
  readonly ratio: number | null;
}

/** Garde-fou : une période plus longue est tronquée (D-211 : 7 et 30 jours affichés). */
const MAX_SPAN_DAYS = 366;

/**
 * Constance (D-211) : prises cochées / prises dues, jours `from` à `to` compris, avec la configuration COURANTE de chaque complément (heures,
 * jours, pause), à partir de son jour de création. Une prise cochée à une heure qui n'est plus prévue ne compte pas.
 */
export function supplementAdherence(supplements: readonly Supplement[], intakes: readonly SupplementIntake[], from: LocalDate, to: LocalDate): SupplementAdherence {
  let due = 0;
  let taken = 0;
  let day = from;
  for (let i = 0; i < MAX_SPAN_DAYS && day <= to; i += 1, day = addDays(day, 1)) {
    for (const item of dueIntakes(supplements, intakes, day)) {
      due += 1;
      if (item.taken) taken += 1;
    }
  }
  return { due, taken, ratio: due === 0 ? null : taken / due };
}

/**
 * Série : jours complets consécutifs jusqu'à aujourd'hui. Aujourd'hui compte s'il est complet, sinon la série part d'hier (la journée n'est
 * pas finie) ; un jour sans prise due est sauté sans casser la série ; un jour incomplet l'arrête.
 */
export function supplementStreak(supplements: readonly Supplement[], intakes: readonly SupplementIntake[], today: LocalDate): number {
  const earliest = supplements.reduce<LocalDate | null>((min, s) => (min === null || s.since < min ? s.since : min), null);
  if (earliest === null) return 0;
  let streak = 0;
  let day = today;
  for (let i = 0; i < MAX_SPAN_DAYS && day >= earliest; i += 1, day = addDays(day, -1)) {
    const due = dueIntakes(supplements, intakes, day);
    if (due.length === 0) continue;
    if (due.every((x) => x.taken)) streak += 1;
    else if (day !== today) break;
  }
  return streak;
}

/** Rappels de compléments (D-212) : réglage LOCAL de l'appareil (iPhone), désactivé par défaut, jamais synchronisé. */
export interface SupplementNotificationPrefs {
  readonly v: 1;
  readonly enabled: boolean;
}

export function parseSupplementNotificationPrefs(raw: unknown): SupplementNotificationPrefs {
  return { v: 1, enabled: typeof raw === 'object' && raw !== null && (raw as Record<string, unknown>)['v'] === 1 && (raw as Record<string, unknown>)['enabled'] === true };
}
