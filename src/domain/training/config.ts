import type { SetKind } from './session';
import type { PrescriptionHeadline, ProposalOptionKind, ReasonCode } from './types';

/**
 * Constantes du moteur de prescription (PRD § 11.3 ; I2-01 ; D-72). Module pur. Toute modification d'une valeur qui change une
 * prescription incrémente `ENGINE_VERSION` (la version est jointe à chaque prescription et à chaque décision tracée).
 */

// SEANCE-0292b (D-542) : 4 → 5, D-496 (charge hors grille ramenée sur la grille) et D-539 (sans charge : fatigue, stagnation, décote).
// SEANCE-0299 (D-681) : 5 → 6, D-657 (décision d'Ali réduite par la décharge, la pause et la récupération basse).
export const ENGINE_VERSION = 6;

export interface ProgressionConfig {
  /** Au-delà, une série pèse `lowQualityWeight` dans l'estimation (§ 11.3). */
  readonly maxRepsForEstimate: number;
  /** Sous cette fraction du 1RM courant, une série pèse `lowQualityWeight`. */
  readonly lowLoadRatio: number;
  readonly lowQualityWeight: number;
  /** Poids de récence des séances, de la plus récente à la plus ancienne ; leur nombre borne la fenêtre d'estimation. */
  readonly recencyWeights: readonly number[];
  /** Série aberrante : e1RM au-delà de ce multiple du 1RM courant, non confirmée (§ 11.2 point 1). */
  readonly outlierRatio: number;
  /** Une séance sous cette fraction de séries faites ne met pas à jour le 1RM (§ 11.5). */
  readonly minCompletedFraction: number;
  /** Confiance : poids des séries, de la dispersion et de la récence ; séries au-delà desquelles le terme est plein. */
  readonly confidenceWeights: { readonly sets: number; readonly dispersion: number; readonly recency: number };
  readonly setsForFullConfidence: number;
  /** Récence 1 jusqu'à `recencyFullDays`, linéaire, 0 à partir de `recencyZeroDays` (D-72 point 3). */
  readonly recencyFullDays: number;
  readonly recencyZeroDays: number;
  /** Confiance strictement sous ce seuil : prescription provisoire. */
  readonly provisionalBelow: number;
  /** Confiance strictement sous ce seuil : « Facile » peut recalibrer. */
  readonly easyRecalibrationBelow: number;
  readonly easyRecalibrationGain: number;
  /** « Une fois par exercice et par mois » : 30 jours glissants. */
  readonly easyRecalibrationCooldownDays: number;
  /** RIR ≤ : bloque la hausse ; RIR ≥ : confirme le cran (§ 11.2 point 5). */
  readonly hardRirAtMost: number;
  readonly easyRirAtLeast: number;
  /** Plafond de hausse du 1RM implicite par séance (D-72 point 7). */
  readonly maxGainPerSession: number;
  /** Écart au cran inférieur au-delà duquel une répétition est ajoutée (D-72 point 6). */
  readonly snapTolerance: number;
  /** Cran supposé quand le matériel n'a pas de palier connu (machine ou poulie « à vérifier »), signalé par `increment-unknown`. */
  readonly unknownIncrementKg: number;
  /** Arrondi inférieur d'une charge sans grille. */
  readonly unknownGridRoundingKg: number;
  /** Multiplicateurs de position par muscle principal (§ 11.3), appliqués par la génération (I3). */
  readonly positionDiscount: readonly number[];
  // Contraintes (I2-02, § 11.3 ; D-72 points 7 à 10) : maintien ou réduction seulement.
  /** Baisse de répétitions à charge égale strictement au-delà : fatigue (D-72 point 7). */
  readonly fatigueDrop: number;
  /** Choix de fatigue : charge × (1 − `fatigueLoadCut`) ou `fatigueRepsCut` répétitions de moins par série. */
  readonly fatigueLoadCut: number;
  readonly fatigueRepsCut: number;
  /** Séances consécutives sans progrès qui ouvrent les trois choix de stagnation (D-72 point 8). */
  readonly stallSessions: number;
  /** Mini-deload de stagnation : charge × (1 − `miniDeloadCut`). */
  readonly miniDeloadCut: number;
  /** Inactivité (D-72 point 10) : seuil en jours, −`detrainWeeklyCut` par semaine complète au-delà (dès J21), plancher `detrainFloor`. */
  readonly detrainStartDays: number;
  readonly detrainWeeklyCut: number;
  readonly detrainFloor: number;
  /** Deload manuel : séries ÷ 2 arrondi en dessous, au moins une (D-72 point 9) ; charge × `deloadLoad` ; RIR cible au moins `deloadRirAtLeast`. */
  readonly deloadLoad: number;
  readonly deloadRirAtLeast: number;
  /** Récupération basse : Recovery ≤ `lowRecovery`, sommeil < `lowSleepHours` ou FC repos > +`highRestingHrDelta` → charge × `lowRecoveryLoad`. */
  readonly lowRecovery: number;
  readonly lowSleepHours: number;
  readonly highRestingHrDelta: number;
  readonly lowRecoveryLoad: number;
  /** MOTEUR-0281a : pas d'un chronométré, `maxGainPerSession` du temps tenu arrondi en dessous, au moins 1 s, au plus `timeStepMaxSec`. */
  readonly timeStepMaxSec: number;
}

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = Object.freeze({
  maxRepsForEstimate: 15,
  lowLoadRatio: 0.6,
  lowQualityWeight: 0.25,
  recencyWeights: Object.freeze([1, 0.6, 0.3]),
  outlierRatio: 1.5,
  minCompletedFraction: 0.5,
  confidenceWeights: Object.freeze({ sets: 0.4, dispersion: 0.3, recency: 0.3 }),
  setsForFullConfidence: 6,
  recencyFullDays: 14,
  recencyZeroDays: 60,
  provisionalBelow: 0.4,
  easyRecalibrationBelow: 0.6,
  easyRecalibrationGain: 0.05,
  easyRecalibrationCooldownDays: 30,
  hardRirAtMost: 1,
  easyRirAtLeast: 4,
  maxGainPerSession: 0.1,
  snapTolerance: 0.03,
  unknownIncrementKg: 2.5,
  unknownGridRoundingKg: 0.5,
  positionDiscount: Object.freeze([1, 0.93, 0.88]),
  fatigueDrop: 0.2,
  fatigueLoadCut: 0.05,
  fatigueRepsCut: 2,
  stallSessions: 3,
  miniDeloadCut: 0.1,
  detrainStartDays: 14,
  detrainWeeklyCut: 0.01,
  detrainFloor: 0.1,
  deloadLoad: 0.8,
  deloadRirAtLeast: 4,
  lowRecovery: 33,
  lowSleepHours: 6,
  highRestingHrDelta: 0.08,
  lowRecoveryLoad: 0.95,
  timeStepMaxSec: 5,
});

/** Constantes du moteur qu'un exercice peut ajuster (PRD § 11 « ajustables par exercice ») : bornes incluses, entier si `integer`. */
export type TunableKey = 'deloadLoad' | 'maxGainPerSession' | 'snapTolerance' | 'easyRecalibrationGain' | 'unknownIncrementKg' | 'fatigueDrop' | 'stallSessions' | 'detrainStartDays' | 'lowRecoveryLoad' | 'timeStepMaxSec';

/**
 * SEANCE-0292 (§ 11, choix prudent D-510) : bornes des surcharges par exercice. Le plafond de hausse ne dépasse jamais 10 % (§ 11.5 « aucune
 * hausse > 10 % par séance ») et le recalibrage « Facile » jamais 5 % (§ 11.2.5) : une surcharge ne peut que rendre le moteur plus prudent ou
 * adapter un réglage matériel. Hors bornes, illisible ou clé inconnue : ignorée (valeur par défaut).
 */
export const TUNABLE_BOUNDS: Readonly<Record<TunableKey, { readonly min: number; readonly max: number; readonly integer?: boolean }>> = Object.freeze({
  deloadLoad: { min: 0.5, max: 1 },
  maxGainPerSession: { min: 0.01, max: 0.1 },
  snapTolerance: { min: 0, max: 0.1 },
  easyRecalibrationGain: { min: 0, max: 0.05 },
  unknownIncrementKg: { min: 0.25, max: 20 },
  fatigueDrop: { min: 0.05, max: 0.5 },
  stallSessions: { min: 2, max: 10, integer: true },
  detrainStartDays: { min: 7, max: 60, integer: true },
  lowRecoveryLoad: { min: 0.5, max: 1 },
  timeStepMaxSec: { min: 1, max: 60, integer: true },
});

/** Configuration d'un exercice : celle du moteur, puis ses surcharges valides (`TUNABLE_BOUNDS`) ; sans surcharge, la même référence. */
export function withExerciseOverrides(config: ProgressionConfig, overrides: Readonly<Partial<Record<TunableKey, number>>> | undefined): ProgressionConfig {
  if (overrides === undefined || overrides === null) return config;
  const patch: Partial<Record<TunableKey, number>> = {};
  for (const [key, bounds] of Object.entries(TUNABLE_BOUNDS) as [TunableKey, (typeof TUNABLE_BOUNDS)[TunableKey]][]) {
    const value = (overrides as Record<string, unknown>)[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds.min || value > bounds.max) continue;
    if (bounds.integer === true && !Number.isInteger(value)) continue;
    patch[key] = value;
  }
  return Object.keys(patch).length === 0 ? config : Object.freeze({ ...config, ...patch });
}

/**
 * I5-02 point 2.2 (§ 16.1 niveau A, § 16.3 « par muscle ») : repère du Recovery Split. Un muscle sous `spareBelowPercent` est « à ménager »
 * et seul signalé par la suggestion prudente ; au-delà, « prêt ». Proposition (le PRD ne fixe pas le seuil), à confirmer par Ali.
 */
export const RECOVERY_SPLIT_CONFIG = Object.freeze({ spareBelowPercent: 50 });

/** Type d'exercice pour la vraisemblance d'une charge à la première séance (FIX-ABERR, décision d'Ali du 20/11). */
export type PlausibilityClass = 'lower-compound' | 'upper-compound' | 'isolation' | 'assisted';

export interface PlausibilityConfig {
  /** Plafond en multiple du poids de corps (assisté : assistance plafond, atteinte = signalée). */
  readonly bodyweightMultiple: Readonly<Record<PlausibilityClass, number>>;
  /** Poids de corps inconnu : plafond absolu en kg (assisté : assistance). */
  readonly absoluteKg: Readonly<Record<PlausibilityClass, number>>;
  /** Haltères : part du plafond du type, par haltère. */
  readonly dumbbellShare: number;
}

/**
 * FIX-ABERR (décision d'Ali du 20/11, proposition D-325) : plafonds de vraisemblance d'une série de travail à la première séance d'un exercice
 * (aucun historique, le contrôle relatif n'a pas de référence). Au-delà, « Confirmer / Corriger » avant l'écriture. Choix prudents, révisables
 * par Ali. Ne change aucune prescription : `ENGINE_VERSION` inchangé (D-284).
 */
export const PLAUSIBILITY_CONFIG: PlausibilityConfig = Object.freeze({
  bodyweightMultiple: Object.freeze({ 'lower-compound': 3.5, 'upper-compound': 2.5, isolation: 1.2, assisted: 1 }),
  absoluteKg: Object.freeze({ 'lower-compound': 300, 'upper-compound': 200, isolation: 100, assisted: 120 }),
  dumbbellShare: 0.5,
});

/** Séances closes chargées par exercice pour le moteur (fenêtre d'estimation et séances ignorées ou aberrantes comprises). */
export const HISTORY_SESSIONS_LOADED = 12;

/** Ordre normatif des raisons (§ 11.2) : validation, référence, double progression, difficulté, contraintes (I2-02), arrondi. */
export const REASON_ORDER: readonly ReasonCode[] = [
  'partial-session-ignored',
  'outlier-excluded',
  'no-history',
  'decision-reference',
  'revert-previous',
  'history-reference',
  'provisional',
  'top-reached',
  'rep-ladder',
  'hard-blocks-increase',
  'easy-confirms',
  'easy-recalibration',
  'fatigue-drop',
  'stall',
  'inactivity-discount',
  'deload',
  'recovery-low',
  'recovery-set-removed',
  'recovery-red-day',
  'position-discount',
  'bodyweight-unknown',
  'assistance-held',
  'increment-unknown',
  'grid-to-verify',
  'reference-off-grid',
  'equipment-max',
  'assistance-min',
  'snap-extra-rep',
  'gain-capped',
  'ballast-added',
  'ballast-unavailable',
  'time-step',
  'unsupported-metric',
  'declared-fatigue',
];

export const PRESCRIPTION_HEADLINES: readonly PrescriptionHeadline[] = [
  'to-enter',
  'decision',
  'increase',
  'rep-ladder',
  'recalibration',
  'hold-hard',
  'extra-rep',
  'unsupported',
  'fatigue',
  'inactivity',
  'deload',
  'recovery-low',
  'position',
  'ballast-add',
  'time-increase',
  'time-ladder',
];

/** Étape d'une rampe d'échauffement : fraction de la charge de travail et répétitions (arrondies en dessous à l'usage). */
export interface WarmupStep {
  readonly ratio: number;
  readonly reps: number;
}

/**
 * Rampe d'échauffement (PRD § 13.8 ; I2-03 ; D-72 point 11) : 40 % × 8, 60 % × 5, 80 % × 2 de la charge de travail. Hors moteur de
 * prescription (aucune proposition de travail n'en dépend) : la modifier ne change pas `ENGINE_VERSION`.
 */
export const WARMUP_STEPS: readonly WarmupStep[] = Object.freeze([Object.freeze({ ratio: 0.4, reps: 8 }), Object.freeze({ ratio: 0.6, reps: 5 }), Object.freeze({ ratio: 0.8, reps: 2 })]);

/** Matériel porteur de charge vu par la conversion d'un remplacement (SESS-01a) : barre, haltères, machine (charges guidées ou poulie). */
export type ReplacementImplement = 'barbell' | 'dumbbell' | 'machine';

/**
 * SESS-01a (§ 13.2 « Remplacer » ; règle proposée en décision, révisable par Ali) : facteur appliqué à la charge TOTALE de l'exercice remplacé
 * (deux haltères comptés) pour estimer la charge totale de départ du nouvel exercice quand il n'a aucun historique. Facteurs prudents (sous les
 * équivalences usuelles), résultat toujours arrondi au cran INFÉRIEUR du matériel. Même matériel (autre exercice) : aucune estimation (aucune
 * règle au PRD). Hors moteur de prescription : `ENGINE_VERSION` inchangé.
 */
export const REPLACEMENT_LOAD_FACTORS: Readonly<Partial<Record<`${ReplacementImplement}>${ReplacementImplement}`, number>>> = Object.freeze({
  'barbell>dumbbell': 0.75,
  'dumbbell>barbell': 1,
  'barbell>machine': 0.6,
  'machine>barbell': 0.6,
  'dumbbell>machine': 0.6,
  'machine>dumbbell': 0.6,
});

/** SESS-01c : jeu de disques standard (kg, par côté) du calculateur quand le profil n'en déclare aucun ; 10 de chaque masse. */
export const STANDARD_PLATES_KG: readonly number[] = Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25]);

/** Ordre stable des choix facultatifs : fatigue (charge, puis répétitions), puis stagnation (variante, plage, mini-deload). */
export const PROPOSAL_OPTION_ORDER: readonly ProposalOptionKind[] = ['fatigue-load', 'fatigue-reps', 'stall-variant', 'stall-range', 'stall-mini-deload'];

// -----------------------------------------------------------------------------------------------------------------------------------
// Génération de séance et mésocycle (PRD § 12.1–12.2 ; I3-01 ; D-73). Sans effet sur une prescription : `ENGINE_VERSION` inchangé.
// -----------------------------------------------------------------------------------------------------------------------------------

/** Version des règles de génération ; incrémentée à tout changement d'une constante ci-dessous qui change une séance proposée. */
export const GENERATION_VERSION = 3;

export interface GenerationConfig {
  /** Temps de travail estimé par série (§ 12.1) ; le repos compte entre séries consécutives seulement (D-73 point 4). */
  readonly secondsPerSet: number;
  /** Budget respecté si la durée estimée reste dans ± cette fraction (§ 12.4) ; aucune réduction tant que ≤ budget × (1 + tolérance). */
  readonly budgetTolerance: number;
  /** Balanced : part des emplacements récurrents, arrondie au-dessus (D-73 point 5), et période de rotation en semaines (§ 12.1). */
  readonly balancedRecurringShare: number;
  readonly balancedRotationWeeks: number;
  /** Plages de répétitions d'un exercice remplacé par un autre type (§ 12.1 point 4). */
  readonly compoundRepRange: readonly [number, number];
  readonly isolationRepRange: readonly [number, number];
  /** Jours par semaine admis par split (§ 12.1 point 1), bornes incluses. */
  readonly splitDays: Readonly<Record<'full-body' | 'upper-lower' | 'ppl' | 'custom', readonly [number, number]>>;
  /** Groupes musculaires (groupes d'affichage du contenu) de chaque jour de split (D-73, choix prudent consigné dans docs/I3-01.md). */
  readonly splitGroups: Readonly<Record<'full-body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs', readonly string[]>>;
  /** Budget accepté, en minutes. */
  readonly budgetMinMinutes: number;
  readonly budgetMaxMinutes: number;
  // Mésocycle (I3-02, § 12.2 ; D-73 point 3) : appliqués par mesocycle.ts et programPause.ts.
  readonly mesoWeeks: number;
  readonly mesoWeeksRange: readonly [number, number];
  /** Option illimitée : blocs roulants de cette longueur, deload en fin de bloc. */
  readonly unlimitedBlockWeeks: number;
  readonly setsPerWeekIncrement: number;
  /** RIR par défaut, de `rirStart` à `rirEnd` ; jamais 0 par défaut (seul un programme explicite le demande). */
  readonly rirStart: number;
  readonly rirEnd: number;
  /** Priorité musculaire : au plus ± cette quantité de séries hebdomadaires (§ 12.2), bornée par la plage de la routine. */
  readonly prioritySetDelta: number;
  /** Arrêt au-delà duquel une semaine allégée est proposée (§ 12.6). */
  readonly lightWeekAfterDays: number;
  // I3-02 (§ 12.2, § 12.5 ; D-73 points 3, 8, 9 ; choix prudents consignés dans docs/I3-02.md).
  /** Écart de séries d'une ligne sur les semaines de travail, de la première à la dernière ; la ligne de la routine vaut la semaine 2 du § 12.5. */
  readonly mesoSetsOffsetRange: readonly [number, number];
  /** RIR affiché en semaine de deload : celui du deload I2 (`deloadRirAtLeast`, D-72 point 9). */
  readonly deloadWeekRir: number;
  /** Durée de la semaine allégée insérée à la reprise (jours). */
  readonly lightWeekDays: number;
}

const ALL_GROUPS = Object.freeze(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs']);
const LOWER_GROUPS = Object.freeze(['quadriceps', 'hamstrings', 'glutes', 'calves', 'abs']);

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = Object.freeze({
  secondsPerSet: 45,
  budgetTolerance: 0.1,
  balancedRecurringShare: 0.7,
  balancedRotationWeeks: 4,
  compoundRepRange: Object.freeze([5, 10] as const),
  isolationRepRange: Object.freeze([8, 15] as const),
  splitDays: Object.freeze({
    'full-body': Object.freeze([1, 3] as const),
    'upper-lower': Object.freeze([4, 4] as const),
    ppl: Object.freeze([5, 6] as const),
    custom: Object.freeze([1, 7] as const),
  }),
  splitGroups: Object.freeze({
    'full-body': ALL_GROUPS,
    upper: Object.freeze(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms']),
    lower: LOWER_GROUPS,
    push: Object.freeze(['chest', 'shoulders', 'triceps']),
    pull: Object.freeze(['back', 'biceps', 'forearms', 'shoulders']),
    legs: LOWER_GROUPS,
  }),
  budgetMinMinutes: 10,
  budgetMaxMinutes: 240,
  mesoWeeks: 5,
  mesoWeeksRange: Object.freeze([4, 7] as const),
  unlimitedBlockWeeks: 5,
  setsPerWeekIncrement: 1,
  rirStart: 3,
  rirEnd: 1,
  prioritySetDelta: 1,
  lightWeekAfterDays: 21,
  mesoSetsOffsetRange: Object.freeze([-1, 1] as const),
  deloadWeekRir: 4,
  lightWeekDays: 7,
});

/**
 * Progrès › Entraînement (PROGRES, § 17.1 ; choix prudents consignés dans docs/PROGRES.md, révisables par Ali). Types de série comptés
 * dans le volume : travail et chrono (échauffement, drop et partielle exclus) ; part d'un muscle : son poids dans le contenu (§ 14.1).
 */
export interface ProgressConfig {
  /** Semaines glissantes du volume par muscle, semaine en cours comprise. */
  readonly volumeWeeks: number;
  readonly volumeSetKinds: readonly SetKind[];
  /** Semaines complètes de l'adhérence. */
  readonly adherenceWeeks: number;
  /** Objectif hebdomadaire hors programme suivi (ou avant son début). */
  readonly defaultWeeklyTarget: number;
  /** BL-114 (D-448, décision d'Ali du 21/11) : plage cible de séries difficiles par muscle et par semaine, bornes comprises. */
  readonly volumeRange: { readonly min: number; readonly max: number };
}

export const DEFAULT_PROGRESS_CONFIG: ProgressConfig = Object.freeze({
  volumeWeeks: 8,
  volumeSetKinds: Object.freeze(['work', 'timed'] as const),
  adherenceWeeks: 4,
  defaultWeeklyTarget: 1,
  volumeRange: Object.freeze({ min: 10, max: 20 }),
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// Strength Score maison (STR-0300, BL-174 ; D-675, D-678, D-741). Hors du moteur de prescription : `ENGINE_VERSION` inchangé. Toute
// modification de formule ou de seuil relève `STRENGTH_SCORE_VERSION` (jointe au résultat, citée à l'écran).
// ---------------------------------------------------------------------------------------------------------------------------------------

export const STRENGTH_SCORE_VERSION = 1;

/** Groupes du Strength Score, dans l'ordre de l'écran. */
export const STRENGTH_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes'] as const;
export type StrengthGroup = (typeof STRENGTH_GROUPS)[number];

/** 5 niveaux, du plus bas au plus haut ; leurs seuils valent 20, 40, 60, 80 et 100 points (`STRENGTH_LEVEL_SCORES`). */
export const STRENGTH_LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'] as const;
export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];
export const STRENGTH_LEVEL_SCORES = Object.freeze([20, 40, 60, 80, 100] as const);

/** Poids de corps de normalisation et exposant : force relative = e1RM × (80 / poids de corps)^(2/3) (D-675). */
export const STRENGTH_NORMALIZED_BODYWEIGHT_KG = 80;
export const STRENGTH_BODYWEIGHT_EXPONENT = 2 / 3;

/** Seuils d'un mouvement, en kg de force relative (ramenée à 80 kg) : Débutant, Novice, Intermédiaire, Avancé, Élite, par sexe. */
export interface LiftThresholds {
  readonly male: readonly number[];
  readonly female: readonly number[];
}
export type StrengthThresholds = Readonly<Record<string, LiftThresholds>>;

/**
 * Méthode de dérivation des seuils (docs/STR-0300-seuils.md) : seuil = 80 kg × multiple « Intermédiaire » du mouvement (homme)
 * × coefficient du sexe × échelle des niveaux, arrondi au 0,5 kg. Échelle « libre » (barre) ou « totale » (tractions, dips : le poids de
 * corps fait déjà le plancher, d'où une échelle resserrée). Coefficient femme : haut du corps à la barre, bas du corps, charge totale.
 */
export interface StrengthThresholdMethod {
  readonly bodyweightKg: number;
  readonly roundingKg: number;
  readonly ladders: { readonly free: readonly number[]; readonly total: readonly number[] };
  readonly female: { readonly upper: number; readonly lower: number; readonly total: number };
  readonly lifts: Readonly<Record<string, { readonly intermediate: number; readonly body: 'upper' | 'lower' | 'total' }>>;
}

export const STRENGTH_THRESHOLD_METHOD: StrengthThresholdMethod = Object.freeze({
  bodyweightKg: 80,
  roundingKg: 0.5,
  ladders: Object.freeze({ free: Object.freeze([0.5, 0.75, 1, 1.3, 1.65]), total: Object.freeze([0.8, 0.9, 1, 1.2, 1.4]) }),
  female: Object.freeze({ upper: 0.6, lower: 0.75, total: 0.82 }),
  lifts: Object.freeze({
    bench: { intermediate: 1.0, body: 'upper' },
    'incline-bench': { intermediate: 0.85, body: 'upper' },
    'barbell-row': { intermediate: 0.9, body: 'upper' },
    'pull-up': { intermediate: 1.35, body: 'total' },
    'chin-up': { intermediate: 1.4, body: 'total' },
    'overhead-press': { intermediate: 0.65, body: 'upper' },
    dip: { intermediate: 1.5, body: 'total' },
    'back-squat': { intermediate: 1.35, body: 'lower' },
    'front-squat': { intermediate: 1.1, body: 'lower' },
    deadlift: { intermediate: 1.65, body: 'lower' },
    'sumo-deadlift': { intermediate: 1.65, body: 'lower' },
  } as const),
});

/** Seuils tirés de la méthode (contrôle : le tableau `STRENGTH_LIFT_THRESHOLDS` en est la copie exacte). */
export function deriveStrengthThresholds(method: StrengthThresholdMethod): StrengthThresholds {
  const round = (kg: number): number => Math.round(kg / method.roundingKg) * method.roundingKg;
  const out: Record<string, LiftThresholds> = {};
  for (const [key, lift] of Object.entries(method.lifts)) {
    const ladder = lift.body === 'total' ? method.ladders.total : method.ladders.free;
    const row = (coefficient: number): number[] => ladder.map((step) => round(method.bodyweightKg * lift.intermediate * coefficient * step));
    out[key] = { male: row(1), female: row(method.female[lift.body]) };
  }
  return out;
}

/**
 * Seuils du Strength Score maison, en kg de force relative (e1RM ramené à 80 kg ; tractions et dips : charge totale).
 * PROPOSITION NON VALIDÉE (Q-42, D-678) : rien n'est publié avec ce tableau avant la décision d'Ali.
 * Ordre : Débutant, Novice, Intermédiaire, Avancé, Élite.
 */
export const STRENGTH_LIFT_THRESHOLDS: StrengthThresholds = Object.freeze({
  bench: { male: [40, 60, 80, 104, 132], female: [24, 36, 48, 62.5, 79] },
  'incline-bench': { male: [34, 51, 68, 88.5, 112], female: [20.5, 30.5, 41, 53, 67.5] },
  'barbell-row': { male: [36, 54, 72, 93.5, 119], female: [21.5, 32.5, 43, 56, 71.5] },
  'pull-up': { male: [86.5, 97, 108, 129.5, 151], female: [71, 79.5, 88.5, 106.5, 124] },
  'chin-up': { male: [89.5, 101, 112, 134.5, 157], female: [73.5, 82.5, 92, 110, 128.5] },
  'overhead-press': { male: [26, 39, 52, 67.5, 86], female: [15.5, 23.5, 31, 40.5, 51.5] },
  dip: { male: [96, 108, 120, 144, 168], female: [78.5, 88.5, 98.5, 118, 138] },
  'back-squat': { male: [54, 81, 108, 140.5, 178], female: [40.5, 61, 81, 105.5, 133.5] },
  'front-squat': { male: [44, 66, 88, 114.5, 145], female: [33, 49.5, 66, 86, 109] },
  deadlift: { male: [66, 99, 132, 171.5, 218], female: [49.5, 74.5, 99, 128.5, 163.5] },
  'sumo-deadlift': { male: [66, 99, 132, 171.5, 218], female: [49.5, 74.5, 99, 128.5, 163.5] },
});

/** Mouvement de référence de chaque groupe : celui dont les seuils forment le tableau soumis à Ali (5 niveaux × 8 groupes × sexe). */
export const STRENGTH_GROUP_REFERENCE: Readonly<Record<StrengthGroup, string>> = Object.freeze({
  chest: 'bench',
  back: 'pull-up',
  shoulders: 'overhead-press',
  biceps: 'chin-up',
  triceps: 'dip',
  quads: 'back-squat',
  hamstrings: 'deadlift',
  glutes: 'sumo-deadlift',
});
