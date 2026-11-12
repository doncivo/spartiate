import type { OsFamily, Runtime } from '../runtime';

/**
 * Cache de confidentialité natif (I-03, ADR 0013 §2.5 ; décision d'Ali du 2026-10-08 : construit dès le lot M) : plugin local
 * `privacy-shield` qui pose une vue opaque sur la fenêtre à `willResignActive` (sélecteur d'apps sans passage en arrière-plan) et la retire
 * à `didBecomeActive`. Le cache JS (`features/security/privacyCover.ts`) reste en complément. Aucune méthode ne rejette.
 */
export type PrivacyShieldFailure = 'unavailable' | 'invalid-argument' | 'unknown';

export type PrivacyShieldResult = { readonly ok: true } | { readonly ok: false; readonly code: PrivacyShieldFailure };

export interface PrivacyShield {
  /** Vrai sur l'iPhone installé seulement. */
  readonly supported: boolean;
  setEnabled(enabled: boolean): Promise<PrivacyShieldResult>;
}

/**
 * Propriétaires du bouclier (FIX-0171, constat 5, D-121) : le verrouillage de l'app et les vues photo le demandent chacun pour leur compte ; le plugin,
 * qui ne connaît qu'un état, reste actif tant qu'au moins un propriétaire le demande. Appels servis dans l'ordre, l'état envoyé est celui du moment.
 */
export type ShieldOwnerName = 'appLock' | 'photos';

const owners = new WeakMap<PrivacyShield, { readonly wants: Map<ShieldOwnerName, boolean>; queue: Promise<unknown> }>();

/** Vue d'un propriétaire sur le bouclier `base` (le même objet pour tout l'app : celui du conteneur). Ne rejette jamais. */
export function shieldOwner(base: PrivacyShield, name: ShieldOwnerName): PrivacyShield {
  let state = owners.get(base);
  if (!state) {
    state = { wants: new Map(), queue: Promise.resolve() };
    owners.set(base, state);
  }
  const shared = state;
  return {
    supported: base.supported,
    setEnabled: (enabled) => {
      shared.wants.set(name, enabled);
      const run = shared.queue.then(() => base.setEnabled([...shared.wants.values()].some(Boolean))).catch((): PrivacyShieldResult => ({ ok: false, code: 'unknown' }));
      shared.queue = run;
      return run;
    },
  };
}

/** Implémentation vide (PC, navigateur) : rien à cacher hors iPhone, réussite sans effet. */
export function createNoopPrivacyShield(): PrivacyShield {
  return { supported: false, setEnabled: () => Promise.resolve({ ok: true }) };
}

/** Faux (tests, e2e) : enregistre les appels ; `failWith` fait échouer les suivants. */
export interface FakePrivacyShield extends PrivacyShield {
  readonly calls: boolean[];
  failWith(code: PrivacyShieldFailure | null): void;
}

export function createFakePrivacyShield(): FakePrivacyShield {
  const calls: boolean[] = [];
  let failure: PrivacyShieldFailure | null = null;
  return {
    supported: true,
    calls,
    failWith: (code) => {
      failure = code;
    },
    setEnabled: (enabled) => {
      calls.push(enabled);
      return Promise.resolve(failure ? { ok: false, code: failure } : { ok: true });
    },
  };
}

/**
 * Résolveur : l'adaptateur réel pour (`tauri`, `ios`) seulement, chargé à la demande ; vide ailleurs. En développement seulement :
 * `globalThis.__ctPrivacyShield` (injecté) ou `globalThis.__ctPrivacyShieldFake = true` (le faux, exposé en `__ctPrivacyShield`).
 */
export function openPrivacyShield(runtime: Runtime, os: OsFamily): PrivacyShield {
  if (import.meta.env.DEV) {
    const scope = globalThis as { __ctPrivacyShield?: PrivacyShield; __ctPrivacyShieldFake?: boolean };
    if (!scope.__ctPrivacyShield && scope.__ctPrivacyShieldFake === true) scope.__ctPrivacyShield = createFakePrivacyShield();
    if (scope.__ctPrivacyShield) return scope.__ctPrivacyShield;
  }
  if (runtime === 'tauri' && os === 'ios') {
    return {
      supported: true,
      setEnabled: (enabled) =>
        import('./tauriPrivacyShield').then(
          (module) => module.setNativeShield(enabled),
          () => ({ ok: false, code: 'unavailable' }) as const,
        ),
    };
  }
  return createNoopPrivacyShield();
}
