import type { QrScanner } from '../sync/tauriSync';

/** Faux scanner (tests, e2e) : permission, contenu lu, scan suspendu (`hold`) puis annulable, échec. Aucune caméra. */
export interface FakeScanner {
  readonly scanner: QrScanner;
  readonly scans: Array<{ readonly windowed: true; readonly formats: readonly string[] }>;
  requested: number;
  cancelled: number;
  /** Résout quand un scan suspendu est en cours. */
  waitScanning(): Promise<void>;
}

export interface FakeScannerOptions {
  readonly permission?: 'granted' | 'denied' | 'prompt';
  readonly grantOnRequest?: boolean;
  readonly content?: string;
  readonly hold?: boolean;
  readonly scanFails?: boolean;
}

export function createFakeScanner(options: FakeScannerOptions = {}): FakeScanner {
  let state = options.permission ?? 'granted';
  let rejectHeld: ((reason: Error) => void) | null = null;
  let started: (() => void) | null = null;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  const fake: FakeScanner = {
    scans: [],
    requested: 0,
    cancelled: 0,
    waitScanning: () => startedPromise,
    scanner: {
      checkPermissions: async () => state,
      requestPermissions: async () => {
        fake.requested += 1;
        state = options.grantOnRequest ? 'granted' : 'denied';
        return state;
      },
      scan: (o) => {
        fake.scans.push({ windowed: o.windowed, formats: [...o.formats] });
        if (options.scanFails) return Promise.reject(new Error('plugin'));
        if (options.hold) {
          started?.();
          return new Promise((_resolve, reject) => {
            rejectHeld = reject;
          });
        }
        return Promise.resolve({ content: options.content ?? '' });
      },
      cancel: async () => {
        fake.cancelled += 1;
        rejectHeld?.(new Error('cancelled'));
      },
      openAppSettings: async () => undefined,
      qrFormat: 'QR_CODE',
    },
  };
  return fake;
}
