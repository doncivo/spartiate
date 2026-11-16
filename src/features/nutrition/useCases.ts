import type { Profile } from '../../domain/bodyProfile';
import { strengthDays } from './dayType';
import { restTargetFromGap, type RestPlan } from '../../domain/nutrition/restDay';
import { addDays } from '../../domain/localDate';
import {
  aggregateDays,
  computeTotals,
  DEFAULT_NUTRITION_PREFS,
  upcomingTargets,
  estimateTdee,
  parseNutritionPrefs,
  resolveCheckIn,
  toMealEntryInput,
  validateTargetRecord,
  type TargetRecordDraft,
  computeTrend,
  type CheckInDecision,
  type CheckInOutcome,
  type DayTotals,
  type MealEntryDraft,
  type NutritionPrefs,
  type Proposal,
  type Target,
  type TdeeEstimate,
  type TrendPoint,
  type WeighIn,
} from '../../domain/nutrition';
import { tNutrition } from '../../i18n/nutritionText';
import { logFailure } from '../../platform/desktop/log';
import type { SearchableFood } from '../../domain/nutrition/foodSearch';
import type { LocalDate, LocalTime } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';
import type { NutritionTargetRecord } from '../../db/repositories/nutritionTargetRepository';

/**
 * Cas d'usage de Nutrition (I4-03), sans interface. Le moteur d'I4-01 propose, Ali décide : aucune cible n'est écrite sans son geste
 * (accepter, personnaliser, refuser), chaque décision est une ligne tracée de `nutrition_target`, et le plancher du § 15.2 est appliqué
 * par `resolveCheckIn`. Aucune valeur inconnue n'est remplacée par zéro.
 */

/** Jours relus pour les vues (60 : deux fenêtres de 21 jours de dépense et le recul du dashboard). */
export const SNAPSHOT_DAYS = 60;

export interface NutritionSnapshot {
  readonly today: LocalDate;
  /** Veille : dernier jour complet possible, fin des fenêtres de dépense et de couverture. */
  readonly reference: LocalDate;
  /** Un `DayTotals` par date de `today - 59` à `today` (les jours sans entrée sont `unknown`). */
  readonly days: readonly DayTotals[];
  readonly weighIns: readonly WeighIn[];
  readonly trend: readonly TrendPoint[];
  readonly tdee: TdeeEstimate;
  readonly prefs: NutritionPrefs;
  readonly profile: Profile | null;
  /** PROG-01 (D-270) : dates locales des séances de musculation closes (type de jour) ; absent : aucune. */
  readonly strengthDays?: ReadonlySet<LocalDate>;
  /** Cible en vigueur à `today` ; `null` tant qu'aucune n'est acceptée. */
  readonly target: NutritionTargetRecord | null;
  /** Toutes les décisions, de la plus récente à la plus ancienne. */
  readonly targets: readonly NutritionTargetRecord[];
}

export async function loadNutritionSnapshot(access: DataAccess, today: LocalDate): Promise<NutritionSnapshot> {
  const from = addDays(today, -(SNAPSHOT_DAYS - 1));
  const [entries, bodyWeights, profiles, targets, completeness] = await Promise.all([
    access.repos.mealEntries(),
    access.repos.bodyWeights(),
    access.repos.profile(),
    access.repos.nutritionTargets(),
    access.repos.dayCompleteness(),
  ]);
  const settings = access.repos.settings;
  const [records, weights, profile, decisions, effective, rawPrefs, declared] = await Promise.all([
    entries.listBetween(from, today),
    bodyWeights.listRecent(400),
    profiles.get(),
    targets.list(),
    targets.effective(today),
    settings.get('nutrition.prefs'),
    completeness.listBetween(from, today),
  ]);
  const prefs = parseNutritionPrefs(rawPrefs);
  // Déclarations d'Ali (D-81) : elles priment sur la déduction ; couverture, dépense, dashboard et check-in les utilisent.
  const days = aggregateDays(from, today, records.map(toMealEntryInput), Object.fromEntries(declared));
  const weighIns: WeighIn[] = [...weights]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.measuredAt ?? '') < (b.measuredAt ?? '') ? -1 : 1))
    .map((w) => ({ date: w.date, kg: w.kg }));
  const reference = addDays(today, -1);
  const tdee = estimateTdee({
    endDate: reference,
    days,
    weighIns,
    profile: profile === null ? null : { sex: profile.sex, birthYear: profile.birthYear, heightCm: profile.heightCm },
    activity: prefs.activity,
    previousSmoothed: null,
  });
  // PROG-01 : les séances closes ne servent qu'avec une cible de repos (aucune lecture de plus sinon).
  const strength = decisions.some((d) => d.restPlan !== null && d.restPlan !== undefined) ? await strengthDays(access) : new Set<LocalDate>();
  return { today, reference, days, weighIns, trend: computeTrend(weighIns), tdee, prefs, profile, target: effective, targets: decisions, strengthDays: strength };
}

/** Dépense estimée à une autre date de fin (le check-in analyse la semaine qui précède son jour, pas la veille d'aujourd'hui). */
export function tdeeAt(snapshot: NutritionSnapshot, endDate: LocalDate): TdeeEstimate {
  const { profile, prefs } = snapshot;
  return estimateTdee({
    endDate,
    days: snapshot.days,
    weighIns: snapshot.weighIns,
    profile: profile === null ? null : { sex: profile.sex, birthYear: profile.birthYear, heightCm: profile.heightCm },
    activity: prefs.activity,
    previousSmoothed: null,
  });
}

export async function saveNutritionPrefs(access: DataAccess, prefs: NutritionPrefs): Promise<void> {
  await access.repos.settings.set('nutrition.prefs', prefs);
}

export { DEFAULT_NUTRITION_PREFS };

/** Entrée de journal pour `grams` d'un aliment du catalogue (méthode « search », provenance conservée) ; `null` si les grammes sont invalides. */
export function entryFromFood(food: SearchableFood, grams: number, at: { readonly date: LocalDate; readonly time: LocalTime }): MealEntryDraft | null {
  const totals = computeTotals(food.per100g, grams);
  if (totals === null) return null;
  return {
    date: at.date,
    time: at.time,
    foodId: food.ref,
    foodName: food.name.slice(0, 200),
    source: food.provenance,
    grams,
    kcal: totals.kcal,
    proteinG: totals.proteinG,
    fatG: totals.fatG,
    carbG: totals.carbG,
    method: 'search',
    confidence: null,
  };
}

export interface QuickAddInput {
  readonly date: LocalDate;
  readonly time: LocalTime;
  readonly name: string;
  readonly kcal: number;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
}

/** Quick Add : calories obligatoires, macros facultatives (vides = inconnues, jamais 0), pas de grammes. */
export function quickAddDraft(input: QuickAddInput): MealEntryDraft {
  const name = input.name.trim();
  return {
    date: input.date,
    time: input.time,
    foodId: null,
    foodName: name === '' ? tNutrition('addQuick') : name.slice(0, 200),
    source: 'manual',
    grams: null,
    kcal: input.kcal,
    proteinG: input.proteinG,
    fatG: input.fatG,
    carbG: input.carbG,
    method: 'quickadd',
    confidence: null,
  };
}

export type TargetWriteRefusal = 'confirmation-required' | 'rejected';

/** Cible fixée par Ali : ligne `manual` acceptée. Sous 1 200 kcal : confirmation explicite ; sous 800 kcal ou valeur invalide : refus. Rien n'est écrit en cas de refus. */
export async function saveManualTarget(
  access: DataAccess,
  input: { readonly weekStart: LocalDate; readonly target: Target; readonly lowFloorConfirmed: boolean; readonly restPlan?: RestPlan | null },
): Promise<NutritionTargetRecord | TargetWriteRefusal> {
  // PROG-01 (D-271) : la cible de repos accompagne la cible d'entraînement ; absente : une seule cible.
  const draft = { weekStart: input.weekStart, target: input.target, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: input.lowFloorConfirmed, restPlan: input.restPlan ?? null } as const;
  const issues = validateTargetRecord(draft);
  if (issues.includes('confirmation-required') && issues.length === 1) return 'confirmation-required';
  if (issues.length > 0) return 'rejected';
  return (await access.repos.nutritionTargets()).record(draft);
}

export interface RecordedDecision {
  readonly outcome: CheckInOutcome;
  /** Ligne écrite ; `null` si la décision a été refusée par les garde-fous (rien n'est écrit). */
  readonly record: NutritionTargetRecord | null;
}

/**
 * Applique la décision d'Ali sur la proposition du moteur. Accepter : la cible du moteur (source `auto`) ; personnaliser : les valeurs
 * d'Ali (source `manual`, conservées même hors règles, avec avertissements) ; refuser : la proposition est tracée non acceptée et la
 * cible en vigueur ne change pas (relançable). Plancher : sous 800 kcal rejeté, sous 1 200 kcal « confirmation requise » (accepter
 * une proposition sous 1 200 kcal comprise).
 */
export async function recordCheckInDecision(
  access: DataAccess,
  input: {
    readonly proposal: Proposal;
    readonly weekStart: LocalDate;
    readonly weightKg: number;
    readonly currentTarget: Target | null;
    readonly decision: CheckInDecision;
    readonly lowFloorConfirmed: boolean;
    /** PROG-01 : cible de repos en vigueur ; la nouvelle garde ses jours d'entraînement (D-272). */
    readonly restPlan?: RestPlan | null;
  },
): Promise<RecordedDecision> {
  const { proposal, weekStart, lowFloorConfirmed } = input;
  const plan = input.restPlan ?? null;
  // D-272 : accepter ou refuser la proposition trace sa cible de repos ; personnaliser garde l'écart d'avant (D-271).
  const proposedRest: RestPlan | null = plan === null ? null : { rest: proposal.restTarget ?? plan.rest, trainingDays: plan.trainingDays };
  const customRest = (target: Target): RestPlan | null =>
    plan === null || input.currentTarget === null ? null : { rest: restTargetFromGap(target, plan.rest.kcal - input.currentTarget.kcal), trainingDays: plan.trainingDays };
  const outcome = resolveCheckIn({ proposal, currentTarget: input.currentTarget, weightKg: input.weightKg, lowFloorConfirmed, decision: input.decision });
  const repo = await access.repos.nutritionTargets();
  const engineVersion = proposal.trace.engineVersion;

  if (outcome.action === 'accept') {
    if (proposal.belowStandardFloor && !lowFloorConfirmed) {
      return { outcome: { ...outcome, action: 'confirmation-required', target: null, source: null, retryable: true, warnings: ['below-floor'] }, record: null };
    }
    return { outcome, record: await repo.record({ weekStart, target: proposal.target, source: 'auto', accepted: true, engineVersion, lowFloorConfirmed, restPlan: proposedRest }) };
  }
  if (outcome.action === 'refuse') {
    return { outcome, record: await repo.record({ weekStart, target: proposal.target, source: 'auto', accepted: false, engineVersion, lowFloorConfirmed, restPlan: proposedRest }) };
  }
  if (outcome.action === 'customize' && outcome.target !== null) {
    return { outcome, record: await repo.record({ weekStart, target: outcome.target, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed, restPlan: customRest(outcome.target) }) };
  }
  return { outcome, record: null };
}

/** ERGO-02b (D-288) : nombre de jours de la routine du cycle de musculation en cours ; null sans cycle, routine illisible ou lecture impossible. */
export async function activeRoutineDayCount(access: DataAccess): Promise<number | null> {
  try {
    const cycle = await (await access.repos.mesocycles()).current();
    if (cycle === null) return null;
    const routine = await (await access.repos.trainingRoutines()).get(cycle.routineId);
    return routine === null ? null : routine.days.length;
  } catch {
    logFailure('nutrition', 'routine-days-read-failed');
    return null;
  }
}

/** `saved-partial` : enregistré, mais une cible future garde son réglage de repos (le plan demanderait une confirmation ou serait refusé par le plancher). */
export type RestPlanWriteResult = 'saved' | 'saved-partial' | TargetWriteRefusal;

/**
 * FIX-0244 (D-291) : enregistre (ou retire) la cible de repos de la cible en vigueur sans jamais passer devant une cible future. La cible en
 * vigueur est la dernière décision par HLC parmi celles dont la semaine a commencé : une décision d'aujourd'hui, plus récente, masquerait donc
 * une cible déjà prévue à une date future. La décision d'aujourd'hui et la recopie de chaque cible future qui était en vigueur à sa date
 * (mêmes valeurs, source, semaine, version du moteur) s'écrivent dans UNE transaction (`record([…])`) : tout ou rien. Une cible future au plan
 * propre garde son plan ; sans plan ou au plan hérité (même écart et mêmes jours, check-in compris), elle reçoit le nouveau plan, du même écart,
 * sauf s'il demanderait une confirmation (< 1 200 kcal) ou serait refusé (< 800) : elle garde alors son plan d'avant (`saved-partial`).
 * Une copie ne force jamais `lowFloorConfirmed` pour un nouveau plan.
 */
export async function saveRestPlan(
  access: DataAccess,
  input: { readonly today: LocalDate; readonly current: NutritionTargetRecord; readonly restPlan: RestPlan | null },
): Promise<RestPlanWriteResult> {
  const repo = await access.repos.nutritionTargets();
  // Cibles futures en vigueur à leur date, relevées avant l'écriture (la décision d'aujourd'hui les masquerait ensuite).
  const decisions = await repo.list();
  const futures = upcomingTargets(decisions, input.today);
  const plan = input.restPlan;
  const todayDraft: TargetRecordDraft = { weekStart: input.today, target: input.current.target, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false, restPlan: plan };
  const issues = validateTargetRecord(todayDraft);
  if (issues.includes('confirmation-required') && issues.length === 1) return 'confirmation-required';
  if (issues.length > 0) return 'rejected';
  const gap = plan === null ? 0 : plan.rest.kcal - input.current.target.kcal;
  // Plan hérité : absent, ou du même écart et des mêmes jours que celui d'aujourd'hui avant l'écriture ; sinon plan propre, gardé tel quel.
  const before = input.current.restPlan ?? null;
  const inherited = (future: NutritionTargetRecord): boolean => {
    const own = future.restPlan ?? null;
    if (own === null) return true;
    return before !== null && own.rest.kcal - future.target.kcal === before.rest.kcal - input.current.target.kcal && own.trainingDays.join() === before.trainingDays.join();
  };
  let partial = false;
  const copies: TargetRecordDraft[] = [];
  for (const future of futures) {
    // Décision déjà adoptée : sa recopie avec son plan d'avant n'est pas une nouvelle adoption.
    const keep: TargetRecordDraft = { weekStart: future.weekStart, target: future.target, source: future.source, accepted: true, engineVersion: future.engineVersion, lowFloorConfirmed: true, restPlan: future.restPlan ?? null };
    if (!inherited(future)) {
      copies.push(keep);
      continue;
    }
    const restPlan: RestPlan | null = plan === null ? null : { rest: restTargetFromGap(future.target, gap), trainingDays: plan.trainingDays };
    const next: TargetRecordDraft = { ...keep, lowFloorConfirmed: false, restPlan };
    if (validateTargetRecord(next).length === 0) copies.push(next);
    else {
      partial = true;
      copies.push(keep);
    }
  }
  await repo.record([todayDraft, ...copies]);
  return partial ? 'saved-partial' : 'saved';
}
