import { describe, expect, it } from 'vitest';
import { parseNotificationLedger } from '../../domain/notificationLedger';
import { SETTINGS_DEFINITIONS } from '../../domain/model/settings';
import type { LocalDate, LocalDateTime } from '../../domain/types';
import { measurementNotificationsFr } from '../../i18n/fr.measurementNotifications';
import { createFakeNotificationScheduler, createUnavailableNotificationScheduler, type FakeNotificationScheduler, type NotificationScheduler } from '../../platform/notifications';
import { NOTIFICATION_KINDS } from '../../platform/notifications/types';
import { validateRequests } from '../../platform/notifications/validate';
import { createMeasurementNotificationService } from './measurementNotifications';

/** CORPS-0301d (BL-180, D-713, D-714) : rappel des mesures sur l'iPhone, réglage local, PC sans envoi. Valeurs inventées. */
const NOW_MS = Date.parse('2026-11-10T07:00:00Z'); // 08:00 à Paris
const ZONE = 'Europe/Paris';

function setup(scheduler: NotificationScheduler = createFakeNotificationScheduler(), samples = [{ kind: 'waist', date: '2026-11-08' as LocalDate }]) {
  const store = new Map<string, unknown>();
  const logs: string[] = [];
  let failWrite = false;
  const service = createMeasurementNotificationService({
    scheduler,
    clock: { nowMs: () => NOW_MS, zone: () => ZONE },
    settings: {
      get: (async (key: string) => (store.has(key) ? store.get(key) : null)) as never,
      set: (async (key: string, value: unknown) => {
        if (failWrite) throw new Error('écriture impossible');
        store.set(key, value);
      }) as never,
    },
    samples: async () => samples,
    log: (code) => logs.push(code),
  });
  return { service, store, logs, scheduler, failWrites: () => (failWrite = true) };
}
const fakeOf = (s: NotificationScheduler): FakeNotificationScheduler => s as FakeNotificationScheduler;

describe('famille « measurement »', () => {
  it('déclarée, acceptée par la validation commune et relue par le registre local', () => {
    expect(NOTIFICATION_KINDS).toContain('measurement');
    const req = { id: 'measurement:2026-11-15', fireAt: '2026-11-15T09:00' as LocalDateTime, title: 'Spartiate', body: 'texte', kind: 'measurement' as const };
    expect(() => validateRequests([req])).not.toThrow();
    const ledger = { v: 1, zone: null, focusEnd: null, entries: [{ n: 70001, sid: 'measurement:2026-11-15', at: 1, h: 'ab', kind: 'measurement' }] };
    expect(parseNotificationLedger(ledger).state).toBe('valid');
  });

  it('deux réglages locaux, sans valeur par défaut écrite (7 jours et rappel actif à la lecture)', () => {
    expect(SETTINGS_DEFINITIONS['bodyProgress.measurementRhythm']).toEqual({ scope: 'local', defaultValue: null });
    expect(SETTINGS_DEFINITIONS['bodyProgress.measurementReminder']).toEqual({ scope: 'local', defaultValue: null });
  });
});

describe('service du rappel des mesures', () => {
  it('par défaut : 7 jours, rappel actif, une notification neutre à 09:00 le jour prévu', async () => {
    const { service, scheduler } = setup();
    expect(await service.readPrefs()).toEqual({ rhythm: 7, reminder: true });
    expect(await service.replan()).toMatchObject({ status: 'planned', planned: 1 });
    const [request] = await scheduler.pending();
    expect(request).toMatchObject({ id: 'measurement:2026-11-15', fireAt: '2026-11-15T09:00', kind: 'measurement', title: measurementNotificationsFr.title, body: measurementNotificationsFr.body });
    expect(`${request?.title ?? ''} ${request?.body ?? ''}`.toLowerCase()).not.toMatch(/taille|cm|tour|bras|cuisse|\d/);
  });

  it('rythme de 14 jours enregistré (clé locale) et appliqué', async () => {
    const { service, store, scheduler } = setup();
    expect(await service.savePrefs({ rhythm: 14, reminder: true })).toMatchObject({ status: 'planned', planned: 1 });
    expect(store.get('bodyProgress.measurementRhythm')).toBe(14);
    expect(store.get('bodyProgress.measurementReminder')).toBe(true);
    expect((await scheduler.pending()).map((r) => r.id)).toEqual(['measurement:2026-11-22']);
    expect(await service.readPrefs()).toEqual({ rhythm: 14, reminder: true });
  });

  it('rappel coupé : retiré ; les autres familles sont reposées telles quelles ; rallumé : revient', async () => {
    const scheduler = createFakeNotificationScheduler();
    await scheduler.replace([{ id: 'supplement:2026-11-13T08:00', fireAt: '2026-11-13T08:00' as LocalDateTime, kind: 'supplement', title: 'x', body: 'y', category: 'supplement' }]);
    const { service } = setup(scheduler);
    await service.replan();
    expect((await scheduler.pending()).map((r) => r.kind).sort()).toEqual(['measurement', 'supplement']);
    expect(await service.savePrefs({ rhythm: 7, reminder: false })).toMatchObject({ status: 'planned', planned: 0 });
    expect((await scheduler.pending()).map((r) => r.kind)).toEqual(['supplement']);
    expect(await service.replan()).toMatchObject({ status: 'off', planned: 0 });
    await service.savePrefs({ rhythm: 7, reminder: true });
    expect((await scheduler.pending()).map((r) => r.kind).sort()).toEqual(['measurement', 'supplement']);
  });

  it('PC : « unsupported », rien n’est posé, le rythme est quand même enregistré', async () => {
    const { service, store, scheduler } = setup(createUnavailableNotificationScheduler());
    expect(await service.replan()).toMatchObject({ status: 'unsupported', planned: 0 });
    expect(await service.savePrefs({ rhythm: 28, reminder: true })).toMatchObject({ status: 'unsupported', planned: 0 });
    expect(store.get('bodyProgress.measurementRhythm')).toBe(28);
    expect(await scheduler.pending()).toEqual([]);
  });

  it('autorisation : jamais demandée au simple passage, demandée au geste qui rallume', async () => {
    const scheduler = createFakeNotificationScheduler();
    fakeOf(scheduler).setPermission('undetermined');
    const { service, logs } = setup(scheduler);
    expect(await service.replan()).toMatchObject({ status: 'permission' });
    expect(logs).toContain('measurement-notifications-permission');
    expect(await service.savePrefs({ rhythm: 7, reminder: true }, { askPermission: true })).toMatchObject({ status: 'planned', planned: 1 });
  });

  it('écriture du réglage impossible : échec dit (saveFailed), rien ne lève', async () => {
    const { service, failWrites } = setup();
    failWrites();
    expect(await service.savePrefs({ rhythm: 14, reminder: true })).toMatchObject({ status: 'failed', saveFailed: true });
  });

  it('aucune mesure : rien n’est posé', async () => {
    const { service, scheduler } = setup(createFakeNotificationScheduler(), []);
    expect(await service.replan()).toMatchObject({ status: 'planned', planned: 0 });
    expect(await scheduler.pending()).toEqual([]);
  });
});
