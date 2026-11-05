import type { Clock } from '../domain/clock';
import { isPermanentSyncError } from '../domain/sync/errorFamily';
import { QUIT_SYNC_BUDGET_MS } from '../domain/sync/limits';
import type { SyncNowOptions, SyncReason, SyncService } from '../platform/sync/types';

/**
 * Déclenchement des cycles (ADR 0011, section 10.1 ; Y-02 critère 1) : à l'ouverture, toutes les 25 s tant que la fenêtre est visible au
 * premier plan (0.1.3 k, SPA-008 : une pesée doit arriver sur l'autre appareil en moins de 60 s ; l'intervalle de 5 min,
 * `SYNC_INTERVAL_MS`, reste celui de l'arrière-plan, où aucun cycle périodique ne tourne), 3 s après une écriture locale publiable
 * (regroupées, 10 s au plus), au retour au premier plan, au masquage de la fenêtre (fermeture vers la zone de notification sur PC), avant « Quitter » (5 s au plus). Jamais en
 * arrière-plan. Le minuteur sonde : l'échéance est décidée par l'horloge injectée (4 min 59 s : pas de cycle ; 5 min : un cycle).
 *
 * iPhone (ADR 0011 §22 point 6, Y-IOS-01) : `hideDeadlineMs` posé par `startSync.ts` : au passage en arrière-plan, le cycle `hide` est
 * lancé **dans le gestionnaire même** avec une échéance (`HIDE_SYNC_DEADLINE_MS`), pendant la tâche d'arrière-plan ouverte par le plugin
 * Swift ; au retour au premier plan, un cycle `open` reprend ce qu'un cycle `hide` interrompu a laissé. PC : aucune échéance.
 */

/** Échéance du cycle lancé au passage de l'iPhone en arrière-plan (la tâche iOS est fermée au plus tard 28 s après son ouverture). */
export const HIDE_SYNC_DEADLINE_MS = 25_000;

/** Attente maximale du travail préalable au cycle `hide` (passage des Rappels Apple : 8 s au plus). */
export const BEFORE_HIDE_BUDGET_MS = 8_000;

/** Période de sondage du minuteur (les échéances sont décidées par l'horloge). */
export const SYNC_POLL_MS = 5_000;

/** Intervalle entre deux cycles quand l'app est visible au premier plan (20 à 30 s, avec le sondage de 5 s). */
export const SYNC_FOREGROUND_INTERVAL_MS = 25_000;

/** Regroupement des écritures locales : un cycle 3 s après la dernière, 10 s au plus après la première. */
export const LOCAL_WRITE_DEBOUNCE_MS = 3_000;
export const LOCAL_WRITE_MAX_WAIT_MS = 10_000;

/** Retour au premier plan : pas de nouveau cycle si le précédent date de moins de 5 s (bascules répétées). */
export const RETURN_MIN_GAP_MS = 5_000;

export interface SyncSchedulerEnv {
  readonly document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  readonly clock: Clock;
  readonly setInterval?: (handler: () => void, ms: number) => unknown;
  readonly clearInterval?: (handle: unknown) => void;
  /** iPhone : échéance du cycle `hide` (ms après le masquage) ; absente (PC) : cycle `hide` non borné, aucun cycle au retour. */
  readonly hideDeadlineMs?: number;
  /** P-04-iOS critère 12 : démarre suspendu (marqueur de restauration non écrit) ; aucun cycle avant `resume()`. */
  readonly startPaused?: boolean;
  /** Écoute des écritures locales publiables (`onLocalWrite`) ; renvoie le désabonnement. Absent : seul le sondage périodique agit. */
  readonly localWrites?: (listener: () => void) => () => void;
  /**
   * iPhone : travail à terminer AVANT le cycle `hide` (passage des Rappels Apple, ADR 0008 §10.8 : il publie ce qu'il vient de changer). Le cycle attend
   * sa fin, `beforeHideBudgetMs` au plus ; l'échéance du cycle reste mesurée depuis le masquage (la tâche d'arrière-plan d'iOS est une seule fenêtre).
   */
  readonly beforeHide?: () => Promise<unknown>;
  readonly beforeHideBudgetMs?: number;
}

export interface SyncScheduler {
  /** Sonde une fois (tests). */
  tick(): Promise<void>;
  /** « Quitter » : un dernier cycle, attendu 5 s au plus ; ne rejette jamais. */
  beforeQuit(budgetMs?: number): Promise<void>;
  dispose(): void;
  /** P-04-iOS (mise au calme avant une restauration, marqueur non écrit) : plus aucun cycle lancé par le planificateur. */
  pause(): void;
  /** Reprise : un cycle d'ouverture, puis le sondage habituel. */
  resume(): void;
}

/** Attend `work` au plus `budgetMs` ; un échec ou un dépassement ne bloque jamais le cycle (le travail se termine seul, la reprise est à l'ouverture suivante). */
async function waitFor(work: () => Promise<unknown>, budgetMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, budgetMs);
  });
  await Promise.race([work().then(() => undefined, () => undefined), limit]);
  if (timeout !== undefined) clearTimeout(timeout);
}

/**
 * Y-IOS-02 (point de contrôle d'Ali, 0.2.1) : appareil sans clé (phase `needs-pairing`) : seule l'association le débloque. Les cycles
 * périodiques et de masquage ne tournent pas (aucune boucle sans issue) ; l'ouverture, « Synchroniser » et l'association (cycle `manual`
 * de `handleSyncPaired`) relisent l'état. Un Trousseau indisponible (`vault-unavailable`, iPhone verrouillé) n'est pas concerné : il se
 * résout seul, l'erreur reste visible et le cycle suivant relit la clé.
 */
const WAITS_FOR_PAIRING: ReadonlySet<string> = new Set(['needs-pairing']);

export function startSyncScheduler(service: Pick<SyncService, 'syncNow'> & Partial<Pick<SyncService, 'status'>>, env: SyncSchedulerEnv): SyncScheduler {
  const setTimer = env.setInterval ?? ((handler, ms) => setInterval(handler, ms));
  const clearTimer = env.clearInterval ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
  let disposed = false;
  let paused = env.startPaused === true;
  let lastStart = env.clock.nowMs();
  /** Écritures locales en attente de publication : instants de la première et de la dernière (ms), null : aucune. */
  let dirtyFirst: number | null = null;
  let dirtyLast = 0;
  const visible = (): boolean => env.document.visibilityState !== 'hidden';

  const run = (reason: SyncReason, options?: SyncNowOptions): Promise<void> => {
    if (disposed || paused) return Promise.resolve();
    lastStart = env.clock.nowMs();
    dirtyFirst = null;
    return (options ? service.syncNow(reason, options) : service.syncNow(reason)).catch(() => undefined);
  };

  const waitsForPairing = (): boolean => WAITS_FOR_PAIRING.has(service.status?.().phase ?? '');

  /** Audit des impasses : erreur permanente (`isPermanentSyncError`) : aucun cycle périodique en boucle ; texte et action dits par l'écran. */
  const stopped = (): boolean => {
    const status = service.status?.();
    return status !== undefined && status.phase === 'error' && isPermanentSyncError(status.errorCode);
  };

  /** Erreur passagère répétée (revue de la PR #14) : échéance du prochain essai espacé (`retryAt`), jamais un arrêt ; null : aucune. */
  const retryAtMs = (): number | null => {
    const status = service.status?.();
    if (status?.phase !== 'error' || !status.retryAt) return null;
    const at = Date.parse(status.retryAt);
    return Number.isFinite(at) ? at : null;
  };

  const tick = async (): Promise<void> => {
    if (disposed || !visible() || waitsForPairing() || stopped()) return;
    const retryAt = retryAtMs();
    const now = env.clock.nowMs();
    const periodic = retryAt === null ? now - lastStart >= SYNC_FOREGROUND_INTERVAL_MS : now >= retryAt;
    // Écriture locale : regroupée (3 s après la dernière, 10 s au plus après la première) ; une erreur espacée (`retryAt`) garde son rythme.
    const written = retryAt === null && dirtyFirst !== null && (now - dirtyLast >= LOCAL_WRITE_DEBOUNCE_MS || now - dirtyFirst >= LOCAL_WRITE_MAX_WAIT_MS);
    if (periodic || written) await run('timer');
  };

  const bounded = env.hideDeadlineMs;
  const onVisibility = (): void => {
    // Masquage de la fenêtre (PC : fermeture vers la zone de notification) : un cycle, puis rien en arrière-plan. iPhone : cycle borné.
    if (!visible()) {
      const options = bounded === undefined ? undefined : { deadlineAt: env.clock.nowMs() + bounded };
      const before = env.beforeHide;
      if (waitsForPairing()) return;
      if (before === undefined) void run('hide', options);
      else void waitFor(before, env.beforeHideBudgetMs ?? BEFORE_HIDE_BUDGET_MS).then(() => run('hide', options));
    }
    // Retour au premier plan : iPhone, un cycle d'ouverture (reprise d'un cycle `hide` interrompu) ; PC, le sondage des 5 minutes, ou un
    // cycle d'ouverture (une seule tentative, jamais une boucle) quand une erreur permanente ou répétée suspend ou espace les cycles.
    else if (bounded !== undefined || stopped() || retryAtMs() !== null) void run('open');
    // PC : cycle tout de suite, sauf bascules répétées (RETURN_MIN_GAP_MS) ou appareil en attente d'association.
    else if (!waitsForPairing() && env.clock.nowMs() - lastStart >= RETURN_MIN_GAP_MS) void run('open');
  };

  env.document.addEventListener('visibilitychange', onVisibility);
  const stopWrites = env.localWrites?.(() => {
    const now = env.clock.nowMs();
    dirtyFirst ??= now;
    dirtyLast = now;
  });
  const timer = setTimer(() => void tick(), SYNC_POLL_MS);
  void run('open');

  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      void run('open');
    },
    tick,
    beforeQuit: async (budgetMs = QUIT_SYNC_BUDGET_MS) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([run('quit'), new Promise<void>((resolve) => (timeout = setTimeout(resolve, budgetMs)))]);
      if (timeout !== undefined) clearTimeout(timeout);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimer(timer);
      stopWrites?.();
      env.document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
