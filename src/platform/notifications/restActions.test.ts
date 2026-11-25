import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { REST_NOTIFICATION_ID } from '../../domain/syntheticTimer';
import type { RawRestAction } from '../../domain/restNotificationActions';
import { createFakeNotificationActionSource } from './fakeActions';
import { parseDrain } from './tauriNotificationActions';
import { createIosTimerNotifier } from './timerNotification';
import type { IosNotificationBridge } from './tauriNotifications';

/**
 * SHELL-0294b (§ 13.3 b, BL-108) : la notification de fin de repos porte la catégorie « sp.rest » (« +30 s », « Passer ») ; le fichier natif
 * rend ces actions à part des actions de rappel (`rest`), jamais comptées illisibles ; le plugin Swift les accepte.
 */
const AT = 1_764_064_800_000;
const LINE = { n: REST_NOTIFICATION_ID, a: 'extend30', t: AT + 2_000, sid: 'timer:rest', at: AT };
const rest = (over: Partial<RawRestAction> = {}): RawRestAction => ({ numericId: REST_NOTIFICATION_ID, actionId: 'extend30', receivedAtMs: AT + 2_000, sid: 'timer:rest', deliveredAt: AT, ...over });

function rig(kind: 'test' | 'rest') {
  const shown: Parameters<IosNotificationBridge['show']>[0][] = [];
  const bridge: IosNotificationBridge = {
    show: vi.fn(async (payload) => void shown.push(payload)),
    cancel: vi.fn(async () => undefined),
    pending: vi.fn(async () => []),
    permission: vi.fn(async () => 'granted' as const),
    requestPermission: vi.fn(async () => 'granted' as const),
  };
  return { shown, notifier: createIosTimerNotifier({ bridge, clock: { nowMs: () => AT - 60_000, zone: () => 'Europe/Paris' }, kind }) };
}

describe('notification de fin de repos : catégorie d’actions', () => {
  it('repos : actionTypeId « sp.rest » ; minuteur de test : aucune catégorie', async () => {
    const r = rig('rest');
    expect(await r.notifier.schedule({ endMs: AT, title: 'Repos terminé', body: 'b' })).toBe(true);
    expect(r.shown[0]?.actionTypeId).toBe('sp.rest');
    expect(r.shown[0]?.extra).toEqual({ sid: 'timer:rest', at: String(AT) });
    const t = rig('test');
    await t.notifier.schedule({ endMs: AT, title: 't', body: 'b' });
    expect(t.shown[0] && 'actionTypeId' in t.shown[0]).toBe(false);
  });
});

describe('fichier natif : actions de repos à part', () => {
  it('parseDrain range « extend30 » et « skip » dans `rest`, jamais dans `entries` ni dans `unreadable`', () => {
    const drain = parseDrain({ entries: [LINE, { ...LINE, a: 'skip' }, { n: 1, a: 'done', t: AT, sid: 'supplement:x', at: AT }], lines: 3, unreadable: 0, writeFailures: 0 });
    expect(drain.rest).toEqual([rest(), rest({ actionId: 'skip' })]);
    expect(drain.entries.map((e) => e.actionId)).toEqual(['done']);
    expect(drain.unreadable).toBe(0);
    expect(drain.lines).toBe(3);
  });

  it('faux : une action de repos écrite est rendue dans `rest`, comptée dans les lignes, retirée par ack', async () => {
    const source = createFakeNotificationActionSource();
    source.push(rest());
    const drain = await source.drain();
    expect(drain.rest).toEqual([rest()]);
    expect(drain.entries).toEqual([]);
    expect(drain.lines).toBe(1);
    await source.ack({ lines: 1, writeFailures: 0 });
    expect((await source.drain()).lines).toBe(0);
  });
});

describe('plugin Swift notification-actions : actions de repos acceptées', () => {
  const swift = readFileSync(join(__dirname, '..', '..', '..', 'src-tauri/plugins/notification-actions/ios/Sources/NotificationActionsPlugin.swift'), 'utf8');
  it('knownActions : done, snooze15, extend30, skip', () => {
    expect(swift).toContain('private let knownActions: Set<String> = ["done", "snooze15", "extend30", "skip"]');
  });
});
