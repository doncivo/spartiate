/**
 * Catalogue des tables et colonnes publiées par la synchronisation (ADR 0011, sections 3.2, 3.3, 4.2 et 8 ; Y-02, Y-09 ; D-55, D-65, D-67).
 *
 * Le catalogue est une valeur injectée (`SyncCatalogue`), pas un module global : le moteur et les repositories le reçoivent. En
 * production c'est `SYNC_CATALOGUE` (I0 : `profile` et `body_weight`) ; le banc de test (`tests/fixtures/legacy-schema/catalogue.ts`)
 * injecte l'ancien catalogue. Un nom reçu d'un autre appareil n'entre jamais dans une requête : il est cherché ici (comparaison exacte,
 * `Map` figée) et la requête est écrite avec le nom du catalogue (audit H5). Un catalogue étranger (table inconnue) reste donc inerte.
 *
 * Module pur : constantes, recherche et validation des valeurs. Aucune I/O.
 */

import { isId, isIsoDateTime, isLocalDate, isLocalDateTime, isLocalTime } from '../types';
import { MAX_SYNC_ID_LENGTH } from './limits';
import { SYNC_TABLE_ORDER } from './format';
import {
  expectedDayCompletenessId,
  expectedFavoriteId,
  expectedIntakeId,
  expectedMuscleRecoveryId,
  expectedProgressionId,
  expectedRecoveryDayId,
  expectedMeasurementId,
  expectedRecoveryFactorId,
  expectedWeightId,
  isDayCompletenessId,
  isFavoriteId,
  isIntakeId,
  isMuscleRecoveryId,
  isProfileId,
  isProgressionId,
  isRecoveryDayId,
  isMeasurementId,
  isRecoveryFactorId,
  isWeightId,
  MUSCLE_RECOVERY_MUSCLE_ID_MAX,
  PROFILE_ID,
} from './naturalIds';

/** Types déclarés des colonnes publiées (section 3.3). */
/** `datetime` : instant ISO 8601 UTC (`IsoDateTime`) ; `localdatetime` : date et heure locales flottantes (`LocalDateTime`, échéance d'un rappel). */
export type SyncColumnType = 'text' | 'int' | 'real' | 'bool' | 'json' | 'date' | 'time' | 'datetime' | 'localdatetime' | 'id' | 'enum';

export interface SyncColumn {
  readonly name: string;
  readonly type: SyncColumnType;
  readonly nullable: boolean;
  /** Longueur maximale (texte, JSON, identifiant). */
  readonly max?: number;
  /** Valeurs admises (`enum`) ou valeurs entières admises (`int`). */
  readonly values?: readonly (string | number)[];
  /** Faux : fusionné par hlc mais jamais montré dans le journal des conflits (section 4.2). */
  readonly conflictVisible: boolean;
}

/** Nom d'une table du catalogue injecté (le jeu de noms dépend du catalogue). */
export type SyncTableName = string;

/** Nature des identifiants d'une table : UUID, identifiant naturel déterministe (section 8) ou clé de réglage. */
export type SyncIdKind = 'uuid' | 'natural' | 'setting';

/** D'où vient le titre d'un élément au journal des conflits : sa propre colonne, la ligne parente, la cible d'un rappel, ou rien. */
export type TitleSource =
  | { readonly kind: 'own'; readonly column: string }
  | { readonly kind: 'parent'; readonly column: string; readonly table: SyncTableName }
  | { readonly kind: 'reminder' }
  | { readonly kind: 'none' };

/** Identité naturelle d'une table (section 8) : forme bien formée et identifiant attendu pour les valeurs d'une ligne. */
export interface NaturalIdSpec {
  /** L'identifiant est-il exactement l'identifiant naturel bien formé de cette table ? */
  readonly is: (id: string) => boolean;
  /** Identifiant attendu pour une ligne de ces valeurs (cohérence d'une recréation reçue, section 5.4), ou null si les valeurs manquent. */
  readonly expected: (row: ReadonlyMap<string, unknown>) => string | null;
  /** Vrai : un UUID est aussi admis (ancien schéma). Faux ou absent : aucun repli UUID (D-65). */
  readonly uuidFallback?: boolean;
}

export interface SyncTable {
  readonly name: SyncTableName;
  /** Colonne de clé primaire : `id`, ou `key` pour `settings`. */
  readonly key: 'id' | 'key';
  readonly idKind: SyncIdKind;
  /** Colonnes publiées (ordre du catalogue), `created_at` et `deleted_at` compris quand la table les porte. */
  readonly columns: readonly SyncColumn[];
  /** Colonnes locales, jamais publiées (section 8). */
  readonly local: readonly string[];
  /** Vrai si une ligne supprimée peut être purgée physiquement (section 5.4). */
  readonly purgeable: boolean;
  /** Clés étrangères vers une table publiée (colonne → table) : ordre d'application et mise de côté (section 3.3). */
  readonly parents: readonly { readonly column: string; readonly table: SyncTableName }[];
  /** Identité naturelle (`idKind: 'natural'`). */
  readonly natural?: NaturalIdSpec;
  /** Titre au journal des conflits ; `none` par défaut. */
  readonly titleSource?: TitleSource;
  /**
   * Lignes publiables (D-27) : absent, toutes les lignes ; sinon seules celles qui remplissent la règle. Une ligne non publiable n'est ni
   * exportée (instantané, report d'époque, rattachement), ni publiée depuis la file, ni purgée, ni supprimée par un remplacement : elle
   * reste locale. Règle déclarative du catalogue (jamais une valeur reçue), traduite en SQL par le repository de synchro.
   */
  readonly publishWhen?: PublishRule;
}

/**
 * `notNull` : la colonne de la ligne est renseignée (séance close : `ended_at`) ; `parent` : la ligne parente désignée par cette colonne
 * de `parents` existe et est elle-même publiable (série d'une séance close).
 */
export type PublishRule = { readonly notNull: string } | { readonly parent: string };

export type SettingKeyScope = 'shared' | 'local' | 'unknown';

/** Colonnes techniques présentes sur chaque table métier, qui ne circulent pas comme champs (section 3.1). */
export const TECHNICAL_COLUMNS = ['updated_at', 'device_id', 'hlc'] as const;

const SHORT_TEXT = 4_096;
const JSON_TEXT = 64 * 1_024;

// ---------------------------------------------------------------------------------------------------------------------------------
// Constructeurs (catalogue I0 et banc de test)
// ---------------------------------------------------------------------------------------------------------------------------------

const c = (name: string, type: SyncColumnType, nullable: boolean, extra: Partial<Omit<SyncColumn, 'name' | 'type' | 'nullable'>> = {}): SyncColumn => ({
  name,
  type,
  nullable,
  conflictVisible: true,
  ...(type === 'text' ? { max: SHORT_TEXT } : type === 'json' ? { max: JSON_TEXT } : type === 'id' ? { max: MAX_SYNC_ID_LENGTH } : {}),
  ...extra,
});
const hidden = { conflictVisible: false } as const;
const bool = (name: string, extra: Partial<SyncColumn> = {}): SyncColumn => c(name, 'bool', false, extra);
const createdAt = c('created_at', 'datetime', false, hidden);
const deletedAt = c('deleted_at', 'datetime', true);

const table = (
  name: SyncTableName,
  columns: readonly SyncColumn[],
  options: { local?: readonly string[]; parents?: SyncTable['parents']; idKind?: SyncIdKind; purgeable?: boolean; key?: 'id' | 'key'; natural?: NaturalIdSpec; titleSource?: TitleSource; publishWhen?: PublishRule } = {},
): SyncTable => ({
  name,
  key: options.key ?? 'id',
  idKind: options.idKind ?? 'uuid',
  columns,
  local: options.local ?? [],
  purgeable: options.purgeable ?? true,
  parents: options.parents ?? [],
  ...(options.natural ? { natural: options.natural } : {}),
  ...(options.titleSource ? { titleSource: options.titleSource } : {}),
  ...(options.publishWhen ? { publishWhen: options.publishWhen } : {}),
});

/** Constructeurs partagés avec le banc de test (ancien catalogue). */
export const kit = { c, hidden, bool, createdAt, deletedAt, table } as const;

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue injectable
// ---------------------------------------------------------------------------------------------------------------------------------

/** Lignes liées à une cible qui se purgent et se rétablissent avec elle (ancien schéma : rappels d'une tâche, routine ou événement). */
export interface CompanionRule {
  readonly table: string;
  readonly typeColumn: string;
  readonly idColumn: string;
  readonly targets: readonly string[];
}

/** Règles propres à un catalogue, en données : vides en production (I0), fournies par le banc pour l'ancien schéma. */
export interface CatalogueRules {
  /** Tables dont les enfants vivants sont rattachés à « aucun parent » avant la purge d'une trace reçue. */
  readonly reattachOnPurge: readonly string[];
  readonly companion: CompanionRule | null;
  /** Tables dont la purge supprime aussi les événements externes liés (ancien schéma : comptes d'agenda). */
  readonly dropExternalEventsOn: readonly string[];
  /** Réparations après un lot appliqué (le moteur lui passe ses `SyncDeps`) ; aucune en I0. */
  readonly repairs: ((deps: unknown, touched: ReadonlyMap<string, ReadonlySet<string>>) => Promise<void>) | null;
}

export interface SyncCatalogue {
  readonly rules: CatalogueRules;
  /** Tables publiées, dans l'ordre topologique (section 3.3). */
  readonly tables: readonly SyncTable[];
  /** Table du catalogue pour un nom reçu (comparaison exacte), ou undefined. */
  table(name: string): SyncTable | undefined;
  /** Colonne publiée d'une table (comparaison exacte), ou undefined (colonne locale, technique ou inconnue). */
  column(tableName: string, column: string): SyncColumn | undefined;
  /** Tables dont une colonne référence cette table (enfants), pour ne jamais purger un parent encore référencé. */
  childRelations(name: string): readonly { readonly table: SyncTable; readonly column: string }[];
  /** Rang topologique (départage à hlc égal, section 3.3) ; au-delà des tables pour un nom inconnu. */
  rank(name: string): number;
  /** Une ligne de cette table et de cet identifiant peut-elle être purgée physiquement (section 5.4) ? */
  isPurgeable(tableName: string, id: string): boolean;
  /** Identifiant de ligne admis pour cette table. */
  isValidRowId(t: SyncTable, id: unknown): id is string;
  /** La valeur respecte-t-elle le type et la longueur déclarés de la colonne ? */
  isValidValue(col: SyncColumn, value: unknown): boolean;
  /** Portée d'une clé de réglage publiée ; `unknown` quand le catalogue ne publie aucun réglage. */
  settingScope(key: string): SettingKeyScope;
  /** Identifiant fixe (jamais purgé ni tracé) : espaces Pro et Perso dans l'ancien catalogue ; aucun en I0. */
  isFixedId(tableName: string, id: string): boolean;
}

export interface CatalogueDefinition {
  readonly tables: readonly SyncTable[];
  /** Ordre topologique attendu : doit être exactement les noms de `tables`, dans cet ordre. */
  readonly order: readonly string[];
  /** Identifiants fixes par table. */
  readonly fixedIds?: Readonly<Record<string, ReadonlySet<string>>>;
  readonly settingScope?: (key: string) => SettingKeyScope;
  /** Identifiants naturels admis en plus d'un UUID dans une colonne de type `id`. */
  readonly extraId?: (value: string) => boolean;
  readonly rules?: Partial<CatalogueRules>;
}

export function createCatalogue(def: CatalogueDefinition): SyncCatalogue {
  const names = def.tables.map((t) => t.name);
  if (names.length !== def.order.length || names.some((n, i) => n !== def.order[i])) throw new Error('catalogue de synchro : ordre différent des tables');
  const byName: ReadonlyMap<string, SyncTable> = new Map(def.tables.map((t) => [t.name, t]));
  for (const t of def.tables) if (!isValidPublishRule(t, def.tables)) throw new Error(`catalogue de synchro : règle de publication invalide (${t.name})`);
  const columns: ReadonlyMap<string, ReadonlyMap<string, SyncColumn>> = new Map(def.tables.map((t) => [t.name, new Map(t.columns.map((col) => [col.name, col]))]));
  const children = new Map(def.tables.map((t) => [t.name, def.tables.flatMap((o) => o.parents.filter((p) => p.table === t.name).map((p) => ({ table: o, column: p.column })))]));
  const fixed = (tableName: string, id: string): boolean => def.fixedIds?.[tableName]?.has(id) ?? false;

  const isValidRowId = (t: SyncTable, id: unknown): id is string => {
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_SYNC_ID_LENGTH) return false;
    switch (t.idKind) {
      case 'uuid':
        return isId(id);
      case 'natural':
        return (t.natural?.is(id) ?? false) || (t.natural?.uuidFallback === true && isId(id));
      case 'setting':
        return /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,3}$/.test(id);
    }
  };

  const isValidColumnValue = (col: SyncColumn, value: unknown): boolean => {
    if (col.type === 'id' && typeof value === 'string' && value.length <= MAX_SYNC_ID_LENGTH && def.extraId?.(value) === true) return true;
    return isValidValue(col, value);
  };

  return {
    rules: { reattachOnPurge: def.rules?.reattachOnPurge ?? [], companion: def.rules?.companion ?? null, dropExternalEventsOn: def.rules?.dropExternalEventsOn ?? [], repairs: def.rules?.repairs ?? null },
    tables: def.tables,
    table: (name) => byName.get(name),
    column: (tableName, column) => columns.get(tableName)?.get(column),
    childRelations: (name) => children.get(name) ?? [],
    rank: (name) => {
      const index = def.order.indexOf(name);
      return index < 0 ? def.order.length : index;
    },
    isPurgeable: (tableName, id) => {
      const t = byName.get(tableName);
      return t !== undefined && t.purgeable && !fixed(tableName, id);
    },
    isValidRowId,
    isValidValue: isValidColumnValue,
    settingScope: def.settingScope ?? (() => 'unknown'),
    isFixedId: fixed,
  };
}

/**
 * Règle de publication bien formée : colonne publiée nullable (`notNull`), ou colonne de `parents` vers une table du catalogue placée
 * avant elle (`parent`) : la chaîne des parents se termine toujours.
 */
function isValidPublishRule(t: SyncTable, tables: readonly SyncTable[]): boolean {
  const rule = t.publishWhen;
  if (!rule) return true;
  if ('notNull' in rule) return t.columns.some((col) => col.name === rule.notNull && col.nullable);
  const parent = t.parents.find((p) => p.column === rule.parent);
  const index = tables.findIndex((o) => o.name === parent?.table);
  return parent !== undefined && index >= 0 && index < tables.indexOf(t);
}

/** Colonnes publiées d'une table, dans l'ordre du catalogue. */
export function publishedColumns(t: SyncTable): readonly string[] {
  return t.columns.map((col) => col.name);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I0 (D-55, D-65) : profile et body_weight
// ---------------------------------------------------------------------------------------------------------------------------------

const PROFILE_TABLE = table(
  'profile',
  [
    c('sex', 'text', true, { max: 32 }),
    c('birth_year', 'int', true),
    c('height_cm', 'real', true),
    c('goal', 'text', true, { max: 32 }),
    c('experience', 'text', true, { max: 32 }),
    c('units', 'text', true, { max: 32 }),
    createdAt,
    deletedAt,
  ],
  { idKind: 'natural', purgeable: false, natural: { is: isProfileId, expected: () => PROFILE_ID } },
);

const BODY_WEIGHT_TABLE = table(
  'body_weight',
  [
    c('date', 'date', false),
    c('kg', 'real', false),
    c('source', 'enum', false, { values: ['manual', 'health'] }),
    c('timezone', 'text', false, { max: 64 }),
    c('health_uuid', 'text', true, { max: 128 }),
    c('measured_at', 'datetime', true),
    createdAt,
    deletedAt,
  ],
  { idKind: 'natural', natural: { is: isWeightId, expected: (row) => expectedWeightId(row) }, titleSource: { kind: 'own', column: 'date' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I1-01 (D-25, D-71, P-09) : exercices personnalisés, profils de matériel, routines
// ---------------------------------------------------------------------------------------------------------------------------------

const ID_MAX = 128;
const uuidId = (name: string, nullable = false): SyncColumn => c(name, 'id', nullable);

/**
 * `exercise` : exercices PERSONNALISÉS seulement (identifiant UUID, D-71) ; les exercices embarqués n'ont aucune ligne et ne sont jamais
 * publiés. `is_custom` est une colonne locale (toujours 1), absente des journaux et des déclencheurs.
 */
const EXERCISE_TABLE = table(
  'exercise',
  [
    c('name_fr', 'text', false, { max: 120 }),
    c('aliases_en', 'json', false),
    c('muscles', 'json', false),
    c('equipment', 'json', false),
    c('pattern', 'enum', false, { values: ['push-horizontal', 'push-vertical', 'pull-horizontal', 'pull-vertical', 'hinge', 'squat', 'lunge', 'carry', 'core', 'isolation'] }),
    c('kind', 'enum', false, { values: ['compound', 'isolation'] }),
    c('metric', 'enum', false, { values: ['load-reps', 'bodyweight-reps', 'time', 'distance'] }),
    c('bodyweight_fraction', 'real', true),
    c('default_rep_min', 'int', false),
    c('default_rep_max', 'int', false),
    c('default_rest_sec', 'int', false),
    c('instructions', 'json', false),
    c('media', 'json', true),
    c('strength_standard_key', 'text', true, { max: 64 }),
    c('schema_version', 'int', false, hidden),
    createdAt,
    deletedAt,
  ],
  { local: ['is_custom'], titleSource: { kind: 'own', column: 'name_fr' } },
);

/** `equipment_profile` : le profil ACTIF n'est pas une colonne, c'est un réglage local de l'appareil (§ 14.3). */
const EQUIPMENT_PROFILE_TABLE = table(
  'equipment_profile',
  [c('name', 'text', false, { max: 80 }), c('kind', 'enum', false, { values: ['salle', 'maison', 'voyage'] }), c('inventory', 'json', false), c('increments', 'json', false), createdAt, deletedAt],
  { titleSource: { kind: 'own', column: 'name' } },
);

const ROUTINE_TABLE = table('routine', [c('name', 'text', false, { max: 120 }), c('mode', 'enum', false, { values: ['libre', 'programme'] }), createdAt, deletedAt], { titleSource: { kind: 'own', column: 'name' } });

const ROUTINE_DAY_TABLE = table(
  'routine_day',
  [uuidId('routine_id'), c('name', 'text', false, { max: 120 }), c('day_order', 'int', false), createdAt, deletedAt],
  { parents: [{ column: 'routine_id', table: 'routine' }], titleSource: { kind: 'own', column: 'name' } },
);

/**
 * `routine_exercise.exercise_id` est une référence LOGIQUE (P-09) : type `text` (identifiant du JSON embarqué ou UUID d'un exercice
 * personnalisé), absent de `parents` : une ligne reçue avant son exercice, ou visant un exercice supprimé ou inconnu de cette version,
 * est importée telle quelle. `exercise_name` en fige le nom (D-71).
 */
const ROUTINE_EXERCISE_TABLE = table(
  'routine_exercise',
  [
    uuidId('routine_day_id'),
    c('exercise_id', 'text', false, { max: ID_MAX }),
    c('exercise_name', 'text', false, { max: 120 }),
    c('sets', 'int', false),
    c('rep_min', 'int', false),
    c('rep_max', 'int', false),
    c('rir', 'int', true),
    c('rest_sec', 'int', false),
    c('position', 'int', false),
    createdAt,
    deletedAt,
    // I6-03b (migration 0014) : groupe de circuit du jour de routine et repos entre exercices du groupe. Visibles au journal des conflits : une
    // écriture locale (« Rétablir » compris) est capturée par `sync_routine_exercise_circuit_au`.
    c('circuit_id', 'text', true, { max: 64 }),
    c('circuit_rest_sec', 'int', true),
  ],
  { parents: [{ column: 'routine_day_id', table: 'routine_day' }], titleSource: { kind: 'own', column: 'exercise_name' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I1-03 (D-27, § 9.1) : séances closes et leurs séries
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * `workout` : publiée seulement close (`ended_at` renseigné, D-27). `routine_id`, `routine_day_id` et `copied_from_workout_id` sont des
 * références logiques (routine ou séance supprimée, purgée ou jamais publiée) : hors de `parents`. Le repos en cours est local.
 */
const WORKOUT_TABLE = table(
  'workout',
  [
    uuidId('routine_id', true),
    uuidId('routine_day_id', true),
    c('name', 'text', false, { max: 120 }),
    c('started_at', 'datetime', false),
    c('ended_at', 'datetime', true),
    c('source', 'enum', false, { values: ['empty', 'routine', 'copy'] }),
    uuidId('copied_from_workout_id', true),
    c('notes', 'text', false),
    createdAt,
    deletedAt,
  ],
  { local: ['rest_timer_end_at', 'rest_timer_seconds'], publishWhen: { notNull: 'ended_at' }, titleSource: { kind: 'own', column: 'name' } },
);

/**
 * `workout_set` : publiée avec sa séance close (`publishWhen` : parent publiable). `exercise_id` est une référence LOGIQUE (P-09, comme
 * `routine_exercise`) : type `text`, hors de `parents` ; `exercise_name` en fige le nom (D-71).
 */
const WORKOUT_SET_TABLE = table(
  'workout_set',
  [
    uuidId('workout_id'),
    c('exercise_id', 'text', false, { max: ID_MAX }),
    c('exercise_name', 'text', false, { max: 120 }),
    c('position', 'int', false),
    c('set_kind', 'enum', false, { values: ['warmup', 'work', 'drop', 'partial', 'timed'] }),
    c('target_reps_min', 'int', true),
    c('target_reps_max', 'int', true),
    c('target_load_kg', 'real', true),
    c('target_rest_sec', 'int', true),
    c('reps', 'int', true),
    c('load_kg', 'real', true),
    c('duration_sec', 'int', true),
    c('rir', 'int', true),
    bool('done'),
    c('done_at', 'datetime', true, hidden),
    c('corrected_at', 'datetime', true, hidden),
    createdAt,
    deletedAt,
    // I2-01 (migration 0006) : Facile / Juste / Dur de l'exercice dans la séance, publié avec la séance close.
    c('difficulty', 'enum', true, { values: ['easy', 'ok', 'hard'] }),
    // I6-03 (migration 0013) : groupe de circuit (superset, triset, circuit) et repos entre exercices du groupe, publiés avec la séance close.
    // Masquées du journal des conflits : aucun déclencheur ne les capture (séance ouverte seulement), un « Rétablir » sur une séance close ne serait pas publié (relecture sync-icloud).
    c('circuit_id', 'text', true, { max: 64, ...hidden }),
    c('circuit_rest_sec', 'int', true, hidden),
  ],
  { parents: [{ column: 'workout_id', table: 'workout' }], publishWhen: { parent: 'workout_id' }, titleSource: { kind: 'own', column: 'exercise_name' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I2-01 (D-72, migration 0006) : profil de progression et décisions d'Ali
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * `progression_profile` : état RECALCULABLE par exercice, identité naturelle `progression|<exercice>` (une ligne par exercice, même écrite
 * par deux appareils : la fusion par champ garde la plus récente). `exercise_id` est une référence logique (P-09). Champs masqués du journal
 * des conflits : ce sont des estimations, recalculées à chaque séance.
 */
const PROGRESSION_PROFILE_TABLE = table(
  'progression_profile',
  [
    c('exercise_id', 'text', false, { max: ID_MAX }),
    c('estimated_1rm_kg', 'real', true, hidden),
    c('confidence', 'real', true, hidden),
    c('last_easy_recalibration_at', 'datetime', true, hidden),
    c('engine_version', 'int', false, hidden),
    createdAt,
    deletedAt,
  ],
  { idKind: 'natural', natural: { is: isProgressionId, expected: (row) => expectedProgressionId(row) } },
);

/**
 * `recommendation_decision` : trace d'une prescription présentée et de la valeur retenue (§ 11.2 point 9, § 11.5). UUID. Elle suit sa séance
 * comme une série (relecture de la #61, D-27) : `workout_id` est un parent, publiable seulement close (`publishWhen`), mise en file à la
 * clôture ; une séance abandonnée n'en publie aucune. `workout_set_id` est une référence logique.
 */
const RECOMMENDATION_DECISION_TABLE = table(
  'recommendation_decision',
  [
    c('exercise_id', 'text', false, { max: ID_MAX }),
    uuidId('workout_id', true),
    uuidId('workout_set_id', true),
    c('engine_version', 'int', false, hidden),
    c('prescription', 'json', false, hidden),
    c('reasons', 'json', false, hidden),
    bool('accepted'),
    c('chosen_load_kg', 'real', true),
    c('chosen_reps', 'json', false),
    c('decided_at', 'datetime', false, hidden),
    createdAt,
    deletedAt,
  ],
  { parents: [{ column: 'workout_id', table: 'workout' }], publishWhen: { parent: 'workout_id' }, titleSource: { kind: 'none' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I3-02 (D-73, migration 0007) : cycles d'entraînement
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * `mesocycle` : un cycle d'entraînement, UUID (deux cycles créés hors ligne sur deux appareils restent deux lignes ; le plus récent est
 * suivi, l'écran le dit). `routine_id` est une référence LOGIQUE (routine supprimée ou pas encore reçue : le cycle reste lisible), hors de
 * `parents`. `pauses` : JSON `[{ from, to, lightWeek }]`, validé par le domaine à la lecture (ligne illisible signalée, jamais suivie en
 * silence). Aucune séance ouverte en jeu : toutes les lignes sont publiables (D-27 inchangé).
 */
const MESOCYCLE_TABLE = table(
  'mesocycle',
  [
    uuidId('routine_id'),
    c('start_date', 'date', false),
    c('weeks', 'int', false, { values: [4, 5, 6, 7] }),
    bool('unlimited'),
    c('deload_week', 'int', true),
    c('block_origin_week', 'int', false, hidden),
    c('block_origin_index', 'int', false, hidden),
    c('rotation_index', 'int', false, hidden),
    c('pauses', 'json', false),
    c('status', 'enum', false, { values: ['active', 'completed'] }),
    c('outcome', 'enum', true, { values: ['repeat', 'regenerate', 'change', 'stopped'] }),
    c('ended_on', 'date', true),
    c('next_weeks', 'int', true, { values: [4, 5, 6, 7] }),
    c('ramp_up', 'bool', true),
    createdAt,
    deletedAt,
  ],
  { titleSource: { kind: 'none' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I4-02 (D-74, migration 0008) : fiches alimentaires, portions, journal et cibles
// ---------------------------------------------------------------------------------------------------------------------------------

const MEAL_SOURCES = ['custom', 'ciqual', 'off', 'estimate', 'manual'] as const;

/**
 * `food` : fiches STOCKÉES (UUID) : fiche personnelle et cache Open Food Facts (§ 9.1). Ciqual n'a aucune ligne (contenu embarqué).
 * Valeurs pour 100 g nulles = inconnues (jamais 0). `fetched_at` (cache OFF, 90 jours) est publié et masqué du journal des conflits.
 */
const FOOD_TABLE = table(
  'food',
  [
    c('source', 'enum', false, { values: ['custom', 'off'] }),
    c('barcode', 'text', true, { max: 14 }),
    c('name', 'text', false, { max: 120 }),
    c('brand', 'text', true, { max: 120 }),
    c('kcal', 'real', true),
    c('protein_g', 'real', true),
    c('fat_g', 'real', true),
    c('carb_g', 'real', true),
    c('fiber_g', 'real', true),
    c('fetched_at', 'datetime', true, hidden),
    createdAt,
    deletedAt,
  ],
  { titleSource: { kind: 'own', column: 'name' } },
);

/** `food_portion` : portions d'une fiche stockée ; `food_id` est un parent publié (une portion reçue avant sa fiche est mise de côté). */
const FOOD_PORTION_TABLE = table(
  'food_portion',
  [uuidId('food_id'), c('label', 'text', false, { max: 80 }), c('grams', 'real', false), c('position', 'int', false), createdAt, deletedAt],
  { parents: [{ column: 'food_id', table: 'food' }], titleSource: { kind: 'own', column: 'label' } },
);

/**
 * `meal_entry` : journal alimentaire. `food_id` est une référence LOGIQUE (`ciqual:<code>` ou UUID de fiche, fiche supprimée ou pas encore
 * reçue : l'entrée reste lisible grâce à `food_name`), de type `text`, hors de `parents`. Kcal et macros : instantané, nuls = inconnus.
 */
const MEAL_ENTRY_TABLE = table(
  'meal_entry',
  [
    c('date', 'date', false),
    c('time', 'time', false),
    c('food_id', 'text', true, { max: ID_MAX }),
    c('food_name', 'text', false, { max: 200 }),
    c('source', 'enum', false, { values: MEAL_SOURCES }),
    c('grams', 'real', true),
    c('kcal', 'real', true),
    c('protein_g', 'real', true),
    c('fat_g', 'real', true),
    c('carb_g', 'real', true),
    c('method', 'enum', false, { values: ['search', 'scan', 'photo', 'quickadd'] }),
    c('confidence', 'real', true),
    createdAt,
    deletedAt,
  ],
  { titleSource: { kind: 'own', column: 'food_name' } },
);

/** `nutrition_target` : une ligne par décision d'Ali ou du moteur, jamais modifiée (D-74) ; `engine_version` masquée du journal des conflits. */
const NUTRITION_TARGET_TABLE = table(
  'nutrition_target',
  [
    c('week_start', 'date', false),
    c('kcal', 'real', false),
    c('protein_g', 'real', false),
    c('fat_g', 'real', false),
    c('carb_g', 'real', false),
    c('source', 'enum', false, { values: ['auto', 'manual'] }),
    bool('accepted'),
    c('engine_version', 'int', true, hidden),
    c('rest_kcal', 'real', true),
    c('rest_carb_g', 'real', true),
    c('training_days', 'text', true, { max: 13 }),
    createdAt,
    deletedAt,
  ],
  { titleSource: { kind: 'none' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I4-07 (D-80, D-81, migration 0009) : journée déclarée, recettes et ingrédients
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * `day_completeness` : « journée complète » ou « incomplète » déclarée par Ali pour une date locale (D-74 point 2). Identifiant naturel
 * `day|AAAA-MM-JJ` (une ligne par jour sur les deux appareils). RÈGLE DE CONFLIT : fusion champ par champ par HLC, dernière écriture gagne
 * (règle par défaut, aucune règle propre) ; deux déclarations différentes du même jour convergent sur la plus récente, l'autre reste au
 * journal des conflits. « Non déclarée » = ligne absente ou `deleted_at` renseigné.
 */
const DAY_COMPLETENESS_TABLE = table(
  'day_completeness',
  [c('date', 'date', false), c('state', 'enum', false, { values: ['complete', 'incomplete'] }), createdAt, deletedAt],
  { idKind: 'natural', natural: { is: isDayCompletenessId, expected: (row) => expectedDayCompletenessId(row) }, titleSource: { kind: 'own', column: 'date' } },
);

/** `recipe` : recette personnelle. Les ingrédients sont des lignes `recipe_ingredient` ; une prise est une `meal_entry` ordinaire (`food_id` = `recipe:<UUID>`). */
const RECIPE_TABLE = table(
  'recipe',
  [c('name', 'text', false, { max: 120 }), c('servings', 'int', false), c('cooked_weight_g', 'real', true), createdAt, deletedAt],
  { titleSource: { kind: 'own', column: 'name' } },
);

/**
 * `recipe_ingredient` : ingrédient d'une recette, `recipe_id` est un parent publié (un ingrédient reçu avant sa recette est mis de côté puis
 * rejoué). Valeurs pour 100 g nulles = inconnues (jamais 0) ; `food_ref` est une référence d'information, jamais une clé.
 */
const RECIPE_INGREDIENT_TABLE = table(
  'recipe_ingredient',
  [
    uuidId('recipe_id'),
    c('position', 'int', false),
    c('name', 'text', false, { max: 120 }),
    c('source', 'enum', false, { values: ['custom', 'ciqual', 'off'] }),
    c('food_ref', 'text', true, { max: ID_MAX }),
    c('grams', 'real', false),
    c('kcal_100g', 'real', true),
    c('protein_100g', 'real', true),
    c('fat_100g', 'real', true),
    c('carb_100g', 'real', true),
    c('fiber_100g', 'real', true),
    createdAt,
    deletedAt,
  ],
  { parents: [{ column: 'recipe_id', table: 'recipe' }], titleSource: { kind: 'own', column: 'name' } },
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Catalogue I5-01 (§ 9.1, § 16.4, § 20.2, migration 0010) : résumés de récupération, écrits par l'iPhone seul
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * `recovery_day` : résumé du jour calculé par l'iPhone (D-69), lu par le PC sans recalcul. Identifiant naturel `recovery|AAAA-MM-JJ` (un
 * recalcul du même jour écrit la même ligne ; fusion par champ, dernière écriture HLC gagne). « L'iPhone écrit, le PC lit » n'est pas une règle
 * du catalogue (une ligne REÇUE s'applique partout) : le dépôt d'un appareil lecteur n'écrit jamais ces tables (`RepositoryOptions`).
 * Toutes les colonnes sont des estimations recalculées ou des mesures du jour (`hrv_ms`, `resting_hr`) : masquées du journal des conflits,
 * aucune valeur corporelle n'y entre ; seule la suppression y est visible. Les échantillons (`recovery_sample`) et l'état d'import
 * (`recovery_import_state`) sont LOCAUX : absents du catalogue, jamais publiés.
 */
const RECOVERY_DAY_TABLE = table(
  'recovery_day',
  [
    c('date', 'date', false, hidden),
    c('level', 'enum', false, { values: ['A', 'B', 'C'], ...hidden }),
    c('recovery', 'int', true, hidden),
    c('abstain_reason', 'enum', true, { values: ['measure_missing_hrv', 'measure_missing_rhr', 'baseline_incomplete', 'zero_variance'], ...hidden }),
    c('quality', 'enum', false, { values: ['good', 'partial', 'insufficient'], ...hidden }),
    c('exertion', 'real', false, hidden),
    c('exertion_prev_day', 'real', false, hidden),
    c('sleep_minutes', 'real', true, hidden),
    c('sleep_need_minutes', 'real', false, hidden),
    c('sleep_score', 'int', true, hidden),
    c('bedtime_sigma_minutes', 'real', true, hidden),
    c('target_zone_from', 'real', true, hidden),
    c('target_zone_to', 'real', true, hidden),
    c('hrv_ms', 'real', true, hidden),
    c('resting_hr', 'real', true, hidden),
    c('learning_nights', 'int', false, hidden),
    c('contributors', 'json', false, hidden),
    c('explanation_keys', 'json', false, hidden),
    c('computed_at', 'datetime', false, hidden),
    c('engine_version', 'int', false, hidden),
    createdAt,
    deletedAt,
  ],
  { idKind: 'natural', natural: { is: isRecoveryDayId, expected: (row) => expectedRecoveryDayId(row) }, titleSource: { kind: 'own', column: 'date' } },
);

/** `muscle_recovery` : récupération estimée d'un muscle pour un jour, `muscle|AAAA-MM-JJ|<muscle>` ; aucune clé étrangère (lien logique au jour). */
const MUSCLE_RECOVERY_TABLE = table(
  'muscle_recovery',
  [
    c('date', 'date', false, hidden),
    c('muscle_id', 'text', false, { max: MUSCLE_RECOVERY_MUSCLE_ID_MAX, ...hidden }),
    c('muscle_group', 'text', false, { max: 64, ...hidden }),
    c('percent', 'int', false, hidden),
    c('hours', 'real', false, hidden),
    c('last_worked_at', 'datetime', false, hidden),
    c('ready_at', 'datetime', false, hidden),
    createdAt,
    deletedAt,
  ],
  { idKind: 'natural', natural: { is: isMuscleRecoveryId, expected: (row) => expectedMuscleRecoveryId(row) }, titleSource: { kind: 'own', column: 'muscle_id' } },
);

/**
 * Catalogue I6-01 (§ 16.7, § 20.2, migration 0011, schéma 11) : `recovery_factor`, journal de facteurs, écrit par les DEUX appareils. Identifiant naturel
 * `recovery_factor|AAAA-MM-JJ` (la veille du matin de saisie). Fusion champ par champ par HLC, dernière écriture gagne : deux saisies différentes du même
 * jour convergent sur la plus récente. Les facteurs (alcool, stress, maladie...) sont des habitudes de vie : masqués du journal des conflits, seule la
 * suppression y est visible. « Rien de particulier » (`none` = 1, tableau vide) est distinct d'un jour non renseigné (ligne absente ou supprimée).
 */
const RECOVERY_FACTOR_TABLE = table(
  'recovery_factor',
  [c('date', 'date', false, hidden), c('factors', 'json', false, hidden), bool('none', hidden), createdAt, deletedAt],
  { idKind: 'natural', natural: { is: isRecoveryFactorId, expected: (row) => expectedRecoveryFactorId(row) }, titleSource: { kind: 'own', column: 'date' } },
);

/**
 * Catalogue I6-02 (§ 17.1, § 20.2, migration 0012, schéma 12) : `measurement`, mensurations en cm, écrites par les DEUX appareils. Identifiant naturel
 * `measurement|AAAA-MM-JJ|genre` : la même mesure saisie des deux côtés converge sur la plus récente (HLC, champ par champ). Données corporelles :
 * masquées du journal des conflits, seule la suppression y est visible.
 */
const MEASUREMENT_TABLE = table(
  'measurement',
  [c('date', 'date', false, hidden), c('kind', 'text', false, { max: 32, conflictVisible: false }), c('value', 'real', false, hidden), createdAt, deletedAt],
  { idKind: 'natural', natural: { is: isMeasurementId, expected: (row) => expectedMeasurementId(row) }, titleSource: { kind: 'own', column: 'date' } },
);

/**
 * Catalogue I6-02 : `progress_photo`, FICHE d'une photo de progression, MÉTADONNÉES SEULEMENT (date, nom de fichier). Le fichier image reste sur
 * l'appareil qui l'a pris (table locale `progress_photo_file`, jamais au catalogue, jamais exportée) : l'autre appareil voit la fiche, pas l'image
 * (D-99). Identifiant UUID (plusieurs photos le même jour).
 */
const PROGRESS_PHOTO_TABLE = table(
  'progress_photo',
  [c('date', 'date', false, hidden), c('file_name', 'text', false, { max: 64, conflictVisible: false }), createdAt, deletedAt],
  { titleSource: { kind: 'own', column: 'date' } },
);

/**
 * Catalogue FIX-0181 (D-171, D-79 révisée par Ali le 12/11 ; migration 0015, schéma 15) : `food_favorite`, favoris de la recherche d'aliments, écrits par les
 * DEUX appareils. Identifiant naturel `favorite|<ref>` : le même aliment mis en favori des deux côtés donne une ligne. Fusion champ par champ par HLC,
 * dernière écriture gagne (suppression sur un appareil, rétablissement sur l'autre). Rien de corporel, mais rien d'utile à lire au journal des conflits :
 * seule la suppression y est visible.
 */
const FOOD_FAVORITE_TABLE = table(
  'food_favorite',
  [c('source', 'text', false, { max: 16, conflictVisible: false }), c('ref', 'text', false, { max: 64, conflictVisible: false }), c('added_at', 'datetime', false, hidden), createdAt, deletedAt],
  { idKind: 'natural', natural: { is: isFavoriteId, expected: (row) => expectedFavoriteId(row) }, titleSource: { kind: 'own', column: 'ref' } },
);

/**
 * Catalogue RESET-01 (D-183, ADR 0011 avenant 36 ; migration 0016, schéma 16) : `data_reset`, une ligne par remise à zéro des données ; son hlc est
 * l'horizon (`src/domain/dataReset.ts`). Aucune donnée de l'utilisateur, jamais modifiée ni purgée (identifiants hors purge), rien au journal des conflits.
 */
export const DATA_RESET_TABLE = 'data_reset';
const DATA_RESET_TABLE_DEF = table(DATA_RESET_TABLE,[c('created_at', 'datetime', false, hidden), c('deleted_at', 'datetime', true, hidden)], { purgeable: false, titleSource: { kind: 'none' } });

/**
 * Catalogue I6-05 (§ 15.3, D-210) : `supplement` (compléments, UUID) et `supplement_intake` (prises cochées, `intake|<complément>|<date>|<heure>`),
 * écrits par les DEUX appareils, sans parent publié (lien logique par `supplement_id`). La même prise cochée des deux côtés donne une ligne ; fusion
 * champ par champ par HLC, dernière écriture gagne. Journal des conflits : nom, état et suppression du complément ; suppression de la prise.
 */
const SUPPLEMENT_DAY_MASKS: readonly number[] = Array.from({ length: 127 }, (_, i) => i + 1);
const SUPPLEMENT_TABLE = table(
  'supplement',
  [
    c('name', 'text', false, { max: 80 }),
    c('dose', 'real', true, hidden),
    c('unit', 'text', true, { max: 16, conflictVisible: false }),
    c('times', 'json', false, { max: 64, conflictVisible: false }),
    c('days', 'int', false, { values: SUPPLEMENT_DAY_MASKS, conflictVisible: false }),
    bool('active'),
    createdAt,
    deletedAt,
  ],
  { titleSource: { kind: 'own', column: 'name' } },
);
const SUPPLEMENT_INTAKE_TABLE = table(
  'supplement_intake',
  [c('supplement_id', 'id', false, hidden), c('date', 'date', false, hidden), c('moment', 'time', false, hidden), c('taken_at', 'datetime', false, hidden), createdAt, deletedAt],
  { idKind: 'natural', natural: { is: isIntakeId, expected: (row) => expectedIntakeId(row) }, titleSource: { kind: 'own', column: 'date' } },
);

/**
 * Catalogue I6-06 (D-221, D-222 ; migration 0018, schéma 18) : `cardio_session`, séances cardio saisies, écrites par les DEUX appareils, identifiant UUID.
 * Fusion champ par champ par HLC, dernière écriture gagne. Le tracé GPS (table locale des tracés) est absent du catalogue, jamais publié ni exporté ;
 * seules la durée et la distance passent. `kind` est un texte court (non fermé : un type ajouté par une version plus récente reste lisible, « autre ») ;
 * la FC moyenne (donnée corporelle) est masquée du journal des conflits.
 */
const CARDIO_SESSION_TABLE = table(
  'cardio_session',
  [
    c('kind', 'text', false, { max: 32 }),
    c('started_at', 'datetime', false),
    c('duration_sec', 'int', false),
    c('distance_m', 'real', true),
    c('avg_hr', 'int', true, hidden),
    c('rpe', 'int', false, { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
    c('source', 'enum', false, { values: ['manual', 'gps'] }),
    c('notes', 'text', false, { max: 2_000 }),
    createdAt,
    deletedAt,
  ],
  { titleSource: { kind: 'none' } },
);

/** Catalogue de production (I0 + I1-01 + I1-03 + I2-01 + I3-02 + I4-02 + I4-07 + I5-01 + I6-01 + I6-02 + FIX-0181 + RESET-01 + I6-05 + I6-06) : l'ordre est `SYNC_TABLE_ORDER`. `settings` n'est pas publié (D-55). */
export const SYNC_CATALOGUE: SyncCatalogue = createCatalogue({
  tables: [
    PROFILE_TABLE,
    BODY_WEIGHT_TABLE,
    EXERCISE_TABLE,
    EQUIPMENT_PROFILE_TABLE,
    ROUTINE_TABLE,
    ROUTINE_DAY_TABLE,
    ROUTINE_EXERCISE_TABLE,
    WORKOUT_TABLE,
    WORKOUT_SET_TABLE,
    PROGRESSION_PROFILE_TABLE,
    RECOMMENDATION_DECISION_TABLE,
    MESOCYCLE_TABLE,
    FOOD_TABLE,
    FOOD_PORTION_TABLE,
    MEAL_ENTRY_TABLE,
    NUTRITION_TARGET_TABLE,
    DAY_COMPLETENESS_TABLE,
    RECIPE_TABLE,
    RECIPE_INGREDIENT_TABLE,
    RECOVERY_DAY_TABLE,
    MUSCLE_RECOVERY_TABLE,
    RECOVERY_FACTOR_TABLE,
    MEASUREMENT_TABLE,
    PROGRESS_PHOTO_TABLE,
    FOOD_FAVORITE_TABLE,
    DATA_RESET_TABLE_DEF,
    SUPPLEMENT_TABLE,
    SUPPLEMENT_INTAKE_TABLE,
    CARDIO_SESSION_TABLE,
  ],
  order: SYNC_TABLE_ORDER,
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Validation (section 3.3 : type et longueur)
// ---------------------------------------------------------------------------------------------------------------------------------

/** La valeur respecte-t-elle le type et la longueur déclarés de la colonne ? (UUID seul pour une colonne `id` ; voir `SyncCatalogue.isValidValue`.) */
export function isValidValue(col: SyncColumn, value: unknown): boolean {
  if (value === null) return col.nullable;
  switch (col.type) {
    case 'text':
      return typeof value === 'string' && value.length <= (col.max ?? SHORT_TEXT);
    case 'json':
      if (typeof value !== 'string' || value.length > (col.max ?? JSON_TEXT)) return false;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case 'int':
      return typeof value === 'number' && Number.isSafeInteger(value) && (col.values === undefined || col.values.includes(value));
    case 'real':
      return typeof value === 'number' && Number.isFinite(value);
    case 'bool':
      return value === 0 || value === 1;
    case 'date':
      return typeof value === 'string' && isLocalDate(value);
    case 'time':
      return typeof value === 'string' && isLocalTime(value);
    case 'datetime':
      return typeof value === 'string' && isIsoDateTime(value);
    case 'localdatetime':
      return typeof value === 'string' && isLocalDateTime(value);
    case 'id':
      return typeof value === 'string' && value.length <= MAX_SYNC_ID_LENGTH && isId(value);
    case 'enum':
      return typeof value === 'string' && (col.values ?? []).includes(value);
  }
}
