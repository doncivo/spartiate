import { parseDecimal, type BodyGoal } from '../../domain/bodyProfile';
import type { IdGenerator } from '../../domain/id';
import {
  ONBOARDING_STEPS,
  RATE_GOALS,
  emptyDraft,
  parseDraft,
  proposeSplit,
  validateStep,
  weeklyRateKg,
  type OnboardingDraft,
  type OnboardingGoal,
} from '../../domain/onboarding';
import { parseNutritionPrefs } from '../../domain/nutrition/prefs';
import type { Goal } from '../../domain/nutrition/checkIn';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { programToRoutine, type TrainingContent } from '../training/content';

/**
 * Données de l'onboarding (I3-07, D-110) : lecture de l'état de la base, brouillon (réglage local `onboarding.draft`), préremplissage et
 * écriture finale en UNE transaction (échec : rien n'est écrit). Aucune migration : le profil existant (`profile`, `body_weight`), les
 * préférences de nutrition et le profil de matériel actif reçoivent ce qui a une place ; le reste vit dans le brouillon.
 */

export { SKIP_ONBOARDING_KEY, markCompleted, onboardingDisabledForDev, readBaseCounts } from './launch';

export async function loadDraft(data: DataAccess): Promise<OnboardingDraft> {
  return parseDraft(await data.repos.settings.get('onboarding.draft'));
}

export async function saveDraft(data: DataAccess, draft: OnboardingDraft): Promise<void> {
  await data.repos.settings.set('onboarding.draft', draft);
}

const GOAL_FROM_PROFILE: Readonly<Record<BodyGoal, OnboardingGoal>> = { gain: 'muscle', loss: 'fat-loss', maintain: 'maintenance' };
const PROFILE_GOAL: Readonly<Record<OnboardingGoal, BodyGoal>> = { muscle: 'gain', strength: 'maintain', recomposition: 'maintain', 'fat-loss': 'loss', maintenance: 'maintain' };

/** Ce qui est déjà enregistré (profil, dernière pesée, activité déclarée) : « Revoir mes réglages » ne repart pas de zéro. Rien d'inventé sur une base vide. */
export async function readPrefill(data: DataAccess): Promise<Partial<OnboardingDraft>> {
  const { repos } = data;
  const [profile, weights, prefs] = await Promise.all([repos.profile().then((r) => r.get()), repos.bodyWeights().then((r) => r.listRecent(1)), repos.settings.get('nutrition.prefs')]);
  const fill: { -readonly [K in keyof OnboardingDraft]?: OnboardingDraft[K] } = {};
  if (profile?.sex) fill.sex = profile.sex;
  if (profile?.birthYear != null) fill.birthYear = profile.birthYear;
  if (profile?.heightCm != null) fill.heightCm = profile.heightCm;
  if (profile?.goal) fill.goal = GOAL_FROM_PROFILE[profile.goal];
  if (profile?.experience) fill.experience = profile.experience;
  const weight = weights[0];
  if (weight) fill.weightKg = weight.kg;
  const activity = parseNutritionPrefs(prefs).activity;
  if (activity !== null) fill.activity = activity;
  return fill;
}

/** Le brouillon enregistré garde la priorité ; le préremplissage ne comble que les champs encore vides. */
export function mergePrefill(draft: OnboardingDraft, prefill: Partial<OnboardingDraft>): OnboardingDraft {
  const merged: { -readonly [K in keyof OnboardingDraft]: OnboardingDraft[K] } = { ...draft };
  const base = emptyDraft();
  for (const key of Object.keys(prefill) as (keyof OnboardingDraft)[]) {
    if (draft[key] === base[key] && prefill[key] !== undefined) (merged as Record<string, unknown>)[key] = prefill[key];
  }
  return merged;
}

export interface FinishDeps {
  readonly data: DataAccess;
  readonly ids: IdGenerator;
  readonly today: LocalDate;
  readonly timeZone: string;
  /** Année courante (borne de l'année de naissance). */
  readonly year: number;
}

export interface FinishResult {
  /** Routine proposée ajoutée (nouvelle) ou déjà présente sous le même nom ; `null` : aucune. */
  readonly routineId: string | null;
  readonly routineCreated: boolean;
}

function nutritionGoal(draft: OnboardingDraft): Goal | null {
  if (draft.goal === null) return null;
  const pct = draft.weeklyRatePct;
  if (RATE_GOALS.includes(draft.goal) && pct !== null && pct !== 0) {
    const kg = weeklyRateKg(draft.weightKg, pct);
    if (kg !== null && kg !== 0) return { kind: kg > 0 ? 'gain' : 'loss', weeklyRateKg: Math.abs(kg) };
  }
  return { kind: 'maintain' };
}

/**
 * Fin de l'onboarding (« Commencer ») : profil (champs renseignés seulement, jamais une ligne vide), pesée du jour, préférences de nutrition
 * (activité déclarée et objectif), profil de matériel actif, puis la routine proposée comme NOUVELLE routine (jamais en remplacement : une
 * routine de même nom n'est ni dupliquée ni modifiée), enfin « terminé ». Toute valeur invalide fait tout échouer.
 */
export async function finishOnboarding(deps: FinishDeps, draft: OnboardingDraft, content: TrainingContent | null): Promise<FinishResult> {
  for (const step of ONBOARDING_STEPS) {
    if (validateStep(step, draft, deps.year).length > 0) throw new Error(`onboarding : valeur invalide à l'étape ${step}`);
  }
  return deps.data.transaction(async (repos) => {
    const profileInput = {
      ...(draft.sex !== null ? { sex: draft.sex } : {}),
      ...(draft.birthYear !== null ? { birthYear: draft.birthYear } : {}),
      ...(draft.heightCm !== null ? { heightCm: draft.heightCm } : {}),
      ...(draft.goal !== null ? { goal: PROFILE_GOAL[draft.goal] } : {}),
      ...(draft.experience !== null ? { experience: draft.experience } : {}),
    };
    if (Object.keys(profileInput).length > 0) await (await repos.profile()).save({ ...profileInput, units: 'metric' }, deps.year);
    if (draft.weightKg !== null) await (await repos.bodyWeights()).saveManual({ date: deps.today, kg: draft.weightKg, timezone: deps.timeZone }, deps.today);

    const goal = nutritionGoal(draft);
    if (goal !== null || draft.activity !== null) {
      const prefs = parseNutritionPrefs(await repos.settings.get('nutrition.prefs'));
      await repos.settings.set('nutrition.prefs', { ...prefs, activity: draft.activity ?? prefs.activity, goal: goal ?? prefs.goal });
    }
    if (draft.equipmentProfileId !== null) await repos.settings.set('training.activeEquipmentProfile', draft.equipmentProfileId);

    let routineId: string | null = null;
    let routineCreated = false;
    if (content !== null && draft.acceptProposal && !draft.skipped.includes('split')) {
      const kind = content.profiles.find((p) => p.id === draft.equipmentProfileId)?.kind ?? null;
      const proposal = proposeSplit({ sessionsPerWeek: draft.sessionsPerWeek, equipmentKind: kind });
      const program = content.programs.find((p) => p.id === proposal.programId);
      if (program) {
        const routines = await repos.trainingRoutines();
        const existing = (await routines.list()).find((r) => r.name === program.name);
        if (existing) routineId = existing.id;
        else {
          const routine = programToRoutine(program, content.catalog, deps.ids);
          await routines.create(routine);
          routineId = routine.id;
          routineCreated = true;
        }
      }
    }
    await repos.settings.set('onboarding.completed', true);
    return { routineId, routineCreated };
  });
}

/** Saisie décimale d'un champ du formulaire (virgule ou point) ; vide ou illisible : `null`. */
export const parseField = (text: string): number | null => (text.trim() === '' ? null : parseDecimal(text));
