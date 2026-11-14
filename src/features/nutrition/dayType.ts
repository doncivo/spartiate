import { dayTargetFor, type DayType, type Target } from '../../domain/nutrition';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';

/**
 * PROG-01 (D-270) : cible du jour selon son type. Chargé à la demande (jamais dans le départ) par Aujourd'hui et le journal.
 * Séances de musculation closes : leur date locale de début ; le cardio seul ne change pas le type du jour.
 */
const CLOSED_LOOKBACK = 60;

const localDateOf = (iso: string): LocalDate => {
  const d = new Date(Date.parse(iso));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as LocalDate;
};

/** Dates locales des séances de musculation closes (les plus récentes). */
export async function strengthDays(access: DataAccess): Promise<ReadonlySet<LocalDate>> {
  const closed = await (await access.repos.workouts()).listClosed(CLOSED_LOOKBACK);
  return new Set(closed.map((w) => localDateOf(w.startedAt)));
}

/** Cible du jour `date` et son type (`null` sans cible de repos) ; `null` sans cible en vigueur. */
export async function loadDayTarget(access: DataAccess, date: LocalDate): Promise<{ readonly type: DayType | null; readonly target: Target } | null> {
  const effective = await (await access.repos.nutritionTargets()).effective(date);
  if (effective === null) return null;
  const plan = effective.restPlan ?? null;
  if (plan === null) return { type: null, target: effective.target };
  return dayTargetFor(effective.target, plan, date, await strengthDays(access));
}
