/**
 * Constantes du moteur de récupération (PRD § 16.1 et § 16.3). Aucune n'est écrite en dur dans une fonction.
 * Les valeurs marquées « proposition » ne figurent pas au PRD : elles attendent la décision d'Ali (docs/I5-01.md, section Domaine).
 */

/** Ressenti de fin d'exercice → facteur de charge (§ 16.3 « facteur 0,8 / 1 / 1,2 » ; clés = `Difficulty` du moteur de séance). */
export type RecoveryDifficulty = 'easy' | 'ok' | 'hard';

/**
 * Échelle de la musculation dans l'Exertion (D-88 révisée, I5-03) : points muscu = tonnage en tonnes × facteur de difficulté × échelle.
 * Avec k = 300 et sans échelle, 12 t donnaient 0,4 sur 10 : la zone cible et le supplément de sommeil ne jouaient jamais. 20 donne
 * 12 t ≈ 5,5, 6 t ≈ 3,3, 20 t ≈ 7,4 (6 t ≈ 3,3). Choix prudent de l'agent, révisable par Ali ; la formule du PRD § 16.3 (k, 10 × (1 − e^(−x/k))) est gardée.
 */
export const STRENGTH_SCALE = 20;

/**
 * I6-06 (D-220, met à jour D-88) : échelle du cardio dans l'Exertion. Règle nommée « minutes × ressenti » (charge de séance par le ressenti, sRPE) :
 * points cardio = durée en minutes × RPE (1 à 10) × échelle, additionnés aux points muscu avant la courbe `10 × (1 − e^(−x/k))`. Avec 1 : 30 min à
 * RPE 5 → 150 → 3,93 ; 45 min à RPE 7 → 315 → 6,50 ; 60 min à RPE 8 → 480 → 7,98, du même ordre qu'une séance de musculation de 6 à 20 t.
 * Choix prudent de l'agent, révisable par Ali ; les zones de FC du PRD restent inutilisées (pas de zones fiables, D-69).
 */
export const CARDIO_SRPE_SCALE = 1;

export const RECOVERY_CONFIG = {
  /** § 16.3 Baseline. */
  baselineDays: 14,
  minNights: 7,
  outlierSigma: 2.5,
  /** Proposition : durée de sommeil minimale pour qu'une nuit compte comme « valide » (le PRD ne la fixe pas). */
  validNightMinAsleepMinutes: 180,

  /** § 16.3 Recovery. */
  hrvWeight: 0.7,
  rhrWeight: 0.3,
  zClamp: 2,
  scoreCenter: 50,
  scoreScale: 25,
  sleepFactorMin: 0.8,
  sleepFactorMax: 1.0,

  /** § 16.3 Zone cible : seuils inclusifs sur le score arrondi. */
  zones: {
    high: { from: 66, target: [6, 8] },
    mid: { from: 34, target: [4, 6] },
    low: { from: 0, target: [0, 3] },
  },

  /**
   * § 16.3 Exertion. `cardioWeights` : poids des zones 1 à 5, INUTILISÉS (pas de zones FC fiables) ; depuis I6-06 (D-220) le cardio saisi compte par
   * minutes × ressenti × `CARDIO_SRPE_SCALE`, `cardioCounted` le dit.
   */
  exertion: {
    k: 300,
    tonnageUnit: 1000,
    difficultyFactor: { easy: 0.8, ok: 1, hard: 1.2 } as Readonly<Record<RecoveryDifficulty, number>>,
    cardioWeights: [1, 2, 3, 4, 5] as readonly number[],
    cardioCounted: true,
    /** Ressenti admis pour le cardio (RPE entier), bornes de la migration `cardio_session`. */
    cardioRpe: { rpeMin: 1, rpeMax: 10 },
    max: 10,
  },

  /**
   * § 16.3 Sommeil. Dette à compensation partielle (décision d'Ali du 12/11/2026, D-130) : sur les nuits valides connues des `debtDays` jours
   * avant aujourd'hui, une nuit courte ajoute 7 h 30 − dormi, une nuit longue retire au plus `surplusCreditCapMinutes` ; somme bornée à [0, `debtCapHours`].
   */
  sleep: {
    baseSleepHours: 7.5,
    exertionBaseline: 5,
    hoursPerExertionPoint: 0.2,
    debtDays: 7,
    debtCapHours: 3,
    surplusCreditCapMinutes: 60,
    regularityDays: 7,
    regularityMinNights: 3,
    /**
     * I5-05 : un épisode de sommeil regroupe les segments séparés de MOINS de 60 min (un réveil court ne coupe pas la nuit). La nuit est le
     * plus long épisode qui se termine le jour du réveil ; les autres épisodes (siestes) ne comptent ni pour la dette, ni pour la baseline, ni
     * pour la régularité du coucher, ni pour l'heure de lever. Choix prudent de l'agent, révisable par Ali (D-94).
     */
    episodeGapMinutes: 60,
  },

  /** § 16.7 Valeurs inhabituelles : z au-delà de 2 σ, seuil STRICT sur le z non arrondi (décision d'Ali du 12/11/2026, D-134, révise D-95). */
  unusualSigma: 2,

  /** § 16.7 Heure de coucher cible : médiane de l'heure de lever sur 14 j. */
  bedtime: { wakeDays: 14, minWakeNights: 7 },

  /** § 16.1 Niveau B : seuil absolu de sommeil court, proposition (les seuils du niveau B sont à décider par Ali). */
  levelB: { shortSleepHours: 6 },

  /** § 16.3 Par muscle : 48 / 72 / 96 h par classe de récupération. Approximation, dite telle quelle. */
  recoveryHours: { small: 48, medium: 72, large: 96 },
  /** Proposition : classe par groupe du catalogue (content/exercises/muscles.json). */
  groupRecoveryClass: {
    Bras: 'small',
    Épaules: 'small',
    Tronc: 'small',
    Torse: 'medium',
    Dos: 'medium',
    Jambes: 'large',
  } as Readonly<Record<string, 'small' | 'medium' | 'large'>>,
  /** Groupe de chaque muscle du catalogue (content/exercises/muscles.json) ; un identifiant absent n'est pas deviné : il est ignoré. */
  muscleGroups: {
    'chest': 'Torse',
    'lats': 'Dos',
    'middle-traps': 'Dos',
    'upper-traps': 'Dos',
    'trapezius': 'Dos',
    'erector-spinae': 'Dos',
    'lower-back': 'Dos',
    'front-delts': 'Épaules',
    'middle-delts': 'Épaules',
    'rear-delts': 'Épaules',
    'deltoids': 'Épaules',
    'rotator-cuff': 'Épaules',
    'shoulders': 'Épaules',
    'biceps': 'Bras',
    'triceps': 'Bras',
    'brachialis': 'Bras',
    'brachioradialis': 'Bras',
    'forearms': 'Bras',
    'forearm-flexors': 'Bras',
    'quads': 'Jambes',
    'hamstrings': 'Jambes',
    'glutes': 'Jambes',
    'gluteus-medius': 'Jambes',
    'gluteus-minimus': 'Jambes',
    'adductors': 'Jambes',
    'calves': 'Jambes',
    'gastrocnemius': 'Jambes',
    'soleus': 'Jambes',
    'tibialis-anterior': 'Jambes',
    'toe-extensors': 'Jambes',
    'abs': 'Tronc',
    'obliques': 'Tronc',
    'quadratus-lumborum': 'Tronc',
    'hip-flexors': 'Tronc',
  } as Readonly<Record<string, string>>,
  muscle: {
    /** Proposition : « séries × difficulté » règle la durée : 6 séries effectives = durée nominale, bornée à [0,5 ; 1,5]. */
    referenceEffectiveSets: 6,
    minScale: 0.5,
    maxScale: 1.5,
    /** Un muscle sans séance dans cette fenêtre n'a pas de ligne (inconnu ≠ 100 %). */
    lookbackHours: 240,
  },
} as const;

export type RecoveryClass = keyof typeof RECOVERY_CONFIG.recoveryHours;
