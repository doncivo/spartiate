import type { AppleCreateSetting, AppleListsSetting, ApplePending } from '../appleReminders';
import type { FocusDuration } from '../focusSession';
import type { DeviceId, IsoDateTime, LocalTime, SpaceFilter, SpaceId } from '../types';
import type { ReminderOffsetMin } from './reminder';
import type { TimeFormat } from '../timeFormat';
import type { FirstWeekday } from '../week';

/** P-02 : choix de thème. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * Réglages typés (table `settings` : key TEXT unique, value JSON).
 *
 * - `shared` : préférence partagée entre appareils, synchronisée (PRD 6 : thème,
 *   espaces, premier jour…) ; la ligne porte updated_at, device_id et hlc ;
 * - `local` : propre à l'appareil, jamais envoyé dans les journaux de synchro.
 *
 * Ajouter un réglage : une entrée dans `SettingsValues` ET dans `SETTINGS_DEFINITIONS`
 * (le typage l'impose). Une clé absente en base vaut sa valeur par défaut ; une clé
 * inconnue lue en base (version plus récente) est conservée telle quelle (Y-07).
 */
export interface SettingsValues {
  /** T-06 : report automatique à 00:00 des tâches non faites. */
  'tasks.carryOverUndone': boolean;
  /** A-03 : masquer les routines dans la liste du jour. */
  'today.hideRoutines': boolean;
  /** A-06 / SD-04 : vue compacte mémorisée par écran. */
  'view.compact': { readonly today: boolean; readonly routines: boolean; readonly checklists: boolean; readonly someday: boolean };
  /** RC-04 : dix dernières recherches validées (la plus récente en premier) ; propre à l'appareil, jamais synchronisée ni partagée. */
  'search.recent': readonly string[];
  /** ES-03 : dernier filtre choisi (mémorisé par appareil). */
  'spaces.filter': SpaceFilter;
  /** UI-FIX-08 (PRD-02, lot F) : fériés masqués dans la liste Événements de l'iPhone ; choix d'affichage propre à l'appareil. */
  'events.hideHolidays': boolean;
  /** ES-02 : espace des nouveaux éléments quand le filtre vaut « Tout ». */
  'spaces.defaultSpaceId': SpaceId | null;
  /** N-02 : avances proposées par défaut à la création (sous-ensemble de REMINDER_OFFSETS_MIN). */
  'reminders.defaultOffsets': readonly ReminderOffsetMin[];
  /** N-04 : récapitulatif du matin (liste du jour). */
  'reminders.morningRecap': { readonly enabled: boolean; readonly time: LocalTime };
  /** N-04 : récapitulatif du soir (non fait). */
  'reminders.eveningRecap': { readonly enabled: boolean; readonly time: LocalTime };
  /** P-03 / ADR 0003. */
  /** P-03 : premier jour de la semaine affichée (Semaine, mini-calendriers, carte de chaleur) ; partagé. Objectifs, rapport et R-07 restent au lundi. */
  'general.firstWeekday': FirstWeekday;
  /** P-03 : format d'affichage des heures (les valeurs stockées restent 'HH:mm', 24 h). */
  'general.timeFormat': TimeFormat;
  /** P-02 : thème de cet appareil (un PC et un iPhone peuvent différer). */
  'ui.theme': ThemeChoice;
  /** Ancien réglage partagé, remplacé par `ui.theme` (local, P-02 D1) ; non utilisé. */
  'general.theme': 'system' | 'light' | 'dark';
  /** E-03 : calendriers de jours fériés activés (France, Tunisie), tous deux par défaut ; partagé entre appareils. */
  'holidays.countries': { readonly FR: boolean; readonly TN: boolean };
  /** T-11 : dernier fuseau IANA détecté sur cet appareil (affiché dans Réglages). */
  'general.timeZone': string | null;
  /** P-05 : l'onboarding est terminé ou passé (jamais rouvert tout seul) ; local. */
  'onboarding.completed': boolean;
  /** I3-07 (D-110) : brouillon de l'onboarding en 8 écrans, valeur BRUTE lue par `parseDraft` (src/domain/onboarding) ; locale, jamais synchronisée. */
  'onboarding.draft': unknown;
  /**
   * FIX-0171 (constat 6, D-124) : réponses d'un assistant TERMINÉ qui n'ont pas d'autre place (rythme, disponibilité, priorités…), valeur BRUTE
   * lue par `parseDraft` ; le brouillon (`onboarding.draft`) ne sert plus qu'à un assistant inachevé. Locale, jamais synchronisée.
   */
  'onboarding.answers': unknown;
  /** Reste de l'ancien projet : ids de données d'exemple (aucun usage ; nettoyage en CLEAN-01) ; local. */
  'sample.ids': { readonly tasks: readonly string[]; readonly routines: readonly string[]; readonly checklists: readonly string[] };
  /** D-01 : fermer la fenêtre réduit l'app en zone de notification (PC). */
  'desktop.closeToTray': boolean;
  /** D-02 : démarrage avec Windows, réduit. */
  'desktop.launchAtStartup': boolean;
  /** D-03 : dernière vérification de mise à jour (toutes les 24 h). Pas d'« ignorer cette version » (QB-16). */
  'desktop.updater': {
    readonly lastCheckAt: IsoDateTime | null;
    /** Dernier échec durable (vérification ou installation), effacé au succès ; persiste après redémarrage. */
    readonly lastFailure?: { readonly stage: 'check' | 'install'; readonly kind: 'signature' | 'other' } | null;
  };
  /** D-04 : capture rapide globale (PC), combinaison en notation du registre ; local à l'appareil. */
  'shortcut.quickCapture': { readonly enabled: boolean; readonly keys: string };
  /** F-01 critère 12 : dernière durée de session choisie (minutes ; null = « Libre »), propre à l'appareil. */
  'focus.lastDuration': FocusDuration;
  /** F-04 : son de fin de session (Réglages › TÂCHES), propre à l'appareil, activé par défaut. */
  'focus.endSound': boolean;
  /** F-01 critère 3 : position de la mini-fenêtre Focus du PC (pixels physiques), propre à l'appareil. */
  'focus.windowPosition': { readonly x: number; readonly y: number } | null;
  /** ADR 0005 : identifiant de cet appareil, créé au premier lancement. */
  'device.id': DeviceId | null;
  /**
   * N-01 (ADR 0012 avenant N1.2) : registre local des notifications planifiées sur cet iPhone (identifiants, instants, empreintes, aucun
   * titre). Valeur BRUTE : lue par `parseNotificationLedger` (une valeur illisible fait tout replanifier une fois) ; jamais synchronisée.
   */
  'notifications.ledger': unknown;
  /** N-01 (avenant N1.3) : état persistant des rappels (autorisation, dernière planification, échecs). Valeur BRUTE lue par `parseNotificationStatus` ; locale. */
  'notifications.status': unknown;
  /** N-03 (avenant N3.4) : file durable des actions « Fait » et « +15 min » reçues de la notification, répétitions vivantes. Valeur BRUTE lue par `parseActionQueue` ; locale, jamais synchronisée. */
  'notifications.actionQueue': unknown;
  /** K-05 (ADR 0008 §10.3) : listes Rappels choisies, avec leur espace et leur nom lisible sur le PC ; partagé. Valeur à relire par `parseAppleLists`. */
  'appleReminders.lists': AppleListsSetting;
  /** K-06 : création dans Rappels par espace (désactivée par défaut) ; partagé. Valeur à relire par `parseAppleCreate`. */
  'appleReminders.create': AppleCreateSetting;
  /** K-05 critère 14, K-07 : dernière lecture réussie de Rappels par l'iPhone (une écriture au plus tous les 15 min) ; partagé. */
  'appleReminders.lastPassAt': IsoDateTime | null;
  /** K-06 critère 8, K-07 critère 8 : écritures dues vers Rappels (nombre et heure), publié par l'iPhone ; partagé. */
  'appleReminders.pending': ApplePending | null;
  /** ADR 0008 §10.3 : échec persistant, plafonds, suppressions retenues, liens inconnus, messages ; LOCAL. Valeur BRUTE lue par `parseAppleStatus` ; jamais de titre. */
  'appleReminders.status': unknown;
  /**
   * I-03 (ADR 0013 §2.3) : verrouillage de l'app par Face ID ou code de l'iPhone. Valeur BRUTE lue par `parseAppLockSetting` (illisible :
   * verrouillé, échec fermé) ; locale, jamais synchronisée ni observée par la replanification.
   */
  'security.appLock': unknown;
  /** I-02 (ADR 0013 §3.3) : dernière date d'expiration lue, échec, alerte en attente. Valeur BRUTE lue par `parseSigningStatus` ; locale. */
  'notifications.signing': unknown;
  /**
   * I-06 (ADR 0007 avenant I-06 point 6) : version de l'app au dernier démarrage réussi sur cet appareil ; un changement au démarrage =
   * premier lancement d'une nouvelle version (replanification complète des rappels, journal `app-updated`). Locale, jamais synchronisée.
   */
  'app.lastLaunchedVersion': string | null;
  /**
   * K-01 (revue PR #25) : RÉFÉRENCES du coffre (jamais les secrets) d'une connexion d'agenda abandonnée dont l'effacement a échoué ;
   * relues au chargement (« Réessayer l'effacement » survit à un redémarrage). Valeur BRUTE lue par `parseOrphanSecrets` ; locale.
   */
  'calendars.orphanSecrets': unknown;
  /** SPA-007 : minuteur de test de 60 s (date de fin et libellé), pour le reprendre après une fermeture. Valeur BRUTE lue par `parseSyntheticTimer` ; locale, jamais synchronisée. */
  'timer.synthetic': unknown;
  /** Clôture I0 : Santé a répondu « entitlement manquant » (compte Apple gratuit, D-69) ; l'écran Apple Santé et la ligne de Plus le disent sans attendre une nouvelle demande. Locale. */
  'healthkit.entitlementMissing': boolean;
  /** I1-01 (§ 14.3) : identifiant du profil de matériel actif sur cet appareil ; préférence locale, jamais publiée (les profils le sont). */
  'training.activeEquipmentProfile': string | null;
  /** I1-02 : « Repos par défaut » de l'écran de séance (secondes, 1 à 3600) quand la routine n'en fixe pas ; null = repos de l'exercice. Local. */
  'training.restSeconds': number | null;
  /** 0.2.4 point 6 : séance close dont la question « Mettre à jour la routine ? » attend encore une réponse (app fermée pendant le résumé) ; effacée à la réponse. Local. */
  'training.routineUpdateAsk': string | null;
  /**
   * I4-08 : séance proposée en cours, sa routine source et le RIR cible par exercice (valeur BRUTE lue par `parseSessionLink`,
   * src/features/training/cycle/sessionLink.ts) ; écrite avec la séance, ne vaut que pour elle. Locale, jamais synchronisée.
   */
  'training.cycleSession': unknown;
  /** I5-02 point 2.2 : choix d'Ali devant la journée rouge de la séance en cours (valeur BRUTE lue par `parseRedDayChoice`, src/features/training/session/redDayState.ts) ; ne vaut que pour cette séance. Locale, jamais synchronisée. */
  'training.redDay': unknown;
  /** I4-03 : préférences de nutrition (style du check-in, objectif, activité déclarée, jour). Valeur BRUTE lue par `parseNutritionPrefs` ; locale, jamais synchronisée. */
  'nutrition.prefs': unknown;
  /** I4-06 : favoris de la recherche d'aliments, valeur BRUTE lue par `parseFavorites` ({ v: 1, items }) ; locale, jamais synchronisée (D-79). FIX-0181 (D-171) : lue une seule fois pour la reprise dans la table publiée `food_favorite`, puis remise à null. */
  'nutrition.favorites': unknown;
  /** I5-02 (point 2.3) : notifications de récupération (coucher, matin), désactivées par défaut. Valeur BRUTE lue par `parseRecoveryNotificationPrefs` ; locale, jamais synchronisée. */
  'recovery.notificationPrefs': unknown;
  /** I6-05 (D-212) : rappels de compléments sur cet appareil (iPhone), désactivés par défaut. Valeur BRUTE lue par `parseSupplementNotificationPrefs` ; locale, jamais synchronisée. */
  'supplements.notificationPrefs': unknown;
  /** I5-02 (point 2.3) : dernière heure de coucher proposée (calculée à l'import). Valeur BRUTE lue par `parseBedtimeProposalSetting` ; locale, jamais synchronisée. */
  'recovery.bedtimeProposal': unknown;
  /** I5-06 : version de la règle du sommeil avec laquelle les résumés des 30 derniers jours ont été calculés (null : jamais). Locale, jamais synchronisée. */
  'recovery.sleepRulesVersion': unknown;
  /** I6-04 (D-113) : résumé du dernier import Renpho / Santé (date, comptes par fichier et pour la nutrition, jamais une valeur). Valeur BRUTE lue par `parseBodyImportSummary` ; locale, jamais synchronisée. */
  'healthBody.lastImport': unknown;
  /** FIX-0171 (D-121) : fiches de photos masquées sur cet appareil (« Masquer sur cet appareil »). Valeur BRUTE lue par `parseHiddenPhotoIds` ; locale, jamais synchronisée ni exportée. */
  'bodyProgress.hiddenPhotos': unknown;
}

export type SettingKey = keyof SettingsValues;
export type SettingScope = 'local' | 'shared';

export interface SettingDefinition<K extends SettingKey> {
  readonly scope: SettingScope;
  readonly defaultValue: SettingsValues[K];
}

export const SETTINGS_DEFINITIONS: { readonly [K in SettingKey]: SettingDefinition<K> } = {
  'tasks.carryOverUndone': { scope: 'shared', defaultValue: true },
  'today.hideRoutines': { scope: 'shared', defaultValue: false },
  'view.compact': { scope: 'local', defaultValue: { today: false, routines: false, checklists: false, someday: false } },
  'search.recent': { scope: 'local', defaultValue: [] },
  'spaces.filter': { scope: 'local', defaultValue: 'all' },
  'events.hideHolidays': { scope: 'local', defaultValue: false },
  'spaces.defaultSpaceId': { scope: 'shared', defaultValue: null },
  'reminders.defaultOffsets': { scope: 'shared', defaultValue: [0] },
  'reminders.morningRecap': { scope: 'shared', defaultValue: { enabled: true, time: '07:30' as LocalTime } },
  'reminders.eveningRecap': { scope: 'shared', defaultValue: { enabled: true, time: '21:00' as LocalTime } },
  'general.firstWeekday': { scope: 'shared', defaultValue: 'monday' },
  'general.timeFormat': { scope: 'shared', defaultValue: '24h' },
  'ui.theme': { scope: 'local', defaultValue: 'dark' },
  'general.theme': { scope: 'shared', defaultValue: 'system' },
  'holidays.countries': { scope: 'shared', defaultValue: { FR: true, TN: true } },
  'general.timeZone': { scope: 'local', defaultValue: null },
  'onboarding.completed': { scope: 'local', defaultValue: false },
  'onboarding.draft': { scope: 'local', defaultValue: null },
  'onboarding.answers': { scope: 'local', defaultValue: null },
  'sample.ids': { scope: 'local', defaultValue: { tasks: [], routines: [], checklists: [] } },
  'desktop.closeToTray': { scope: 'local', defaultValue: true },
  'desktop.launchAtStartup': { scope: 'local', defaultValue: false },
  'desktop.updater': { scope: 'local', defaultValue: { lastCheckAt: null } },
  'shortcut.quickCapture': { scope: 'local', defaultValue: { enabled: true, keys: 'Ctrl+Alt+Space' } },
  'focus.lastDuration': { scope: 'local', defaultValue: 25 },
  'focus.endSound': { scope: 'local', defaultValue: true },
  'focus.windowPosition': { scope: 'local', defaultValue: null },
  'device.id': { scope: 'local', defaultValue: null },
  'notifications.ledger': { scope: 'local', defaultValue: null },
  'notifications.status': { scope: 'local', defaultValue: null },
  'notifications.actionQueue': { scope: 'local', defaultValue: null },
  'appleReminders.lists': { scope: 'shared', defaultValue: { lists: [] } },
  'appleReminders.create': { scope: 'shared', defaultValue: { bySpace: [] } },
  'appleReminders.lastPassAt': { scope: 'shared', defaultValue: null },
  'appleReminders.pending': { scope: 'shared', defaultValue: null },
  'appleReminders.status': { scope: 'local', defaultValue: null },
  'security.appLock': { scope: 'local', defaultValue: false },
  'notifications.signing': { scope: 'local', defaultValue: null },
  'app.lastLaunchedVersion': { scope: 'local', defaultValue: null },
  'calendars.orphanSecrets': { scope: 'local', defaultValue: null },
  'timer.synthetic': { scope: 'local', defaultValue: null },
  'healthkit.entitlementMissing': { scope: 'local', defaultValue: false },
  'training.activeEquipmentProfile': { scope: 'local', defaultValue: null },
  'training.restSeconds': { scope: 'local', defaultValue: null },
  'training.routineUpdateAsk': { scope: 'local', defaultValue: null },
  'training.cycleSession': { scope: 'local', defaultValue: null },
  'training.redDay': { scope: 'local', defaultValue: null },
  'nutrition.prefs': { scope: 'local', defaultValue: null },
  'nutrition.favorites': { scope: 'local', defaultValue: null },
  'recovery.notificationPrefs': { scope: 'local', defaultValue: null },
  'supplements.notificationPrefs': { scope: 'local', defaultValue: null },
  'recovery.bedtimeProposal': { scope: 'local', defaultValue: null },
  'recovery.sleepRulesVersion': { scope: 'local', defaultValue: null },
  'healthBody.lastImport': { scope: 'local', defaultValue: null },
  'bodyProgress.hiddenPhotos': { scope: 'local', defaultValue: null },
};

/** Valeur par défaut d'un réglage. */
export function defaultSetting<K extends SettingKey>(key: K): SettingsValues[K] {
  return SETTINGS_DEFINITIONS[key].defaultValue;
}

export function isSharedSetting(key: SettingKey): boolean {
  return SETTINGS_DEFINITIONS[key].scope === 'shared';
}
