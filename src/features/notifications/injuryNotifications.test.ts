import { describe, expect, it } from 'vitest';
import { declareInjury, type InjuriesValue } from '../../domain/training/injuries';
import type { LocalDate } from '../../domain/types';
import { injuryNotificationsFr } from '../../i18n/fr.injuryNotifications';
import { createFakeNotificationScheduler, createUnavailableNotificationScheduler, type FakeNotificationScheduler, type NotificationScheduler } from '../../platform/notifications';
import { createInjuryNotificationService, type InjuryNotificationDeps } from './injuryNotifications';

/** BLESSURES-b : rappel de check-in, iPhone seulement, texte neutre, autres natures reposées. */
const NOW_MS = Date.parse('2026-11-02T07:00:00Z'); // 08:00 à Paris
const ZONE = 'Europe/Paris';
const injuries = (): InjuriesValue => {
  const r = declareInjury({ v: 1, items: [] }, { id: 'g1', muscleId: 'chest', patterns: [], startedOn: '2026-11-01' as LocalDate, note: 'très privé' }, '2026-11-02' as LocalDate);
  if (!r.ok) throw new Error(r.issue);
  return r.value;
};

function setup(scheduler: NotificationScheduler = createFakeNotificationScheduler(), value: unknown = injuries()) {
  const logs: string[] = [];
  const service = createInjuryNotificationService({
    scheduler,
    clock: { nowMs: () => NOW_MS, zone: () => ZONE },
    settings: { get: (async () => value) as InjuryNotificationDeps['settings']['get'] },
    log: (code) => logs.push(code),
  });
  return { service, logs, scheduler };
}
const fakeOf = (s: NotificationScheduler): FakeNotificationScheduler => s as FakeNotificationScheduler;

describe('rappel de check-in des gênes', () => {
  it("PC : « unsupported », rien n'est planifié", async () => {
    const { service, scheduler } = setup(createUnavailableNotificationScheduler());
    expect(await service.replan()).toMatchObject({ status: 'unsupported', planned: 0 });
    expect(await scheduler.pending()).toEqual([]);
  });

  it('une notification neutre au jour d\'échéance, sans la note ni « gêne »', async () => {
    const { service, scheduler } = setup(createFakeNotificationScheduler());
    expect(await service.replan()).toMatchObject({ status: 'planned', planned: 1 });
    const [request] = await scheduler.pending();
    expect(request).toMatchObject({ id: 'injury:2026-11-15', fireAt: '2026-11-15T09:00', kind: 'injury' });
    const text = `${request?.title ?? ''} ${request?.body ?? ''}`;
    expect(text).toContain(injuryNotificationsFr.title);
    expect(text.toLowerCase()).not.toMatch(/gêne|blessure|douleur|privé/);
  });

  it('aucune gêne active : les rappels déjà posés sont retirés ; les autres natures sont gardées', async () => {
    const scheduler = createFakeNotificationScheduler();
    await scheduler.requestPermission();
    await scheduler.replace([
      { id: 'injury:2026-11-15', fireAt: '2026-11-15T09:00' as never, kind: 'injury', title: 'x', body: 'y' },
      { id: 'supplement:2026-11-13T08:00', fireAt: '2026-11-13T08:00' as never, kind: 'supplement', title: 'x', body: 'y', category: 'supplement' },
    ]);
    const { service } = setup(scheduler, { v: 1, items: [] });
    await service.replan();
    expect((await scheduler.pending()).map((r) => r.kind)).toEqual(['supplement']);
    expect(fakeOf(scheduler).calls.length).toBeGreaterThan(0);
  });
});
