import { describe, expect, it } from 'vitest';
import { ALL_DAYS, type Supplement, type SupplementIntake } from '../../domain/nutrition/supplements';
import type { LocalDate, LocalDateTime, LocalTime } from '../../domain/types';
import { supplementNotificationsFr } from '../../i18n/fr.supplementNotifications';
import { createFakeNotificationScheduler, createUnavailableNotificationScheduler, NotificationSchedulerError, type FakeNotificationScheduler, type NotificationScheduler } from '../../platform/notifications';
import { createSupplementNotificationService, type SupplementNotificationDeps } from './supplementNotifications';

/** I6-05 (D-212) : service des rappels de compléments — iPhone seulement, désactivé par défaut, texte neutre sans nom, fenêtre des 64 partagée. */
const NOW_MS = Date.parse('2026-11-13T06:00:00Z'); // 07:00 à Paris, vendredi
const ZONE = 'Europe/Paris';
const sup: Supplement = { id: '30000000-0000-4000-8000-000000000001', name: 'Créatine secrète', dose: 5, unit: 'g', times: ['08:00' as LocalTime, '20:00' as LocalTime], days: ALL_DAYS, active: true, since: '2026-11-01' as LocalDate };

function setup(scheduler: NotificationScheduler = createFakeNotificationScheduler(), over: Partial<SupplementNotificationDeps> = {}) {
  const store = new Map<string, unknown>();
  const logs: string[] = [];
  let intakes: SupplementIntake[] = [];
  const service = createSupplementNotificationService({
    scheduler,
    clock: { nowMs: () => NOW_MS, zone: () => ZONE },
    settings: {
      get: (async (key: string) => store.get(key) ?? null) as SupplementNotificationDeps['settings']['get'],
      set: (async (key: string, value: unknown) => {
        store.set(key, value);
      }) as SupplementNotificationDeps['settings']['set'],
    },
    load: async () => ({ supplements: [sup], intakes }),
    log: (code) => logs.push(code),
    ...over,
  });
  return { service, store, logs, scheduler, setIntakes: (v: SupplementIntake[]) => (intakes = v) };
}
const fakeOf = (s: NotificationScheduler): FakeNotificationScheduler => s as FakeNotificationScheduler;

describe('rappels de compléments', () => {
  it('PC (implémentation vide) : « unsupported », rien n’est lu', async () => {
    let read = false;
    const { service, store } = setup(createUnavailableNotificationScheduler(), {
      load: async () => {
        read = true;
        return { supplements: [sup], intakes: [] };
      },
    });
    store.set('supplements.notificationPrefs', { v: 1, enabled: true });
    expect(await service.replan()).toMatchObject({ status: 'unsupported', planned: 0 });
    expect(read).toBe(false);
  });

  it('désactivé par défaut : aucun appel de planification', async () => {
    const { service, scheduler } = setup();
    expect(await service.readPrefs()).toEqual({ v: 1, enabled: false });
    expect(await service.replan()).toMatchObject({ status: 'off', planned: 0 });
    expect(fakeOf(scheduler).calls.filter((c) => c.type === 'replace')).toEqual([]);
  });

  it('activé : 6 notifications neutres (aucun nom), réglage local enregistré', async () => {
    const { service, scheduler, store } = setup();
    expect(await service.setPrefs({ v: 1, enabled: true })).toMatchObject({ status: 'planned', planned: 6 });
    expect(store.get('supplements.notificationPrefs')).toEqual({ v: 1, enabled: true });
    const pending = await scheduler.pending();
    expect(pending.map((r) => [r.id, r.fireAt, r.kind])).toContainEqual(['supplement:2026-11-13T08:00', '2026-11-13T08:00' as LocalDateTime, 'supplement']);
    for (const r of pending) {
      expect(r.title).toBe(supplementNotificationsFr.title);
      expect(`${r.title} ${r.body}`).not.toContain('Créatine');
    }
    expect(pending[0]?.body).toBe(supplementNotificationsFr.bodyOne);
  });

  it('prise cochée : la notification de cette heure disparaît au passage suivant', async () => {
    const { service, scheduler, setIntakes } = setup();
    await service.setPrefs({ v: 1, enabled: true });
    setIntakes([{ supplementId: sup.id, date: '2026-11-13' as LocalDate, moment: '08:00' as LocalTime }]);
    expect(await service.replan()).toMatchObject({ planned: 5 });
    expect((await scheduler.pending()).map((r) => r.id)).not.toContain('supplement:2026-11-13T08:00');
  });

  it('fenêtre des 64 partagée : les notifications d’autres natures sont reposées, les nôtres se réduisent', async () => {
    const scheduler = createFakeNotificationScheduler();
    const others = Array.from({ length: 60 }, (_, i) => ({ id: `bedtime:x${String(i)}`, fireAt: '2026-11-20T22:30' as LocalDateTime, title: 'Coucher', body: 'b', kind: 'bedtime' as const }));
    await scheduler.replace(others);
    fakeOf(scheduler).setOutsidePlan(1);
    const { service } = setup(scheduler);
    expect(await service.setPrefs({ v: 1, enabled: true })).toMatchObject({ status: 'planned', planned: 3 });
    const pending = await scheduler.pending();
    expect(pending.filter((r) => r.kind === 'bedtime')).toHaveLength(60);
    expect(pending.filter((r) => r.kind === 'supplement').map((r) => r.id)).toEqual(['supplement:2026-11-13T08:00', 'supplement:2026-11-13T20:00', 'supplement:2026-11-14T08:00']);
  });

  it('désactivé après coup : les nôtres sont retirées, les autres gardées', async () => {
    const scheduler = createFakeNotificationScheduler();
    await scheduler.replace([{ id: 'morning:2026-11-14', fireAt: '2026-11-14T08:00' as LocalDateTime, title: 'Matin', body: 'b', kind: 'morning' }]);
    const { service } = setup(scheduler);
    await service.setPrefs({ v: 1, enabled: true });
    expect(await service.setPrefs({ v: 1, enabled: false })).toMatchObject({ status: 'planned', planned: 0 });
    expect((await scheduler.pending()).map((r) => r.kind)).toEqual(['morning']);
  });

  it('autorisation refusée : état visible, rien posé ; échec du planificateur : « failed » avec la raison, journal par code seulement', async () => {
    const a = setup();
    fakeOf(a.scheduler).setPermission('denied');
    expect(await a.service.setPrefs({ v: 1, enabled: true })).toMatchObject({ status: 'permission' });
    const b = setup();
    fakeOf(b.scheduler).failNextReplace(new NotificationSchedulerError('schedule-failed'));
    expect(await b.service.setPrefs({ v: 1, enabled: true })).toMatchObject({ status: 'failed', reason: 'schedule-failed' });
    expect(b.logs).toEqual(['supplement-notifications-failed']);
  });
});
