import type { DeviceId, Hlc, IsoDateTime } from '../types';
import type { ProgressionConfig } from './config';
import type { SetKind } from './session';

/**
 * Types de la bibliothèque d'exercices, des profils de matériel et des routines (PRD § 14, § 20.2 ; D-71, P-09). Module pur.
 *
 * Un exercice est référencé par un identifiant opaque (`string`) : kebab-case du JSON embarqué, ou UUID d'un exercice personnalisé. Aucune
 * ligne n'existe pour un exercice embarqué ; une référence peut donc être non résolue (`resolveExercise`).
 */

export const EXERCISE_PATTERNS = ['push-horizontal', 'push-vertical', 'pull-horizontal', 'pull-vertical', 'hinge', 'squat', 'lunge', 'carry', 'core', 'isolation'] as const;
export const EXERCISE_KINDS = ['compound', 'isolation'] as const;
export const EXERCISE_METRICS = ['load-reps', 'bodyweight-reps', 'time', 'distance'] as const;
export const EQUIPMENT_PROFILE_KINDS = ['salle', 'maison', 'voyage'] as const;
export const ROUTINE_MODES = ['libre', 'programme'] as const;

export type ExercisePattern = (typeof EXERCISE_PATTERNS)[number];
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];
export type ExerciseMetric = (typeof EXERCISE_METRICS)[number];
export type EquipmentProfileKind = (typeof EQUIPMENT_PROFILE_KINDS)[number];
export type RoutineMode = (typeof ROUTINE_MODES)[number];

export interface MuscleWeight {
  /** Identifiant du catalogue fermé des muscles (kebab-case). */
  readonly id: string;
  /** Contribution, 0 < poids ≤ 1. */
  readonly weight: number;
}

export interface ExerciseInstructions {
  readonly setup: string;
  readonly execution: string;
  readonly mistakes: readonly string[];
}

export interface ExerciseMedia {
  readonly images: readonly string[];
  readonly video: string | null;
  readonly license: string;
  readonly source: string;
}

/** Champs communs d'un exercice (§ 14.1), embarqué ou personnalisé. */
export interface ExerciseBase {
  readonly id: string;
  readonly nameFr: string;
  readonly aliasesEn: readonly string[];
  readonly muscles: readonly MuscleWeight[];
  /** Identifiants du catalogue fermé du matériel (kebab-case). */
  readonly equipment: readonly string[];
  readonly pattern: ExercisePattern;
  readonly kind: ExerciseKind;
  readonly metric: ExerciseMetric;
  readonly bodyweightFraction: number | null;
  /** [min, max] de répétitions (secondes pour la métrique `time`). */
  readonly defaultRepRange: readonly [number, number];
  readonly defaultRestSec: number;
  readonly instructions: ExerciseInstructions;
  readonly media: ExerciseMedia | null;
  readonly strengthStandardKey: string | null;
  readonly schemaVersion: number;
}

/** Exercice de la bibliothèque embarquée (JSON, non stocké, non publié). */
export interface EmbeddedExercise extends ExerciseBase {
  readonly origin: 'embedded';
  /** Groupe d'affichage du JSON (`chest`, `back`…) ; facultatif pour les jeux de test. */
  readonly group?: string;
  /**
   * Groupes d'alternatives du JSON (content/README.md) : compatible si, pour chaque groupe, au moins un matériel est utilisable. Le matériel
   * facultatif (« lest éventuel ») figure dans `equipment` mais dans aucun groupe. Absent : tout `equipment` est requis.
   */
  readonly equipmentGroups?: readonly (readonly string[])[];
  /** Identifiants d'exercices de remplacement (références logiques, P-09). */
  readonly alternatives?: readonly string[];
}

/** Exercice personnalisé : ligne `exercise` (`is_custom = 1`), publiée. */
export interface CustomExercise extends ExerciseBase {
  readonly origin: 'custom';
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export type Exercise = EmbeddedExercise | CustomExercise;

/** Saisie d'un exercice personnalisé : l'identifiant (UUID) arrive de l'appelant, jamais fabriqué par le repository. */
export type CustomExerciseInput = Omit<ExerciseBase, 'schemaVersion'>;

// -----------------------------------------------------------------------------------------------------------------------------------
// Matériel (§ 14.3)
// -----------------------------------------------------------------------------------------------------------------------------------

export interface BarbellSpec {
  readonly type: string;
  readonly weightKg: number;
  /** Matériel du catalogue fermé que cette barre réalise (`barbell`, `ez-bar`, `trap-bar`…) ; absent : barre non reliée, aucune grille de charges (I2-01). */
  readonly equipmentId?: string;
}
export interface PlateSpec {
  readonly weightKg: number;
  /** Nombre de disques de cette masse par côté. */
  readonly count: number;
}
export interface StackRange {
  readonly minKg: number;
  readonly maxKg: number;
  readonly stepKg: number;
  /** Charges isolées en plus de la plage (paire d'haltères de 9 kg à Antony) ; absent dans les profils antérieurs. */
  readonly extraKg?: readonly number[];
}
export interface MachineSpec {
  readonly equipmentId: string;
  readonly stackMinKg: number;
  readonly stackMaxKg: number;
  readonly stepKg: number;
}

/** Colonne `inventory` d'un profil. Un champ absent d'une version plus ancienne se lit comme vide. */
export interface EquipmentInventory {
  /** Identifiants du catalogue fermé du matériel présents dans ce profil. */
  readonly available: readonly string[];
  /** Matériel à privilégier (considéré présent). */
  readonly forced: readonly string[];
  /** Matériel exclu, même s'il figure dans `available`. */
  readonly forbidden: readonly string[];
  /** Poids du corps utilisable (identifiant `bodyweight`). */
  readonly bodyweight: boolean;
  readonly barbells: readonly BarbellSpec[];
  readonly platesPerSideKg: readonly PlateSpec[];
  readonly dumbbells: StackRange | null;
  readonly kettlebellsKg: readonly number[];
  readonly machines: readonly MachineSpec[];
  readonly cables: readonly StackRange[];
  /**
   * Valeurs « à vérifier en salle » (profil embarqué dupliqué) : clés `dumbbells`, `kettlebells`, `machines`, `cables`, `plates` ou
   * `barbell:<type>`. Absent : rien à vérifier.
   */
  readonly toVerify?: readonly string[];
}

/** Colonne `increments` : pas de charge en kg par type (`barbell`, `dumbbell`, `kettlebell`, `machine`, `cable`…). */
export type EquipmentIncrements = Readonly<Record<string, number>>;

export interface EquipmentProfileInput {
  readonly id: string;
  readonly name: string;
  readonly kind: EquipmentProfileKind;
  readonly inventory: EquipmentInventory;
  readonly increments: EquipmentIncrements;
}

export interface EquipmentProfile extends EquipmentProfileInput {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Routines (§ 14, § 12.5)
// -----------------------------------------------------------------------------------------------------------------------------------

/** Ligne de routine : `exerciseId` est une référence logique (P-09), `exerciseName` le nom figé à l'ajout (D-71). */
export interface RoutineExerciseSpec {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly sets: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly rir: number | null;
  readonly restSec: number;
  readonly position: number;
  /**
   * I6-03b (migration 0014) : groupe (superset, triset, circuit) de la ligne dans son jour ; absent ou null : ligne libre. Les routines générées et les
   * programmes de départ n'en portent jamais (saisie dans l'éditeur seulement).
   */
  readonly circuitId?: string | null;
  /** I6-03b : repos entre deux exercices du groupe (secondes, 0 = aucun) ; null hors groupe. Le repos de fin de tour est `restSec`. */
  readonly circuitRestSec?: number | null;
}

export interface RoutineDaySpec {
  readonly name: string;
  readonly dayOrder: number;
  readonly exercises: readonly RoutineExerciseSpec[];
}

/** Routine sans identifiants : valide indépendamment du stockage (`validateRoutine`). */
export interface RoutineSpec {
  readonly name: string;
  readonly mode: RoutineMode;
  readonly days: readonly RoutineDaySpec[];
}

type WithId<T> = T & { readonly id: string };
export type RoutineExerciseInput = WithId<RoutineExerciseSpec>;
export type RoutineDayInput = WithId<Omit<RoutineDaySpec, 'exercises'>> & { readonly exercises: readonly RoutineExerciseInput[] };
export type RoutineInput = WithId<Omit<RoutineSpec, 'days'>> & { readonly days: readonly RoutineDayInput[] };

interface RowMeta {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface RoutineExercise extends RoutineExerciseInput, RowMeta {
  readonly routineDayId: string;
}
export interface RoutineDay extends Omit<RoutineDayInput, 'exercises'>, RowMeta {
  readonly routineId: string;
  readonly exercises: readonly RoutineExercise[];
}
/** En-tête d'une routine (sans ses jours). */
export interface Routine extends RowMeta {
  readonly id: string;
  readonly name: string;
  readonly mode: RoutineMode;
}
export interface RoutineTree extends Routine {
  readonly days: readonly RoutineDay[];
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Moteur de prescription (§ 11, I2-01 ; D-72). Contrats purs, versionnés par `ENGINE_VERSION` (config.ts).
// -----------------------------------------------------------------------------------------------------------------------------------

/** Ressenti de fin d'exercice (§ 13.2 : Facile / Juste / Dur, ignorable) ; colonne `workout_set.difficulty` (migration 0006). */
export const DIFFICULTIES = ['easy', 'ok', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Série d'historique vue par le moteur : sous-ensemble d'une `WorkoutSet` d'une séance close. */
export interface HistorySet {
  readonly position: number;
  readonly setKind: SetKind;
  readonly done: boolean;
  readonly reps: number | null;
  readonly loadKg: number | null;
  readonly rir: number | null;
  /** Charge aberrante confirmée par Ali (§ 11.5) ; absent : non confirmée. */
  readonly confirmed?: boolean;
}

/** Séance close, réduite aux séries d'UN exercice. */
export interface ExerciseSession {
  readonly workoutId: string;
  readonly endedAt: IsoDateTime;
  /** Null : non saisie (ignorable) ; lue sur les séries de l'exercice dans la séance (`workout_set.difficulty`). */
  readonly difficulty: Difficulty | null;
  readonly sets: readonly HistorySet[];
  /**
   * Séance de deload (I2-02, D-72 point 9) : visible dans l'historique, exclue des statistiques (estimation, confiance, fatigue,
   * stagnation) ; elle compte comme travail du muscle (inactivité). Absent : séance ordinaire.
   */
  readonly deload?: boolean;
  /**
   * I4-08 : la décision tracée de la séance a retenu un choix de fatigue (« −5 % » ou « −2 reps ») : la baisse était voulue. La séance reste
   * dans les statistiques, mais n'entre jamais dans la comparaison de fatigue (ni comme dernière séance, ni comme base). Absent : non.
   */
  readonly fatigueChoice?: boolean;
  /**
   * I4-08 : RIR cible présenté pour cet exercice dans la séance (semaine du cycle d'une séance proposée), lu dans la prescription tracée de la
   * dernière décision ; absent : aucun. Information : le moteur ne le prend jamais pour un RIR réalisé.
   */
  readonly targetRir?: number;
}

/** Cible de la routine ou de la séance : nombre de séries, plage de répétitions, RIR. */
export interface RepTarget {
  readonly sets: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly rir: number | null;
}

/** État recalculable par exercice (table `progression_profile`). */
export interface ProgressionProfileState {
  readonly estimated1rmKg: number | null;
  readonly confidence: number | null;
  readonly lastEasyRecalibrationAt: IsoDateTime | null;
}

/** Dernière décision d'Ali sur une prescription (table `recommendation_decision`) : valeur effective, acceptée telle quelle ou modifiée. */
export interface DecisionReference {
  readonly decidedAt: IsoDateTime;
  readonly accepted: boolean;
  readonly loadKg: number | null;
  readonly reps: readonly number[];
}

/** Matériel vu par le moteur : inventaire et incréments d'un profil (le profil actif est choisi par l'appelant ; défaut : « Salle complète », FIX-0173). */
export type ProgressionEquipment = Pick<EquipmentProfileInput, 'inventory' | 'increments'>;

/** Exercice vu par le moteur. */
export interface ProgressionExercise {
  readonly id: string;
  readonly metric: ExerciseMetric;
  /** Matériel de l'exercice, dans l'ordre des données : le premier qui fournit une grille de charges l'emporte. */
  readonly equipment: readonly string[];
  /** `isolation` : exercice secondaire (une série retirée si Recovery est bas, § 11.3) ; absent : principal. */
  readonly kind?: ExerciseKind;
  /** Fraction du poids de corps portée (]0, 1], `bodyweightFraction` du catalogue) : exercice lesté ou assisté ; absent ou nul : charge ordinaire. */
  readonly bodyweightFraction?: number | null;
  /** Exercice assisté : la charge saisie est l'assistance, retranchée du poids de corps porté. */
  readonly assisted?: boolean;
}

/**
 * Récupération vue par le moteur (§ 11.3, § 16.1 ; I2-02). Entrée nullable : I2 ne lit pas HealthKit, aucune source réelle avant I5.
 * Un champ nul n'est jamais remplacé par une valeur inventée ; un snapshot absent ou entièrement nul ne module rien.
 */
export interface RecoverySnapshot {
  /** Score Recovery 0 à 100. */
  readonly recovery: number | null;
  /** Sommeil de la nuit, en heures. */
  readonly sleepHours: number | null;
  /** Écart de la FC de repos à la baseline, en fraction (+0,08 = +8 %). */
  readonly restingHrDelta: number | null;
  /** I5-02 point 2.2 : snapshot issu d'une journée rouge ACCEPTÉE par Ali au lancement (§ 16.7) ; la phrase le dit. Absent : autre source. */
  readonly redDay?: boolean;
}

export interface PrescribeInput {
  readonly exercise: ProgressionExercise;
  /** Séances closes de cet exercice, dans n'importe quel ordre (le moteur trie). */
  readonly history: readonly ExerciseSession[];
  readonly lastDecision: DecisionReference | null;
  readonly profile: ProgressionProfileState | null;
  /** Null : aucun profil de matériel (pas d'arrondi connu). */
  readonly equipment: ProgressionEquipment | null;
  readonly target: RepTarget;
  readonly config: ProgressionConfig;
  /** Instant de calcul, injecté (aucune lecture d'horloge dans le moteur). */
  readonly now: IsoDateTime;
  // Contexte des contraintes I2-02 (constraints.ts), qui ne peuvent que maintenir ou réduire : tous facultatifs.
  /** Null ou absent : aucune modulation Recovery (I2 : aucune source réelle). */
  readonly recovery?: RecoverySnapshot | null;
  /** Deload manuel demandé par Ali pour cette séance. */
  readonly deload?: boolean;
  /** PROG-01 (D-267) : décharge d'un cycle de 4 ou 6 semaines (séries, facteur de charge) ; absents : deload I2. */
  readonly deloadSets?: number;
  readonly deloadLoad?: number;
  /** Dernier travail du muscle principal, tous exercices confondus ; absent ou nul : dernière séance de cet exercice (la plus récente des deux l'emporte). */
  readonly muscleLastWorkedAt?: IsoDateTime | null;
  /**
   * Rang de l'exercice parmi ceux du même muscle principal dans la séance (1 = premier ; REV-01 constat 6, § 11.3), et rang qu'il avait dans
   * la séance de référence (celle dont la charge vient). La décote de position appliquée est `m(rang) / m(rang de référence)`, jamais une
   * hausse : une décote déjà reflétée dans l'historique n'est pas comptée deux fois. Absents : rang 1, aucun effet.
   */
  readonly positionRank?: number;
  readonly lastPositionRank?: number;
  /** Poids de corps en kg (dernière tendance, sinon dernière pesée) ; null ou absent : inconnu (REV-01, exercices au poids du corps). */
  readonly bodyweightKg?: number | null;
}

/** Codes de raison, dans l'ordre normatif du § 11.2 (voir `REASON_ORDER`). */
export type ReasonCode =
  | 'partial-session-ignored'
  | 'outlier-excluded'
  | 'no-history'
  | 'decision-reference'
  | 'history-reference'
  | 'provisional'
  | 'top-reached'
  | 'rep-ladder'
  | 'hard-blocks-increase'
  | 'easy-confirms'
  | 'easy-recalibration'
  | 'fatigue-drop'
  | 'stall'
  | 'inactivity-discount'
  | 'position-discount'
  | 'bodyweight-unknown'
  | 'deload'
  | 'recovery-low'
  | 'recovery-set-removed'
  // I5-02 point 2.2 : la récupération basse vient d'une journée rouge acceptée par Ali au lancement de la séance (§ 16.7).
  | 'recovery-red-day'
  | 'increment-unknown'
  // I2-04 : grille de charges tirée d'un matériel « à vérifier » du profil (information, rien n'est bloqué).
  | 'grid-to-verify'
  | 'equipment-max'
  | 'snap-extra-rep'
  | 'gain-capped'
  | 'unsupported-metric';

/** Raison principale : une phrase par proposition (texte en PR 2/2, `src/i18n`). */
export type PrescriptionHeadline =
  | 'to-enter'
  | 'decision'
  | 'increase'
  | 'rep-ladder'
  | 'recalibration'
  | 'hold-hard'
  | 'extra-rep'
  | 'unsupported'
  | 'fatigue'
  | 'inactivity'
  | 'deload'
  | 'recovery-low'
  | 'position';

/**
 * Choix facultatif présenté avec la proposition (I2-02, D-72 points 7 et 8), jamais appliqué d'office : Ali le choisit ou l'ignore.
 * `stall-variant` et `stall-range` sont des pistes sans valeur (charge et répétitions nulles).
 */
export type ProposalOptionKind = 'fatigue-load' | 'fatigue-reps' | 'stall-variant' | 'stall-range' | 'stall-mini-deload';

export interface ProposalOption {
  readonly kind: ProposalOptionKind;
  readonly loadKg: number | null;
  readonly reps: readonly number[] | null;
}

export interface PrescribedSet {
  readonly reps: number;
  /** Null : « à saisir ». */
  readonly loadKg: number | null;
}

/** Performance de référence (dernière séance valide) : charge, reps par série (complétées à `target.sets`), meilleure série Epley. */
export interface PrescriptionReference {
  readonly loadKg: number;
  readonly reps: readonly number[];
  readonly e1rmKg: number;
}

export interface Prescription {
  /** `to-enter` : aucune charge (Ali saisit) ; `unsupported` : métrique hors moteur (poids de corps, durée, distance). */
  readonly status: 'prescribed' | 'to-enter' | 'unsupported';
  readonly headline: PrescriptionHeadline;
  readonly reasons: readonly ReasonCode[];
  readonly sets: readonly PrescribedSet[];
  readonly loadKg: number | null;
  /** Écart à la charge de référence ; null sans référence. */
  readonly deltaKg: number | null;
  readonly reference: PrescriptionReference | null;
  /** Série qui gagne une répétition (échelle), sinon null. */
  readonly ladderSetIndex: number | null;
  readonly estimated1rmKg: number | null;
  /** 0 à 1. */
  readonly confidence: number;
  /** Recalibrage « Facile » appliqué : l'appelant met à jour `progression_profile`. */
  readonly recalibration: { readonly at: IsoDateTime; readonly estimated1rmKg: number } | null;
  // Champs I2-02 (moteur 2) : toujours rendus par `prescribe`, facultatifs pour une prescription tracée par la 0.3.1 (moteur 1), à lire
  // avec un repli (`?? []`, `?? false`, `?? 0`).
  /** Choix facultatifs (fatigue, stagnation), dans l'ordre de `PROPOSAL_OPTION_ORDER` ; vide sans contrainte. */
  readonly options?: readonly ProposalOption[];
  /** Deload appliqué : les séries retenues pour cette séance sont exclues des statistiques. */
  readonly deload?: boolean;
  /** RIR cible (au moins `deloadRirAtLeast` en deload) ; null sans cible. */
  readonly rirTarget?: number | null;
  /** Décote d'inactivité appliquée (0 à `detrainFloor`). */
  readonly inactivityCut?: number;
  /** Rang de position pris en compte et décote de position appliquée (0 à 1 ; 0 sans décote). */
  readonly positionRank?: number;
  readonly positionCut?: number;
  /** DEP-01 : charge sur laquelle la décote est dite (charge totale corps ± saisie si le poids de corps est connu, sinon la charge de référence). */
  readonly positionBasisKg?: number;
  readonly engineVersion: number;
  readonly activeConfig: ProgressionConfig;
}
