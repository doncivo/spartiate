import { describe, expect, it, vi } from 'vitest';
import { TIMER_NOTIFICATION_ID } from '../../domain/syntheticTimer';
import { createIosTimerNotifier, createUnavailableTimerNotifier } from './timerNotification';
import type { IosNotificationBridge } from './tauriNotifications';

/** SPA-007 lot D : notification locale du minuteur de test (identifiant fixe, jamais de doublon, secondes honorées, refus visible). */
function bridgeRig(overrides: Partial<IosNotificationBridge> = {}, now = Date.parse('2026-11-06T09:00:00.000Z')) {
  const calls: string[] = [];
  const shown: Parameters<IosNotificationBridge['show']>[0][] = [];
  const bridge: IosNotificationBridge = {
    show: vi.fn(async (payload) => {
      calls.push('show');
      shown.push(payload);
    }),
    cancel: vi.fn(async () => void calls.push('cancel')),
    pending: vi.fn(async () => []),
    permission: vi.fn(async () => 'granted' as const),
    requestPermission: vi.fn(async () => 'granted' as const),
    ...overrides,
  };
  const notifier = createIosTimerNotifier({ bridge, clock: { nowMs: () => now, zone: () => 'Europe/Paris' } });
  return { notifier, bridge, calls, shown };
}

describe('notification du minuteur (iPhone)', () => {
  it('identifiant fixe réservé ; l’ancienne notification est annulée avant la nouvelle (pas de doublon)', async () => {
    const r = bridgeRig();
    const endMs = Date.parse('2026-11-06T09:01:23.000Z');
    expect(await r.notifier.schedule({ endMs, title: 'Minuteur terminé', body: 'Fini' })).toBe(true);
    expect(r.calls).toEqual(['cancel', 'show']);
    expect(r.bridge.cancel).toHaveBeenCalledWith([TIMER_NOTIFICATION_ID]);
    expect(r.shown[0]?.id).toBe(TIMER_NOTIFICATION_ID);
    expect(r.shown[0]?.title).toBe('Minuteur terminé');
  });

  it('l’échéance garde les secondes (heure murale locale, Z littéral : 10:01:23 à Paris)', async () => {
    const r = bridgeRig();
    await r.notifier.schedule({ endMs: Date.parse('2026-11-06T09:01:23.000Z'), title: 't', body: 'b' });
    expect(r.shown[0]?.schedule.at.date).toBe('2026-11-06T10:01:23.000Z');
    expect(r.shown[0]?.schedule.at.repeating).toBe(false);
  });

  it('clôture I0 : sonne à la seconde de l’échéance, jamais avant (arrondi à la seconde SUPÉRIEURE, pas à la minute)', async () => {
    const r = bridgeRig();
    await r.notifier.schedule({ endMs: Date.parse('2026-11-06T09:01:23.400Z'), title: 't', body: 'b' });
    expect(r.shown[0]?.schedule.at.date).toBe('2026-11-06T10:01:24.000Z');
    await r.notifier.schedule({ endMs: Date.parse('2026-11-06T09:01:59.001Z'), title: 't', body: 'b' });
    expect(r.shown[1]?.schedule.at.date).toBe('2026-11-06T10:02:00.000Z');
    await r.notifier.schedule({ endMs: Date.parse('2026-11-06T09:01:00.000Z'), title: 't', body: 'b' });
    expect(r.shown[2]?.schedule.at.date).toBe('2026-11-06T10:01:00.000Z');
  });

  it('la reprise redonne exactement la même date et le même identifiant (pas de doublon)', async () => {
    const r = bridgeRig();
    const input = { endMs: Date.parse('2026-11-06T09:01:23.400Z'), title: 't', body: 'b' };
    await r.notifier.schedule(input);
    await r.notifier.schedule(input);
    expect(r.shown[0]?.schedule.at.date).toBe(r.shown[1]?.schedule.at.date);
    expect(new Set(r.shown.map((p) => p.id))).toEqual(new Set([TIMER_NOTIFICATION_ID]));
    expect(r.calls).toEqual(['cancel', 'show', 'cancel', 'show']);
  });

  it('une échéance à moins de 5 s n’est pas transmise (iOS la refuserait) : faux, dit', async () => {
    const r = bridgeRig({}, Date.parse('2026-11-06T09:01:20.000Z'));
    expect(await r.notifier.schedule({ endMs: Date.parse('2026-11-06T09:01:23.000Z'), title: 't', body: 'b' })).toBe(false);
    expect(r.bridge.show).not.toHaveBeenCalled();
  });

  it('échec de l’envoi : faux, jamais une exception', async () => {
    const r = bridgeRig({ show: async () => Promise.reject(new Error('refusé')) });
    expect(await r.notifier.schedule({ endMs: Date.parse('2026-11-06T09:01:23.000Z'), title: 't', body: 'b' })).toBe(false);
  });

  it('en attente : vrai seulement si l’identifiant du minuteur y est', async () => {
    expect(await bridgeRig({ pending: async () => [{ id: TIMER_NOTIFICATION_ID, title: 't', body: null }] }).notifier.isPending()).toBe(true);
    expect(await bridgeRig({ pending: async () => [{ id: 99_999, title: 't', body: null }] }).notifier.isPending()).toBe(false);
    expect(await bridgeRig({ pending: async () => Promise.reject(new Error('x')) }).notifier.isPending()).toBe(false);
  });

  it('autorisation : accordée, refusée, indécise ; plugin absent = indisponible', async () => {
    expect(await bridgeRig().notifier.permission()).toBe('granted');
    expect(await bridgeRig({ permission: async () => 'denied' }).notifier.permission()).toBe('denied');
    expect(await bridgeRig({ permission: async () => 'undetermined' }).notifier.permission()).toBe('undetermined');
    expect(await bridgeRig({ permission: async () => Promise.reject(new Error('plugin notification not found')) }).notifier.permission()).toBe('unavailable');
  });

  it('annulation : par la liste de l’identifiant du minuteur seulement', async () => {
    const r = bridgeRig();
    await r.notifier.cancel();
    expect(r.bridge.cancel).toHaveBeenCalledWith([TIMER_NOTIFICATION_ID]);
  });
});

describe('notification du minuteur (PC et web)', () => {
  it('indisponible, sans erreur', async () => {
    const notifier = createUnavailableTimerNotifier();
    expect(await notifier.permission()).toBe('unavailable');
    expect(await notifier.requestPermission()).toBe('unavailable');
    expect(await notifier.isPending()).toBe(false);
    expect(await notifier.schedule({ endMs: 1, title: 't', body: 'b' })).toBe(false);
    await expect(notifier.cancel()).resolves.toBeUndefined();
  });
});
