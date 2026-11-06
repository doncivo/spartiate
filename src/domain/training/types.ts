import type { DeviceId, Hlc, IsoDateTime } from '../types';

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
