import { parseDecimal } from '../../domain/bodyProfile';
import type { IdGenerator } from '../../domain/id';
import {
  GOAL_FROM_PROFILE,
  ONBOARDING_STEPS,
  PROFILE_GOAL,
  answersOf,
  emptyDraft,
  nutritionGoalOf,
  onboardingChanges,
  parseDraft,
  planChanged,
  reviewStart,
  validateStep,
  type ChangeField,
  type CurrentSettings,
  type OnboardingChange,
  type OnboardingDraft,
} from '../../domain/onboarding';
import { parseNutritionPrefs } from '../../domain/nutrition/prefs';
import type { LocalDate } from '../../domain/types';
import type { DataAccess, Repositories } from '../../db/repositories/dataAccess';
import { programToRoutine, type TrainingContent } from '../training/content';
import { proposalFor } from './firstSession';

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

/** Données actuelles hors brouillon (profil, dernière pesée, préférences de nutrition, matériel actif), lues par les dépôts reçus. */
async function readCurrent(repos: Repositories): Promise<CurrentSettings> {
  const [profile, weights, prefsRaw, equipment] = await Promise.all([
    repos.profile().then((r) => r.get()),
    repos.bodyWeights().then((r) => r.listRecent(1)),
    repos.settings.get('nutrition.prefs'),
    repos.settings.get('training.activeEquipmentProfile'),
  ]);
  const prefs = parseNutritionPrefs(prefsRaw);
  return {
    sex: profile?.sex ?? null,
    birthYear: profile?.birthYear ?? null,
    heightCm: profile?.heightCm ?? null,
    goal: profile?.goal ?? null,
    experience: profile?.experience ?? null,
    weightKg: weights[0]?.kg ?? null,
    activity: prefs.activity,
    equipmentProfileId: typeof equipment === 'string' && equipment !== '' ? equipment : null,
    // Cible jamais enregistrée (réglage absent : défaut « maintien » de la lecture) : rien à remplacer.
    nutritionGoal: typeof prefsRaw === 'object' && prefsRaw !== null && (prefsRaw as Record<string, unknown>)['goal'] != null ? prefs.goal : null,
  };
}

/** Ce qui est déjà enregistré (profil, dernière pesée, activité déclarée) : « Revoir mes réglages » ne repart pas de zéro. Rien d'inventé sur une base vide. */
export async function readPrefill(data: DataAccess): Promise<Partial<OnboardingDraft>> {
  const current = await readCurrent(data.repos);
  const fill: { -readonly [K in keyof OnboardingDraft]?: OnboardingDraft[K] } = {};
  if (current.sex) fill.sex = current.sex;
  if (current.birthYear !== null) fill.birthYear = current.birthYear;
  if (current.heightCm !== null) fill.heightCm = current.heightCm;
  if (current.goal) fill.goal = GOAL_FROM_PROFILE[current.goal];
  if (current.experience) fill.experience = current.experience;
  if (current.weightKg !== null) fill.weightKg = current.weightKg;
  if (current.activity !== null) fill.activity = current.activity;
  return fill;
}

export interface OnboardingStart {
  readonly draft: OnboardingDraft;
  /** Point de départ d'une revue (assistant terminé) : sert à ne réécrire que ce qui change ; `null` : premier lancement ou brouillon inachevé. */
  readonly baseline: OnboardingDraft | null;
  /** Vrai pour un brouillon inachevé (enregistré à chaque changement) ; faux pendant la revue d'un assistant terminé (rien d'écrit avant la fin). */
  readonly persist: boolean;
  /** Dernière pesée enregistrée (indice de l'écran « Toi »). */
  readonly prefillWeightKg: number | null;
}

/**
 * FIX-0171 (constat 6, D-124) : d'où part l'assistant. Jamais terminé : le brouillon inachevé est repris à son écran, le préremplissage ne comble que
 * ses champs vides. Terminé (« Revoir mes réglages ») : données ACTUELLES d'abord, réponses gardées pour le reste ; un ancien brouillon resté
 * après la fin (versions 0.15.0 à 0.17.0) ne sert qu'à ces réponses, jamais à remplacer le profil ni la dernière pesée.
 */
export async function loadStart(data: DataAccess): Promise<OnboardingStart> {
  const { settings } = data.repos;
  const [completed, rawDraft, rawAnswers, current] = await Promise.all([settings.get('onboarding.completed'), settings.get('onboarding.draft'), settings.get('onboarding.answers'), readCurrent(data.repos)]);
  const saved = rawDraft === null || rawDraft === undefined ? null : parseDraft(rawDraft);
  // `onboarding.completed` vaut aussi pour un assistant FERMÉ sans être terminé (il ne revient pas tout seul) : c'est la présence des réponses qui
  // dit « terminé ». Ancien format : la fin rouvrait le brouillon au premier écran ; un brouillon au premier écran d'un assistant marqué terminé est
  // donc lu comme les réponses d'un assistant terminé.
  const finished = rawAnswers !== null && rawAnswers !== undefined ? parseDraft(rawAnswers) : completed === true && saved !== null && saved.step === 'you' ? saved : null;
  if (finished === null) {
    const prefill = await readPrefill(data);
    return { draft: mergePrefill(saved ?? parseDraft(null), prefill), baseline: null, persist: true, prefillWeightKg: current.weightKg };
  }
  const start = reviewStart(finished, current);
  return { draft: start, baseline: start, persist: false, prefillWeightKg: current.weightKg };
}

/** Ce que la fin écrirait face aux données actuelles (aperçu des remplacements à confirmer) ; aucune écriture. */
export async function previewChanges(data: DataAccess, draft: OnboardingDraft, baseline: OnboardingDraft | null): Promise<readonly OnboardingChange[]> {
  return onboardingChanges(draft, await readCurrent(data.repos), baseline);
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

export interface FinishOptions {
  /** Point de départ de la revue (`loadStart`) : seuls les changements depuis ce point comptent pour la cible de nutrition et la routine proposée. */
  readonly baseline?: OnboardingDraft | null;
  /** Remplacements refusés à la confirmation : ces champs ne sont pas écrits. */
  readonly refused?: readonly ChangeField[];
}

/**
 * Fin de l'onboarding (« Commencer ») : seuls les champs RÉELLEMENT modifiés face aux données actuelles s'écrivent (FIX-0171, D-124) — profil (jamais
 * une ligne vide), pesée du jour, préférences de nutrition (activité déclarée et objectif), profil de matériel actif —, sauf les remplacements refusés ;
 * puis la routine proposée comme NOUVELLE routine (jamais en remplacement : une routine de même nom n'est ni dupliquée ni modifiée), enfin
 * « terminé », les réponses sans autre place gardées à part et le brouillon effacé. Rien de changé : aucune écriture. Toute valeur invalide fait tout
 * échouer.
 */
export async function finishOnboarding(deps: FinishDeps, draft: OnboardingDraft, content: TrainingContent | null, options: FinishOptions = {}): Promise<FinishResult> {
  for (const step of ONBOARDING_STEPS) {
    if (validateStep(step, draft, deps.year).length > 0) throw new Error(`onboarding : valeur invalide à l'étape ${step}`);
  }
  const baseline = options.baseline ?? null;
  const refused = new Set(options.refused ?? []);
  return deps.data.transaction(async (repos) => {
    const current = await readCurrent(repos);
    const changes = onboardingChanges(draft, current, baseline).filter((c) => !(c.replaces && refused.has(c.field)));
    const changed = (field: ChangeField): boolean => changes.some((c) => c.field === field);
    const profileInput = {
      ...(changed('sex') && draft.sex !== null ? { sex: draft.sex } : {}),
      ...(changed('birthYear') && draft.birthYear !== null ? { birthYear: draft.birthYear } : {}),
      ...(changed('heightCm') && draft.heightCm !== null ? { heightCm: draft.heightCm } : {}),
      ...(changed('goal') && draft.goal !== null ? { goal: PROFILE_GOAL[draft.goal] } : {}),
      ...(changed('experience') && draft.experience !== null ? { experience: draft.experience } : {}),
    };
    if (Object.keys(profileInput).length > 0) {
      const profiles = await repos.profile();
      // Unités posées à la création du profil seulement : une revue ne touche pas un champ qu'elle n'affiche pas.
      const exists = (await profiles.get()) !== null;
      await profiles.save(exists ? profileInput : { ...profileInput, units: 'metric' }, deps.year);
    }
    // Pesée du jour seulement si le poids a été saisi ou modifié : aucune pesée inventée ni ressuscitée (« Revoir mes réglages »).
    if (changed('weightKg') && draft.weightKg !== null) await (await repos.bodyWeights()).saveManual({ date: deps.today, kg: draft.weightKg, timezone: deps.timeZone }, deps.today);

    const goal = nutritionGoalOf(draft);
    if (changed('nutritionGoal') || changed('activity')) {
      const prefs = parseNutritionPrefs(await repos.settings.get('nutrition.prefs'));
      await repos.settings.set('nutrition.prefs', { ...prefs, activity: changed('activity') ? draft.activity : prefs.activity, goal: changed('nutritionGoal') ? goal : prefs.goal });
    }
    if (changed('equipmentProfileId') && draft.equipmentProfileId !== null) await repos.settings.set('training.activeEquipmentProfile', draft.equipmentProfileId);

    let routineId: string | null = null;
    let routineCreated = false;
    if (content !== null && draft.acceptProposal && !draft.skipped.includes('split') && planChanged(draft, baseline)) {
      const { program } = proposalFor(draft, content);
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
    if ((await repos.settings.get('onboarding.completed')) !== true) await repos.settings.set('onboarding.completed', true);
    // FIX-0171 : l'assistant terminé n'a plus de brouillon ; les réponses sans autre place sont gardées à part (préremplissent la revue).
    const answers = answersOf(draft);
    const stored = await repos.settings.get('onboarding.answers');
    if (stored === null || stored === undefined || JSON.stringify(parseDraft(stored)) !== JSON.stringify(answers)) await repos.settings.set('onboarding.answers', answers);
    if ((await repos.settings.get('onboarding.draft')) !== null) await repos.settings.set('onboarding.draft', null);
    return { routineId, routineCreated };
  });
}

/** Saisie décimale d'un champ du formulaire (virgule ou point) ; vide ou illisible : `null`. */
export const parseField = (text: string): number | null => (text.trim() === '' ? null : parseDecimal(text));
