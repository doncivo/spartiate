import type { SettingKey } from './model/settings';
import type { Hlc } from './types';

/**
 * RESET-01 (D-180 à D-186, décision d'Ali du 12/11) : « Repartir de zéro ». Règles pures : mot de confirmation, sort de chaque table et de
 * chaque réglage, horizon de remise à zéro. Aucune requête ici (dépôt `dataResetRepository`, moteur `src/sync/dataReset.ts`).
 *
 * Mécanisme (ADR 0011, avenant 36) : une remise à zéro est UNE ligne publiée de la table `data_reset`, dont le hlc est l'HORIZON `H`. Tout ce
 * qui a été écrit avant `H` (hlc du champ, ou base du champ, inférieur ou égal à `H`) est effacé sur chaque appareil qui apprend `H`, et n'est
 * plus jamais accepté ensuite (journal ancien, instantané ancien, appareil en retard, report d'époque). Ce qui est écrit après `H` circule
 * normalement.
 */

/** Table publiée qui porte les remises à zéro (migration 0016, `syncTables.ts`). Jamais effacée : elle EST l'horizon. */
export { DATA_RESET_TABLE } from './sync/syncTables';
/** Filtre d'application (`merge.ts`, module du départ lu par `apply.ts`). */
export { isBeforeReset } from './sync/merge';

/** Mot à taper pour confirmer (D-182) : un seul geste ne suffit jamais. */
export const RESET_CONFIRMATION_WORD = 'EFFACER';

/** Confirmation exacte : le mot en capitales, espaces autour tolérés ; « effacer », « EFFACE » ou vide sont refusés. */
export function isResetConfirmed(input: string): boolean {
  return input.trim() === RESET_CONFIRMATION_WORD;
}

export type ResetFate = 'wiped' | 'kept';

/**
 * Sort de CHAQUE table du schéma (D-181). Un test énumère les tables d'une base migrée et échoue si une table n'est pas classée ici : toute
 * table nouvelle doit être déclarée « effacée » ou « gardée » par le ticket qui la crée.
 * - effacées : toutes les données de l'utilisateur (publiées ou locales), conflits et comptes rendus de report (ils contiennent des valeurs) ;
 * - gardées : réglages (table `settings`, tri clé par clé ci-dessous), technique de synchro (appairage, curseurs, état ; leurs entrées sur les
 *   lignes effacées sont retirées avec elles), registre des migrations, et `data_reset` elle-même.
 */
export const RESET_TABLES: Readonly<Record<string, ResetFate>> = {
  // Publiées (catalogue de synchro).
  profile: 'wiped',
  body_weight: 'wiped',
  exercise: 'wiped',
  equipment_profile: 'wiped',
  routine: 'wiped',
  routine_day: 'wiped',
  routine_exercise: 'wiped',
  workout: 'wiped',
  workout_set: 'wiped',
  progression_profile: 'wiped',
  recommendation_decision: 'wiped',
  mesocycle: 'wiped',
  food: 'wiped',
  food_portion: 'wiped',
  meal_entry: 'wiped',
  nutrition_target: 'wiped',
  day_completeness: 'wiped',
  recipe: 'wiped',
  recipe_ingredient: 'wiped',
  recovery_day: 'wiped',
  muscle_recovery: 'wiped',
  recovery_factor: 'wiped',
  measurement: 'wiped',
  progress_photo: 'wiped',
  food_favorite: 'wiped',
  cardio_session: 'wiped',
  // Locales.
  progress_photo_file: 'wiped',
  cardio_track: 'wiped',
  recovery_sample: 'wiped',
  recovery_import_state: 'wiped',
  conflict_log: 'wiped',
  epoch_carry_report: 'wiped',
  settings: 'kept',
  schema_migrations: 'kept',
  sync_guard: 'kept',
  sync_meta: 'kept',
  sync_state: 'kept',
  sync_outbox: 'kept',
  sync_field_clock: 'kept',
  sync_tombstone: 'kept',
  sync_unknown: 'kept',
  sync_parked: 'kept',
  data_reset: 'kept',
};

/** Tables locales effacées entièrement (aucune horloge : rien d'écrit « après » ne peut y être distingué sur un appareil qui reçoit `H`). */
export const RESET_LOCAL_TABLES = ['recovery_sample', 'recovery_import_state', 'conflict_log', 'epoch_carry_report'] as const;

/**
 * Sort de CHAQUE réglage (D-181) : gardés = réglages de l'appareil (apparence, notifications, raccourcis, identité, verrou, mises à jour) ;
 * effacés = état de l'onboarding, préférences et objectifs de nutrition, état de séance, profil de matériel actif (le profil embarqué par défaut
 * reprend sa place, comme au premier lancement), dernier import Santé et Renpho, photos masquées, favoris locaux hérités, recherches récentes.
 */
export const RESET_SETTINGS: Readonly<Record<SettingKey, ResetFate>> = {
  'tasks.carryOverUndone': 'kept',
  'today.hideRoutines': 'kept',
  'view.compact': 'kept',
  'search.recent': 'wiped',
  'spaces.filter': 'kept',
  'events.hideHolidays': 'kept',
  'spaces.defaultSpaceId': 'kept',
  'reminders.defaultOffsets': 'kept',
  'reminders.morningRecap': 'kept',
  'reminders.eveningRecap': 'kept',
  'general.firstWeekday': 'kept',
  'general.timeFormat': 'kept',
  'ui.theme': 'kept',
  'general.theme': 'kept',
  'holidays.countries': 'kept',
  'general.timeZone': 'kept',
  'onboarding.completed': 'wiped',
  'onboarding.draft': 'wiped',
  'onboarding.answers': 'wiped',
  'sample.ids': 'wiped',
  'desktop.closeToTray': 'kept',
  'desktop.launchAtStartup': 'kept',
  'desktop.updater': 'kept',
  'shortcut.quickCapture': 'kept',
  'focus.lastDuration': 'kept',
  'focus.endSound': 'kept',
  'focus.windowPosition': 'kept',
  'device.id': 'kept',
  'notifications.ledger': 'kept',
  'notifications.status': 'kept',
  'notifications.actionQueue': 'wiped',
  'appleReminders.lists': 'kept',
  'appleReminders.create': 'kept',
  'appleReminders.lastPassAt': 'kept',
  'appleReminders.pending': 'kept',
  'appleReminders.status': 'kept',
  'security.appLock': 'kept',
  'notifications.signing': 'kept',
  'app.lastLaunchedVersion': 'kept',
  'calendars.orphanSecrets': 'kept',
  'timer.synthetic': 'wiped',
  'healthkit.entitlementMissing': 'kept',
  'training.activeEquipmentProfile': 'wiped',
  'training.restSeconds': 'kept',
  'training.routineUpdateAsk': 'wiped',
  'training.cycleSession': 'wiped',
  'training.redDay': 'wiped',
  'nutrition.prefs': 'wiped',
  'nutrition.favorites': 'wiped',
  'recovery.notificationPrefs': 'kept',
  'recovery.bedtimeProposal': 'wiped',
  'recovery.sleepRulesVersion': 'wiped',
  'healthBody.lastImport': 'wiped',
  'bodyProgress.hiddenPhotos': 'wiped',
};

/** Clés de réglage effacées, dans l'ordre de déclaration. */
export function wipedSettingKeys(): readonly SettingKey[] {
  return (Object.keys(RESET_SETTINGS) as SettingKey[]).filter((key) => RESET_SETTINGS[key] === 'wiped');
}

/** Plus grand des deux horizons (null : aucun). Les hlc de largeur fixe se comparent comme des chaînes (ADR 0005). */
export function laterHorizon(a: Hlc | null, b: Hlc | null): Hlc | null {
  if (a === null) return b;
  if (b === null) return a;
  return b > a ? b : a;
}

/**
 * D-187 : une archive d'export datée (manifeste) avant ou à l'instant du dernier effacement fait sur cet appareil est refusée à l'import : elle
 * ramènerait, réhorodatées, des données d'avant la remise à zéro. Date illisible : refus (échec fermé). Aucun effacement : admise.
 */
export function isArchiveBeforeReset(manifestDate: string, resetAtMs: number | null): boolean {
  if (resetAtMs === null) return false;
  const at = Date.parse(manifestDate);
  return !Number.isFinite(at) || at <= resetAtMs;
}

/** Comptes du journal `data-reset` : nombres seulement, jamais une valeur, un identifiant ni une date (D-186). */
export interface DataResetCounts {
  /** Lignes effacées (toutes tables). */
  readonly rows: number;
  /** Tables dont au moins une ligne a été effacée. */
  readonly tables: number;
  /** Réglages remis à leur valeur par défaut. */
  readonly settings: number;
}
