import type { IsoDateTime } from '../types';
import type { GenerationConfig } from './config';
import type { EquipmentInventory, EquipmentProfileKind, Exercise, ExerciseKind, ExerciseMetric, ExercisePattern, RoutineDaySpec } from './types';

/**
 * Types de la génération de séance (PRD § 12.1, § 12.3 ; I3-01 ; D-73). Module pur. Entrée de `generateSession`, résultat présenté à Ali
 * sans aucune écriture : la routine source n'est jamais modifiée, la séance n'existe qu'après « Commencer cette séance ».
 *
 * Interface pour I3-02 (mésocycle) : `week` (séries de travail et RIR de la semaine du cycle) et `mesocycleIndex` (rotation Varied).
 * I3-01 ne calcule ni l'un ni l'autre ; absents (`null`), les valeurs de la routine s'appliquent.
 */

export const PROGRAM_MODES = ['guide', 'libre', 'maison', 'importe'] as const;
/** Variantes de Libre nommées au § 12.3 ; sans effet distinct tant qu'Ali ne les a pas définies (D-73 point 1). */
export const LIBRE_VARIANTS = ['variable', 'fixe', 'statique'] as const;
export const SPLIT_KINDS = ['full-body', 'upper-lower', 'ppl', 'custom'] as const;
/** Jour d'un split : groupes musculaires du jour (`config.splitGroups`), `custom` = groupes affectés par Ali. */
export const SPLIT_DAY_KINDS = ['full-body', 'upper', 'lower', 'push', 'pull', 'legs', 'custom'] as const;
export const VARIETY_LEVELS = ['consistent', 'balanced', 'varied'] as const;
export const SET_STYLES = ['straight', 'pyramid', 'reverse'] as const;

export type ProgramMode = (typeof PROGRAM_MODES)[number];
export type LibreVariant = (typeof LIBRE_VARIANTS)[number];
export type SplitKind = (typeof SPLIT_KINDS)[number];
export type SplitDayKind = (typeof SPLIT_DAY_KINDS)[number];
export type VarietyLevel = (typeof VARIETY_LEVELS)[number];
export type SetStyle = (typeof SET_STYLES)[number];

/** Paramètres du programme pour la génération (éphémères en I3-01 : choisis à l'écran, jamais enregistrés). */
export interface GenerationProgram {
  readonly mode: ProgramMode;
  readonly libreVariant: LibreVariant | null;
  readonly split: SplitKind;
  /** Custom : groupes affectés par Ali (`chest`, `back`…), un tableau par jour de la routine, dans l'ordre des jours. Ignoré sinon. */
  readonly customDays: readonly (readonly string[])[];
  readonly variety: VarietyLevel;
  readonly style: SetStyle;
  /** Groupes prioritaires : placés en tête (à type égal), retirés en dernier par le budget. */
  readonly priorities: readonly string[];
  /** Patterns douloureux : aucun exercice de ce pattern n'est proposé. */
  readonly painfulPatterns: readonly ExercisePattern[];
  /** Jours de la routine source (lecture seule), dans n'importe quel ordre : triés par `dayOrder`. */
  readonly days: readonly RoutineDaySpec[];
  /** Instant d'origine des rotations (création de la routine). */
  readonly startedAt: IsoDateTime;
}

/** Bibliothèque vue par le générateur : exercices proposables et groupe d'affichage d'un muscle (exercice personnalisé). */
export interface GenerationLibrary {
  readonly exercises: readonly Exercise[];
  /** Muscle → groupe (`chest`, `back`…) ; un exercice embarqué porte son groupe du JSON. */
  readonly groupOfMuscle: ReadonlyMap<string, string>;
}

/** Profil de matériel actif (embarqué ou personnel). */
export interface GenerationEquipment {
  readonly kind: EquipmentProfileKind;
  readonly inventory: EquipmentInventory;
}

/** Semaine du mésocycle (I3-02) : séries de travail par exercice et RIR cible ; `null` = valeurs de la routine. */
export interface GenerationWeek {
  readonly workingSets: number | null;
  readonly rir: number | null;
  /**
   * I3-02 (`generationWeekOf`) : écart à la ligne de la routine quand `workingSets` est nul ; deload (volume de la routine, réduit par la
   * proposition de chaque exercice, D-72 point 9) ; séries de priorité ajoutées au premier exercice de chaque groupe prioritaire.
   */
  readonly setsOffset?: number;
  readonly deload?: boolean;
  readonly priorityBonus?: number;
  /** PROG-01 : RIR des exercices d'isolation (dernière semaine de travail, à partir du 2e cycle) ; semaine de reprise ; décharge à 90 %. */
  readonly isolationRir?: number;
  readonly rampUp?: boolean;
  readonly deloadSets?: number;
  readonly deloadLoad?: number;
}

export interface GenerateSessionInput {
  /** Index du jour (0 = premier jour de la routine par `dayOrder`). */
  readonly day: number;
  readonly program: GenerationProgram;
  readonly library: GenerationLibrary;
  readonly equipment: GenerationEquipment;
  /** Profil de l'utilisateur et récupération : réservés (Strength Score I3, Recovery Split I5), sans effet en I3-01. */
  readonly profile: null;
  readonly recovery: null;
  /** Minutes disponibles (« J'ai 35 min ») ; `null` : aucun budget. */
  readonly timeBudgetMin: number | null;
  readonly week: GenerationWeek | null;
  /** Index du mésocycle (I3-02) ; `null` : semaines écoulées ÷ `mesoWeeks`. */
  readonly mesocycleIndex: number | null;
  readonly config: GenerationConfig;
  /** Horloge injectée : seule source du temps. */
  readonly now: IsoDateTime;
}

export type GenerationIssueCode =
  | 'imported-unavailable'
  | 'day-out-of-range'
  | 'split-days'
  | 'custom-day-groups'
  | 'home-profile-required'
  | 'budget-invalid';

export type OmissionReason = 'unknown-exercise' | 'equipment' | 'pain' | 'time-budget';

export type GenerationWarning = 'duplicate-in-routine' | 'off-split-in-routine' | 'over-budget' | 'under-budget';

export type GeneratedOrigin = 'routine' | 'substitution' | 'rotation';

export interface GeneratedExercise {
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** Exercice de la ligne de routine dont cet emplacement est issu. */
  readonly sourceExerciseId: string;
  readonly sourcePosition: number;
  readonly origin: GeneratedOrigin;
  /** Substitution : motif de l'exercice remplacé. */
  readonly substitutionReason: 'equipment' | 'pain' | null;
  readonly kind: ExerciseKind;
  readonly metric: ExerciseMetric;
  readonly pattern: ExercisePattern;
  readonly primaryMuscle: string | null;
  readonly group: string | null;
  readonly sets: number;
  /** Séries retirées par le budget temps. */
  readonly setsRemoved: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly rir: number | null;
  readonly restSec: number;
  readonly estimatedSec: number;
  readonly warnings: readonly ('duplicate-in-routine' | 'off-split-in-routine')[];
}

export interface OmittedExercise {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly sourcePosition: number;
  readonly reason: OmissionReason;
  /** Libre : remplaçant compatible possible, jamais appliqué ; `null` sinon. */
  readonly suggestionId: string | null;
}

export interface GeneratedSession {
  readonly status: 'ready' | 'invalid' | 'unavailable';
  readonly issues: readonly GenerationIssueCode[];
  readonly mode: ProgramMode;
  readonly dayIndex: number;
  readonly dayName: string;
  readonly dayKind: SplitDayKind | null;
  /** Groupes musculaires du jour (split) ; vide en Libre. */
  readonly groups: readonly string[];
  /** Groupes du jour sans aucun exercice dans la séance (information, jamais comblés). */
  readonly uncoveredGroups: readonly string[];
  readonly exercises: readonly GeneratedExercise[];
  readonly omitted: readonly OmittedExercise[];
  readonly warnings: readonly GenerationWarning[];
  readonly style: SetStyle;
  readonly variety: VarietyLevel;
  /** Période de rotation appliquée (0 = exercices de la routine). */
  readonly rotationPeriod: number;
  readonly estimatedSec: number;
  readonly budgetSec: number | null;
  /** Semaine de deload du cycle (I3-02) : la proposition de chaque exercice applique le deload. */
  readonly deload: boolean;
  readonly generationVersion: number;
}
