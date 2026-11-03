import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeNotificationScheduler, createLedgerStore, createUnavailableNotificationScheduler, type FakeNotificationScheduler, type NotificationScheduler } from '../../platform/notifications';
import { createFakeBridge, createMemoryLedger, type FakeBridge, type MemoryLedger } from '../../platform/notifications/fakeBridge';
import { createTauriNotificationScheduler } from '../../platform/notifications/tauriNotifications';
import { createAppContainer, type AppContainer, type AppContainerParts } from '../app/container';
import { useAppStatusStore } from '../app/appStatus';

/** Aides des tests de l'avis de signature : conteneur minimal (base en mémoire, horloge manuelle, aucune tâche). */
export interface SigningHarness {
  readonly db: TestDb;
  readonly container: AppContainer;
  readonly zone: { name: string | null };
  /** Faux planificateur (mode « faux »). */
  readonly fake: FakeNotificationScheduler;
  /** Faux pont et registre mémoire (mode « adaptateur réel »). */
  readonly bridge: FakeBridge;
  readonly ledger: MemoryLedger;
}

export interface SetupOptions {
  /** `fake` : planificateur faux ; `real` : adaptateur réel sur un faux pont ; `none` : implémentation vide (PC). */
  readonly mode?: 'fake' | 'real' | 'none';
  readonly platform?: AppContainer['platform'];
  readonly parts?: Partial<AppContainerParts>;
  readonly startAt?: string;
  readonly zone?: string | null;
}

export const NOW_ISO = '2026-10-08T08:00:00.000Z'; // 10:00 à Paris (UTC+2)

let counter = 0;

export async function setupSigning(options: SetupOptions = {}): Promise<SigningHarness> {
  counter += 1;
  const device = asEntityId<DeviceId>(`70000000-0000-4000-8000-${String(counter).padStart(12, '0')}`);
  const db = await openTestDb(device, options.startAt ?? NOW_ISO);
  const zone = { name: options.zone === undefined ? 'Europe/Paris' : options.zone };
  const fake = createFakeNotificationScheduler();
  const bridge = createFakeBridge();
  const ledger = createMemoryLedger();
  const container = makeContainer(db, device, zone, options.mode ?? 'fake', fake, bridge, ledger, options);
  useAppStatusStore.setState({ sources: {} });
  return { db, container, zone, fake, bridge, ledger };
}

function makeContainer(db: TestDb, device: DeviceId, zone: { name: string | null }, mode: 'fake' | 'real' | 'none', fake: FakeNotificationScheduler, bridge: FakeBridge, ledger: MemoryLedger, options: SetupOptions): AppContainer {
  const notificationClock = { nowMs: () => db.clock.nowMs(), zone: () => zone.name };
  const notifications: NotificationScheduler =
    mode === 'fake' ? fake : mode === 'real' ? createTauriNotificationScheduler({ bridge, ledger: createLedgerStore(ledger), clock: notificationClock }) : createUnavailableNotificationScheduler();
  return createAppContainer({
    clock: db.clock,
    hlc: createHlcClock({ clock: db.clock, deviceId: device }),
    data: db.data,
    platform: options.platform ?? { runtime: 'tauri', os: 'ios' },
    notifications,
    notificationClock,
    ...options.parts,
  });
}

/** Une app « redémarrée » : mêmes données et mêmes faux (l'iPhone garde ses notifications), instances neuves du reste. */
export function reopenSigning(harness: SigningHarness, options: SetupOptions = {}): AppContainer {
  return makeContainer(harness.db, harness.db.deviceId, harness.zone, options.mode ?? 'fake', harness.fake, harness.bridge, harness.ledger, options);
}
