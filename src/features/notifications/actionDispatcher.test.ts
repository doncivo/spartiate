import { describe, expect, it } from 'vitest';
import type { RawNotificationAction } from '../../domain/notificationActions';
import type { RawRestAction } from '../../domain/restNotificationActions';
import { createFakeNotificationActionSource, type ActionTypeSpec, type NotificationActionSource } from '../../platform/notifications';
import { createActionDispatcher } from './actionDispatcher';
import type { SupplementActionProcessor, SupplementActionRun } from './supplementActions';

/**
 * SHELL-0294b (§ 13.3 b, D-541 (1)) : répartiteur unique des actions de notification. Un seul tirage et un seul acquittement du fichier natif
 * par passage ; les actions de rappel vont au processeur des compléments, les actions de repos au gestionnaire du repos. Une action de repos
 * n'est jamais acquittée (donc perdue) parce que le processeur des compléments a acquitté ses lignes ; un échec du repos laisse tout le
 * fichier en place (rejoué au passage suivant, les compléments écartent leurs doublons par leurs clés appliquées).
 */
const AT = 1_764_064_800_000;
const done: RawNotificationAction = { numericId: 1, actionId: 'done', receivedAtMs: AT, sid: 'supplement:2026-11-25|08:00', deliveredAt: AT };
const extend: RawRestAction = { numericId: 8, actionId: 'extend30', receivedAtMs: AT + 2_000, sid: 'timer:rest', deliveredAt: AT };
const REST_TYPES: readonly ActionTypeSpec[] = [{ id: 'sp.rest', actions: [{ id: 'extend30', title: '+30 s', foreground: true }, { id: 'skip', title: 'Passer', foreground: true }] }];
const RUN: SupplementActionRun = { status: 'done', taken: 0, applied: 0, duplicates: 0, failed: 0, unmatched: 0 };

/** Processeur minimal sur le modèle du vrai : tire la vue, garde ce qu'il a vu, acquitte toutes les lignes lues. */
function supplementRig(options: { readonly skipAck?: boolean } = {}) {
  const seen: (readonly RawNotificationAction[])[] = [];
  const make = (view: NotificationActionSource): SupplementActionProcessor => ({
    register: async () => {
      await view.registerActionTypes([{ id: 'sp.supplement', actions: [{ id: 'done', title: 'Pris', foreground: false }] }]);
      return true;
    },
    run: async () => {
      const drained = await view.drain();
      seen.push(drained.entries);
      expect(drained.rest ?? []).toEqual([]);
      if (!options.skipAck && drained.lines > 0) await view.ack({ lines: drained.lines, writeFailures: drained.writeFailures });
      return RUN;
    },
  });
  return { seen, make };
}

describe('répartiteur des actions de notification', () => {
  it('un tirage, les compléments reçoivent leurs actions, le repos les siennes, un seul acquittement à la fin', async () => {
    const source = createFakeNotificationActionSource();
    source.push(done);
    source.push(extend);
    const supplement = supplementRig();
    const restSeen: (readonly RawRestAction[])[] = [];
    const dispatcher = createActionDispatcher({
      source,
      supplement: supplement.make,
      rest: async (actions) => {
        restSeen.push(actions);
        return true;
      },
      restTypes: REST_TYPES,
      log: () => undefined,
    });
    expect(await dispatcher.run()).toEqual(RUN);
    expect(supplement.seen).toEqual([[done]]);
    expect(restSeen).toEqual([[extend]]);
    expect(source.calls).toEqual(['drain', 'ack:2']);
    expect(source.file).toEqual([]);
  });

  it('échec du repos : rien n’est acquitté, l’action de repos reste dans le fichier', async () => {
    const source = createFakeNotificationActionSource();
    source.push(extend);
    const logs: string[] = [];
    const dispatcher = createActionDispatcher({ source, supplement: supplementRig().make, rest: async () => false, restTypes: REST_TYPES, log: (code) => logs.push(code) });
    await dispatcher.run();
    expect(source.calls).toEqual(['drain']);
    expect(source.file).toEqual([extend]);
    expect(logs).toContain('rest-action-retry');
  });

  it('le processeur des compléments n’acquitte pas (file locale non écrite) : rien n’est acquitté', async () => {
    const source = createFakeNotificationActionSource();
    source.push(done);
    const dispatcher = createActionDispatcher({ source, supplement: supplementRig({ skipAck: true }).make, rest: async () => true, restTypes: REST_TYPES, log: () => undefined });
    await dispatcher.run();
    expect(source.calls).toEqual(['drain']);
  });

  it('tirage impossible : le processeur des compléments le voit (« source-failed »), le repos n’est pas appelé', async () => {
    const source = createFakeNotificationActionSource();
    source.failNext('drain');
    let restCalls = 0;
    const make = (view: NotificationActionSource): SupplementActionProcessor => ({
      register: async () => true,
      run: async () => {
        await expect(view.drain()).rejects.toThrow();
        return { ...RUN, status: 'source-failed' };
      },
    });
    const dispatcher = createActionDispatcher({
      source,
      supplement: make,
      rest: async () => {
        restCalls += 1;
        return true;
      },
      restTypes: REST_TYPES,
      log: () => undefined,
    });
    expect((await dispatcher.run()).status).toBe('source-failed');
    expect(restCalls).toBe(0);
  });

  it('acquittement impossible : statut « ack-failed », journalisé', async () => {
    const source = createFakeNotificationActionSource();
    source.push(done);
    source.failNext('ack');
    const logs: string[] = [];
    const dispatcher = createActionDispatcher({ source, supplement: supplementRig().make, rest: async () => true, restTypes: REST_TYPES, log: (code) => logs.push(code) });
    expect((await dispatcher.run()).status).toBe('ack-failed');
    expect(logs).toContain('notification-action-ack-failed');
  });

  it('catégories enregistrées en UN appel (iOS remplace toutes les catégories à chaque enregistrement) : compléments puis repos', async () => {
    const source = createFakeNotificationActionSource();
    const dispatcher = createActionDispatcher({ source, supplement: supplementRig().make, rest: async () => true, restTypes: REST_TYPES, log: () => undefined });
    expect(await dispatcher.register()).toBe(true);
    expect(source.calls).toEqual(['registerActionTypes']);
    expect(source.registered.map((type) => type.id)).toEqual(['sp.supplement', 'sp.rest']);
  });

  it('enregistrement refusé : faux et journalisé', async () => {
    const source = createFakeNotificationActionSource();
    source.failNext('registerActionTypes');
    const logs: string[] = [];
    const dispatcher = createActionDispatcher({ source, supplement: supplementRig().make, rest: async () => true, restTypes: REST_TYPES, log: (code) => logs.push(code) });
    expect(await dispatcher.register()).toBe(false);
    expect(logs).toContain('notification-action-register-failed');
  });

  it('passages sérialisés : deux réveils rapprochés ne tirent jamais en même temps', async () => {
    const source = createFakeNotificationActionSource();
    source.push(extend);
    let inFlight = 0;
    let maxInFlight = 0;
    const dispatcher = createActionDispatcher({
      source,
      supplement: supplementRig().make,
      rest: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return true;
      },
      restTypes: REST_TYPES,
      log: () => undefined,
    });
    await Promise.all([dispatcher.run(), dispatcher.run()]);
    expect(maxInFlight).toBe(1);
  });
});
