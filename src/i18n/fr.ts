import { scanFr } from './fr.scan';
import { captureFr } from './fr.capture';
import { notificationsFr, remindersStatusFr } from './fr.notifications';
import { appearanceFr } from './fr.appearance';
import { routinesFr } from './fr.routines';
import { eventsFr } from './fr.events';
import { shortcutsUiFr } from './fr.shortcuts';
import { backupFr } from './fr.backup';
import { importCsvFr } from './fr.importCsv';
import { syncEngineFr } from './fr.syncEngine';
import { syncFolderFr, syncKeyFr } from './fr.syncFolder';
import { syncConflictsFr } from './fr.syncConflicts';
import { syncFieldFr } from './fr.syncField';
import { syncVersionFr } from './fr.syncVersion';
import { syncPairingFr } from './fr.syncPairing';
import { syncForgetFr } from './fr.syncForget';
import { syncResetFr } from './fr.syncReset';
import { securityFr } from './fr.security';
import { signingFr } from './fr.signing';
import { appUpdateFr } from './fr.appUpdate';
/**
 * Textes de l'interface, en français : source de vérité (ADR 0003).
 * - Clés regroupées par écran / module, en camelCase ;
 * - paramètres entre accolades : « {count} tâches » ;
 * - toute nouvelle clé s'ajoute ici d'abord, puis dans en.ts (le typage l'impose).
 */
export const fr = {
  app: {
    name: 'Spartiate',
    loading: 'Chargement…',
    dbError: 'Impossible d’ouvrir la base de données.',
    screenError: 'Impossible d’afficher cet écran.',
    screenRetry: 'Réessayer',
    screenReload: 'Recharger',
    dbBackupError: 'Mise à jour des données interrompue : la sauvegarde de sécurité a échoué. Tes données n’ont pas été modifiées. Libère de l’espace disque puis relance Spartiate.',
    version: 'Version {version}',
    versionUnknown: 'Version inconnue',
    update: appUpdateFr,
    dbStalled: 'L’ouverture est peut-être encore en cours ; si rien ne change, touche « Réessayer ».',
    startError: 'Le démarrage de Spartiate a échoué.',
    crashTitle: 'Spartiate a rencontré une erreur d’affichage.',
    crashRetry: 'Relancer l’app',
    crashMigration: 'Une mise à jour des données est en cours : ne la relance pas. Si rien ne change, ferme puis rouvre Spartiate ; tes données déjà enregistrées sont intactes.',
    dbSlow: 'Une sauvegarde ou une mise à jour des données est en cours et peut prendre du temps : patiente, ne ferme pas l’app.',
    crashFallback: 'Le démarrage est bloqué et son écran de détail n’a pas pu se charger. Ferme puis rouvre Spartiate.',
    dbPoisoned: 'La base de données a été protégée après une erreur d’annulation : plus rien n’est enregistré. Ferme puis rouvre Spartiate ; tes données déjà enregistrées sont intactes.',
    diag: {
      title: 'Détail technique',
      step: 'Étape : {step}',
      error: 'Erreur : {name} : {message}',
      url: 'Base : {url}',
      configDir: 'Dossier : {path} (existe : {exists})',
      configDirError: 'Dossier introuvable : {message}',
      dbFile: 'Fichier : {path} (existe : {exists}, taille : {size})',
      wal: 'Journal WAL présent : {exists}',
      retry: 'Réessayer',
      stalled: 'Aucune réponse de la base de données depuis {seconds} s.',
      journalMode: 'Mode de journal effectif : {mode}',
      journalExpected: 'WAL attendu : la base n’a pas pu être ouverte en mode WAL.',
      pathsError: 'Chemins indisponibles : {message}',
      pathsPending: 'Chemins : lecture en cours…',
      environment: 'Environnement : {runtime}, système {os}, build {build}, version {version}',
      yes: 'oui',
      no: 'non',
      unknown: 'inconnu',
      copy: 'Copier le détail',
      copied: 'Détail copié.',
      copyFailed: 'Copie impossible : sélectionne le texte ci-dessus.',
      steps: {
        runtime: 'détection de l’app installée (isTauri() faux dans un build Tauri)',
        load: 'chargement du plugin SQL (Database.load)',
        pragma: 'réglages initiaux de la base (PRAGMA foreign_keys, journal_mode)',
        schema: 'lecture du schéma (ensureMigrationsTable, schema_migrations)',
        backup: 'sauvegarde avant migration (backup_database_before_migration)',
        migration: 'migration {version}',
        afterApply: 'fin des migrations (réintégration des champs de synchro)',
        other: 'autre',
        start: 'démarrage, base ouverte : {name}',
      },
    },
  },
  common: {
    close: 'Fermer',
    cancel: 'Annuler',
    retry: 'Réessayer',
  },
  // FILES-IOS-01 critère 9 : échec d'enregistrement d'un fichier (export, modèle, rapport, logs), visible avec son code.
  files: {
    errorCode: 'Code : {code}',
    retry: 'Réessayer',
    tooLarge: 'Fichier trop volumineux.',
    tooLargeHint: 'Réduis le contenu exporté (période plus courte, autre format), puis recommence.',
  },
  nav: {
    primaryLabel: 'Navigation principale',
    collapse: 'Replier la barre latérale',
    expand: 'Déployer la barre latérale',
    deviceCard: {
      label: 'État de cet appareil',
      device: 'PC · Bureau',
      noSync: 'Synchro iCloud : indisponible dans ce build',
    },
    tabs: {
      today: 'Aujourd’hui',
      training: 'Entraînement',
      nutrition: 'Nutrition',
      progress: 'Progrès',
      more: 'Plus',
    },
  },
  appearance: appearanceFr,
  // Synchronisation : section `status` (lot Y2 ; `restore` est à part, `fr.syncRestore.ts`, chargé à la demande) ; `folder` et `key` viennent du lot Y1 ;
  // lot Y3 : `conflicts` et `field` (Y-04), `version` (Y-07), `pairing` (Y-06) ; lot Y4 : `forget` (Y-10), `reset` (Y-11) ; chacune dans son fichier.
  sync: { ...syncEngineFr, folder: syncFolderFr, key: syncKeyFr, conflicts: syncConflictsFr, field: syncFieldFr, version: syncVersionFr, pairing: syncPairingFr, forget: syncForgetFr, reset: syncResetFr },
  tasks: {
    newTask: 'Nouvelle tâche',
    save: 'Enregistrer',
    complete: 'Terminer : {title}',
    reopen: 'Rouvrir : {title}',
    postpone: 'Reporter',
    deleteConfirmTitle: 'Supprimer « {title} » ?',
    deleteConfirm: 'Supprimer',
    seriesScopeOccurrence: 'Cette occurrence',
    seriesEditTitle: 'Modifier « {title} » ?',
  },
  reminders: {
    more: 'Plus…',
    editTitle: 'Rappels',
    saveError: 'Impossible d’enregistrer les rappels.',
    sectionTitle: 'RAPPELS',
    recaps: 'Récapitulatifs',
    status: remindersStatusFr,
  },
  notifications: notificationsFr,
  settings: {
    title: 'Plus',
    timeZone: 'Fuseau horaire',
    timeZoneAuto: '{zone} (automatique)',
    timeZoneUnknown: 'Inconnu',
    launchAtStartup: 'Démarrer avec Windows',
    autostartError: 'Impossible de modifier le démarrage avec Windows.',
    sectionAbout: 'À PROPOS',
    checkUpdates: 'Rechercher une mise à jour',
    checkingUpdates: 'Recherche en cours…',
    upToDate: 'Spartiate est à jour',
    updateCheckFailed: 'Impossible de vérifier les mises à jour',
    latestRelease: 'Dernière version',
    latestReleaseOpen: 'Ouvrir',
    latestReleaseOpenLabel: 'Ouvrir la page de la dernière version',
    openReleaseError: 'Impossible d’ouvrir la page de la dernière version.',
    loadError: 'Impossible de lire les réglages.',
    saveError: 'Impossible d’enregistrer ce réglage.',
  },
  desktop: {
    tray: {
      open: 'Ouvrir Spartiate',
      sync: 'Synchroniser maintenant',
      quit: 'Quitter',
    },
  },
  updater: {
    available: 'Nouvelle version {version} disponible',
    bannerLabel: 'Mise à jour de Spartiate',
    notConfigured: 'Mises à jour : non configurées (SPA-002)',
    viewNotes: 'Voir les notes',
    hideNotes: 'Masquer les notes',
    notesTitle: 'Notes de la version {version}',
    noNotes: 'Aucune note pour cette version.',
    installRestart: 'Installer et redémarrer',
    later: 'Plus tard',
    downloading: 'Téléchargement de la mise à jour… {percent} %',
    downloadingUnknown: 'Téléchargement de la mise à jour…',
    signatureRefused: 'Mise à jour refusée : signature invalide',
    installFailed: 'La mise à jour a échoué. L’app actuelle reste utilisable.',
    checkFailed: 'Vérification des mises à jour impossible. Nouvelle tentative automatique.',
  },
  detail: {
    createdModified: 'Créée {created} · modifiée {modified}',
    stampToday: 'aujourd’hui à {time}',
    stampYesterday: 'hier à {time}',
    stampOn: 'le {date} à {time}',
  },
  keyboard: {
    ctrl: 'Ctrl',
    shift: 'Maj',
    alt: 'Alt',
    space: 'Espace',
    escape: 'Échap',
    enter: 'Entrée',
    delete: 'Suppr',
    arrowUp: '↑',
    arrowDown: '↓',
    arrowLeft: '←',
    arrowRight: '→',
  },
  status: {
    offline: 'Hors ligne',
    syncing: 'Synchro en cours',
    waitingIcloud: 'En attente d’iCloud',
    calendarDisconnected: 'Agenda {name} déconnecté',
    reconnect: 'Reconnecter',
    /** A-09 critère 9 g : autres problèmes de synchro en attente (détail dans Réglages). */
    syncTroubleMore: '{message} (+{n})',
    /** A-09 critère 9 c : ouvre Réglages › Synchronisation (ou la fenêtre de choix après restauration). */
    syncTroubleView: 'Voir',
    /** Nom accessible du bouton « Voir » (revue A-09, point 11). */
    syncTroubleViewLabel: 'Voir le problème de synchronisation',
    /** Revue A-09, point 1 : l'état local de la synchro (sync_meta, sync_state, marqueur) n'a pas pu être lu ou écrit. */
    syncStateUnreadable: 'État de la synchro inaccessible, nouvel essai au prochain cycle',
    syncReloadFailed: 'Des modifications reçues ne sont pas encore affichées : nouvel essai à la prochaine synchro',
    /** A-09 critère 9 f : appareil nommé et statut comme dans APPAREILS. */
    syncDevice: '{device} : {state}',
    /** I-02 (ADR 0013 §3.3) : moins de 24 h avant l'expiration de la signature (texte précis composé par I-02 dans `message`). */
    signingSoon: 'Spartiate expire bientôt : actualise-la dans SideStore',
    /** I-02 : signature expirée. */
    signingExpired: 'La signature est expirée : actualise Spartiate dans SideStore',
    signingViewLabel: 'Voir l’expiration de la signature dans Réglages',
  },
  undo: {
    action: 'Annuler',
    complete: '« {title} » terminée',
    reopen: '« {title} » rouverte',
    postpone: 'Tâche reportée',
    postponeTomorrow: '« {title} » reportée à demain',
    move: 'Tâche déplacée',
    someday: '« {title} » mise dans « Un jour »',
    duplicate: '« {title} » dupliquée',
    delete: '« {title} » supprimée',
    deleteMany: '{count} tâches supprimées',
    seriesOccurrence: '« {title} » modifiée (cette occurrence)',
    routine: 'Routine modifiée',
    goal: 'Objectif modifié',
    checklist: 'Checklist modifiée',
    event: 'Événement modifié',
    recentSearches: 'Recherches récentes effacées',
    linkedTask: 'Tâche créée depuis un événement',
    manyComplete: '{count} tâches terminées',
    manyPostpone: '{count} tâches reportées',
    manyMove: '{count} tâches déplacées',
    manySomeday: '{count} tâches mises dans « Un jour »',
    scheduleDate: '« {title} » planifiée au {date}',
    manySchedule: '{count} tâches planifiées',
    manyDuplicate: '{count} tâches dupliquées',
    moveDate: '« {title} » déplacée au {date}',
    stale: 'Action impossible à annuler : la tâche a changé',
    failed: 'Impossible d’annuler cette action.',
  },
  routines: routinesFr,
  events: eventsFr,
  capture: captureFr,
  scan: scanFr,
  shortcutsUi: shortcutsUiFr,
  backup: backupFr,
  importCsv: importCsvFr,
  security: securityFr,
  signing: signingFr,
  shortcuts: {
    tabToday: 'Aller à la section Aujourd’hui',
    tabTraining: 'Aller à la section Entraînement',
    tabNutrition: 'Aller à la section Nutrition',
    tabProgress: 'Aller à la section Progrès',
    tabMore: 'Aller à la section Plus',
    undo: 'Annuler la dernière action',
    settings: 'Réglages',
    help: 'Liste des raccourcis',
    escape: 'Fermer le panneau ou la fenêtre active',
  },
} as const;
