import type { Profile } from '../../domain/bodyProfile';
import { restTargetFromGap, type RestPlan } from '../../domain/nutrition/restDay';
import { addDays } from '../../domain/localDate';
import {
  aggregateDays,
  computeTotals,
  DEFAULT_NUTRITION_PREFS,
  estimateTdee,
  parseNutritionPrefs,
  resolveCheckIn,
  toMealEntryInput,
  validateTargetRecord,
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
  return { today, reference, days, weighIns, trend: computeTrend(weighIns), tdee, prefs, profile, target: effective, targets: decisions };
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
