import { SYNC_CATALOGUE, type SyncCatalogue } from '../../domain/sync/syncTables';
import type { StoreApi } from 'zustand';
import { systemClock, type Clock } from '../../domain/clock';
import type { HlcClock } from '../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../domain/id';
import { type DataAccess } from '../../db/repositories';
import type { DesktopPlatform, OsFamily, Runtime } from '../../platform';
import { createUnavailableBackup, type BackupService } from '../../platform/backup';
import type { SyncEngineService, SyncPlatform } from '../../platform/sync/types';
import { createUnavailableFiles, type FileService } from '../../platform/files';
import { createUnavailableNotificationScheduler, systemNotificationClock, type NotificationClock, type NotificationScheduler } from '../../platform/notifications';
import { createNoopHaptics, type Haptics } from '../../platform/haptics';
import { createUnavailableAuthenticator, type AppAuthenticator } from '../../platform/biometric';
import { createNoopPrivacyShield, type PrivacyShield } from '../../platform/privacyShield';
import { createUnsupportedSigning, type SigningPlatform } from '../../platform/signing';
import { buildAppVersion, type AppVersionRead } from '../../platform/appVersion';
import type { LaunchKind } from '../../domain/appUpdate';
import { createShortcutRegistry, type ShortcutRegistry } from './shortcuts';
import { createUndoStack, type UndoStack } from './undo';

/**
 * Conteneur de dépendances unique (ADR 0004), créé une fois au démarrage
 * (`bootstrapApp`), fourni à React par `AppContainerProvider`, remplacé en test
 * par `createAppContainer({ data: faux, clock: createManualClock(…) … })`.
 *
 * Les cas d'usage des features reçoivent un sous-ensemble explicite :
 *   `type TaskUseCaseDeps = Pick<AppContainer, 'clock' | 'ids' | 'data' | 'undo'>`.
 * Ils ne lisent jamais un singleton de module (aucune base globale dans une feature).
 */
export interface AppContainer {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Générateur HLC de l'appareil ; les écritures passent par le WriteStamper des repositories. */
  readonly hlc: HlcClock;
  readonly data: DataAccess;
  /** Catalogue des tables publiées par la synchro (D-67) : I0 en production, ancien catalogue dans le banc de test. */
  readonly catalogue: SyncCatalogue;
  readonly undo: UndoStack;
  readonly shortcuts: ShortcutRegistry;
  readonly platform: { readonly runtime: Runtime; readonly os: OsFamily };
  /** Intégration système du PC Windows (D-01 à D-03, ADR 0006) ; null hors PC (navigateur, iPhone, tests). */
  readonly desktop: DesktopPlatform | null;
  /** Notifications locales (ADR 0012) : adaptateur réel sur l'iPhone installé, vide ailleurs (le PC n'envoie aucune notification). Sert à l'avis d'expiration de la signature. */
  readonly notifications: NotificationScheduler;
  /** Instant et fuseau de l'appareil pour la planification (injectables : tests, e2e). */
  readonly notificationClock: NotificationClock;
  /** Enregistrement de fichiers (export H-03, P-04, P-07) : boîte « Enregistrer sous » sur PC, téléchargement en développement, indisponible sur iPhone avant l'ordre 5. */
  readonly files: FileService;
  /** Sauvegardes locales (P-04) : quotidienne, liste, restauration ; commandes Rust sur PC, mémoire en développement, indisponible sur iPhone. */
  readonly backups: BackupService;
  /**
   * Synchronisation par iCloud Drive (ADR 0011, lot Y2) ; null sans plateforme de synchro (navigateur de dev sans simulateur,
   * tests, iPhone avant l'ordre 5) : aucun coût ni écran.
   */
  readonly sync: SyncEngineService | null;
  /** Plateforme de synchro du service (`openSyncPlatform`), partagée avec la section Réglages ; null sans synchro. */
  readonly syncPlatform: SyncPlatform | null;
  /** Retour haptique (A-07, ADR 0013 §1.2) : plugin local sur l'iPhone installé, vide ailleurs ; cosmétique, ne rejette jamais. */
  readonly haptics: Haptics;
  /** Face ID ou code de l'iPhone (I-03, ADR 0013 §2.2) : plugin officiel sur l'iPhone installé, non pris en charge ailleurs. */
  readonly authenticator: AppAuthenticator;
  /** Cache de confidentialité natif (I-03, ADR 0013 §2.5) : plugin local sur l'iPhone installé, vide ailleurs. */
  readonly privacyShield: PrivacyShield;
  /** Expiration de la signature SideStore (I-02, ADR 0013 §3) : lecture du profil et alerte (identifiant réservé 2) sur l'iPhone installé, non prise en charge ailleurs. */
  readonly signing: SigningPlatform;
  /** Version de l'app lue au démarrage (I-06, `platform/appVersion.ts`) : « À propos », en-tête de l'export des logs. */
  readonly appVersion: AppVersionRead;
  /**
   * Nature de ce lancement (I-06, `domain/appUpdate.ts`) : `updated` = premier lancement d'une nouvelle version (le premier passage des
   * rappels est demandé avec le déclencheur `update`).
   */
  readonly launch: LaunchKind;
}

export type AppContainerParts = Pick<AppContainer, 'hlc' | 'data'> & Partial<AppContainer>;

export function createAppContainer(parts: AppContainerParts): AppContainer {
  const data = parts.data;
  return {
    clock: parts.clock ?? systemClock,
    ids: parts.ids ?? uuidGenerator,
    hlc: parts.hlc,
    data,
    catalogue: parts.catalogue ?? SYNC_CATALOGUE,
    undo: parts.undo ?? createUndoStack(),
    shortcuts: parts.shortcuts ?? createShortcutRegistry(),
    platform: parts.platform ?? { runtime: 'web', os: 'other' },
    desktop: parts.desktop ?? null,
    notifications: parts.notifications ?? createUnavailableNotificationScheduler(),
    notificationClock: parts.notificationClock ?? systemNotificationClock,
    files: parts.files ?? createUnavailableFiles(),
    backups: parts.backups ?? createUnavailableBackup(),
    sync: parts.sync ?? null,
    syncPlatform: parts.syncPlatform ?? null,
    haptics: parts.haptics ?? createNoopHaptics(),
    authenticator: parts.authenticator ?? createUnavailableAuthenticator(),
    privacyShield: parts.privacyShield ?? createNoopPrivacyShield(),
    signing: parts.signing ?? createUnsupportedSigning(),
    appVersion: parts.appVersion ?? buildAppVersion(),
    launch: parts.launch ?? 'same',
  };
}

/**
 * Store Zustand d'une feature lié au conteneur (une instance par conteneur, donc
 * isolée en test). Usage dans une feature :
 *
 *   export const tasksStore = defineFeatureStore((c) => createStore<TasksState>()((set) => ({
 *     …, create: async (input) => { const r = await taskUseCases(c).create(input); … },
 *   })));
 *   // composant : const today = useFeatureStore(tasksStore, (s) => s.today);
 *   // hors React (raccourci, test) : tasksStore.get(container).getState()
 */
export interface FeatureStore<S> {
  get(container: AppContainer): StoreApi<S>;
}

export function defineFeatureStore<S>(factory: (container: AppContainer) => StoreApi<S>): FeatureStore<S> {
  const instances = new WeakMap<AppContainer, StoreApi<S>>();
  return {
    get: (container) => {
      let store = instances.get(container);
      if (!store) {
        store = factory(container);
        instances.set(container, store);
      }
      return store;
    },
  };
}
