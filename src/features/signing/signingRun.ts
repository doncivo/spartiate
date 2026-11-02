import { createStore } from 'zustand';
import { isValidTimeZone } from '../../domain/timeZone';
import { logFailure } from '../../platform/desktop/log';
import type { NotificationPermission } from '../../platform/notifications';
import { defineFeatureStore, type AppContainer } from '../app/container';
import { clearSigningBanner, runSigningStep, type SigningTrigger } from './signingNotice';

/**
 * Passage de l'alerte d'expiration de la signature (I-02, ADR 0013 §3.4), appelé directement par l'infrastructure conservée de
 * `platform/notifications` (SPA-001b : découplé du planificateur de rappels de tâches, décision d'Ali du 2026-11-02).
 * Mêmes déclencheurs qu'avant : démarrage (`open`, ou `update` au premier lancement d'une nouvelle version), retour au premier plan
 * (`resume`), demande d'autorisation (`permission`). Les passages se suivent un à un par conteneur ; un passage ne rejette jamais.
 */

export interface SigningPermissionState {
  /** Dernière autorisation lue par un passage ; null avant le premier passage. */
  readonly permission: NotificationPermission | null;
}

export const signingPermissionStore = defineFeatureStore(() => createStore<SigningPermissionState>()(() => ({ permission: null })));

const queues = new WeakMap<AppContainer, Promise<void>>();

/** Un passage, à la suite des précédents du même conteneur. */
export function replanSigning(container: AppContainer, trigger: SigningTrigger): Promise<void> {
  if (!container.signing.source.supported) return Promise.resolve();
  const previous = queues.get(container) ?? Promise.resolve();
  const next = previous.then(() => pass(container, trigger));
  queues.set(container, next);
  return next;
}

async function pass(container: AppContainer, trigger: SigningTrigger): Promise<void> {
  try {
    const { notifications: scheduler, notificationClock: clock } = container;
    // Sur le PC et dans le navigateur, rien n'est lu ni planifié : l'envoi est sur l'iPhone.
    if ((await scheduler.availability()) === 'unavailable') return;
    const permission = await scheduler.permission();
    signingPermissionStore.get(container).setState({ permission });
    const zoneName = clock.zone();
    const zone = zoneName !== null && isValidTimeZone(zoneName) ? zoneName : null;
    await runSigningStep(container, { trigger, permission, nowMs: clock.nowMs(), zone });
  } catch {
    logFailure('signing', 'signing-pass-failed');
  }
}

export interface SigningIntegration {
  /** Se résout à la fin du passage d'ouverture (tests : aucune attente par délai). */
  opened(): Promise<void>;
  dispose(): void;
}

export interface SigningEnv {
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
}

export function startSigningIntegration(container: AppContainer, env: SigningEnv = { document }): SigningIntegration {
  let disposed = false;
  const request = (trigger: SigningTrigger): Promise<void> => (disposed ? Promise.resolve() : replanSigning(container, trigger));
  const onVisibility = (): void => {
    if (env.document.visibilityState !== 'hidden') void request('resume');
  };
  env.document.addEventListener('visibilitychange', onVisibility);
  const opened = request(container.launch === 'updated' ? 'update' : 'open');
  return {
    opened: () => opened,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      env.document.removeEventListener('visibilitychange', onVisibility);
      clearSigningBanner(container);
    },
  };
}
