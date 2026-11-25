import { create } from 'zustand';
import type { LocalDate } from '../../domain/types';

/** État de démarrage de la base locale. */
export type DbStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Diagnostic de l'échec de démarrage (0.2.1), affiché sous le message d'erreur et copiable.
 * - phase 'open' : ouverture de la base (étape fine, numéro de migration) ;
 * - phase 'start' : suite du démarrage, base déjà ouverte (étape = nom du module en cours).
 */
export interface DbFailure {
  readonly phase: 'open' | 'start';
  readonly step: string;
  readonly migration?: number | undefined;
  readonly errorName: string;
  readonly message: string;
  /** Mode de journal effectif de la base ouverte (PRAGMA journal_mode) ; null si illisible, absent si la base n'était pas ouverte. */
  readonly journalMode?: string | null;
  /**
   * I-06 (ADR 0007 avenant I-06 point 7) : nature de l'échec d'ouverture : base plus récente que l'app, migration, sauvegarde avant
   * migration, autre. Absent pour la suite du démarrage et le chien de garde.
   */
  readonly kind?: 'schema-newer' | 'migration' | 'backup' | 'other' | 'connection-poisoned';
  /** Version de l'app (`appVersion.ts`) ; null si illisible. */
  readonly appVersion?: string | null;
  /** Dernière migration appliquée à la base au moment de l'échec ; null si `schema_migrations` n'a pas été lue. */
  readonly schemaVersion?: number | null;
  /** Dernière migration connue du code. */
  readonly appSchemaVersion?: number;
  /** Sauvegarde « Avant mise à jour » de ce démarrage (créée ou réutilisée) : nom seul ; null s'il n'y en a pas. */
  readonly updateBackup?: { readonly name: string } | null;
}

/**
 * Store global minimal de l'app (Zustand). Les features ajoutent leurs propres
 * stores ; celui-ci ne garde que l'état transverse.
 */
export interface AppState {
  readonly dbStatus: DbStatus;
  /** Message technique de la dernière erreur d'ouverture (écran de logs, jamais affiché tel quel). */
  readonly dbErrorDetail: string | null;
  /** La sauvegarde avant migration a échoué : migrations non appliquées, message dédié (app.dbBackupError). */
  readonly dbBackupFailed: boolean;
  /** Étape et erreur exactes du dernier échec de démarrage (null hors erreur). */
  readonly dbFailure: DbFailure | null;
  /**
   * Jour local courant de l'app : posé par la coquille (`useLocalDay`, ShellChrome) au démarrage, à chaque passage de minuit et au
   * retour au premier plan ; les écrans datés (Aujourd'hui) s'y rechargent.
   */
  readonly day: LocalDate | null;
  /** T-11 : fuseau IANA courant de l'appareil (détecté au démarrage et au retour au premier plan). */
  readonly timeZone: string | null;
  setTimeZone(timeZone: string): void;
  setDbStatus(status: DbStatus, options?: { readonly detail?: string; readonly backupFailed?: boolean; readonly failure?: DbFailure }): void;
  setDay(day: LocalDate): void;
  /** Étape d'ouverture en cours (lue par le chien de garde du démarrage) ; null hors ouverture. */
  readonly dbProgress: { readonly step: string; readonly migration?: number | undefined } | null;
  setDbProgress(progress: AppState['dbProgress']): void;
}

export const useAppStore = create<AppState>()((set) => ({
  dbProgress: null,
  setDbProgress: (dbProgress) => set({ dbProgress }),
  dbStatus: 'idle',
  dbErrorDetail: null,
  dbBackupFailed: false,
  dbFailure: null,
  day: null,
  timeZone: null,
  setTimeZone: (timeZone) => set({ timeZone }),
  // A-008 : « connexion invalidée » est durable (seul un redémarrage de l'app la lève) : ni « ready » ni un autre échec ne la remplacent.
  setDbStatus: (dbStatus, options) => set((state) => state.dbFailure?.kind === 'connection-poisoned' ? state : { dbStatus, dbErrorDetail: options?.detail ?? null, dbBackupFailed: options?.backupFailed ?? false, dbFailure: options?.failure ?? null }),
  setDay: (day) => set({ day }),
}));
