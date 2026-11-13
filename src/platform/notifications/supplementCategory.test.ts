import { describe, expect, it } from 'vitest';
import type { LocalDateTime } from '../../domain/types';
import { createFakeBridge, createMemoryLedger } from './fakeBridge';
import { createLedgerStore } from './notificationLedger';
import { createTauriNotificationActionSource } from './tauriNotificationActions';
import { createTauriNotificationScheduler } from './tauriNotifications';
import type { NotificationRequest } from './types';

/**
 * FIX-0221 (D-250) : catégorie « complément » sur l'iPhone. La notification de complément porte la catégorie `sp.supplement` (bouton « Pris ») ;
 * relue par `pending()`, elle la garde, pour qu'un passage de la récupération qui la repose telle quelle ne retire pas le bouton. L'action
 * « Pris » est enregistrée SANS premier plan (`foreground: false`) : l'app ne s'ouvre pas.
 */
const NOW = Date.UTC(2026, 10, 13, 6, 0, 0); // 07:00 à Paris

function rig() {
  const bridge = createFakeBridge();
  const store = createLedgerStore(createMemoryLedger());
  const scheduler = createTauriNotificationScheduler({ bridge, ledger: store, clock: { nowMs: () => NOW, zone: () => 'Europe/Paris' } });
  return { bridge, scheduler };
}

const supplementRequest: NotificationRequest = { id: 'supplement:2026-11-13T08:00', fireAt: '2026-11-13T08:00' as LocalDateTime, title: 'Compléments', body: 'Une prise à cocher.', kind: 'supplement', category: 'supplement' };

describe('catégorie « complément » (FIX-0221)', () => {
  it('envoi : actionTypeId `sp.supplement`, extra sid et échéance', async () => {
    const { bridge, scheduler } = rig();
    await scheduler.replace([supplementRequest]);
    expect(bridge.shown).toHaveLength(1);
    expect(bridge.shown[0]).toMatchObject({ actionTypeId: 'sp.supplement', extra: { sid: 'supplement:2026-11-13T08:00' } });
  });

  it('pending() rend la catégorie ; reposée telle quelle, la notification est inchangée (aucun renvoi, bouton gardé)', async () => {
    const { bridge, scheduler } = rig();
    await scheduler.replace([supplementRequest]);
    const pending = await scheduler.pending();
    expect(pending).toEqual([supplementRequest]);
    const report = await scheduler.replace(pending);
    expect(report).toMatchObject({ scheduled: 0, kept: 1 });
    expect(bridge.shown.every((payload) => payload.actionTypeId === 'sp.supplement')).toBe(true);
  });

  it('registerActionTypes transmet `foreground: false` et le texte d’écran verrouillé', async () => {
    const calls: { command: string; args?: Record<string, unknown> }[] = [];
    const source = createTauriNotificationActionSource(async (command, args) => {
      calls.push({ command, ...(args === undefined ? {} : { args }) });
      return { registered: 1 };
    });
    await source.registerActionTypes([{ id: 'sp.supplement', actions: [{ id: 'done', title: 'Pris', foreground: false }], hiddenPreviewsBodyPlaceholder: 'Prise à cocher' }]);
    expect(calls).toEqual([
      { command: 'plugin:notification-actions|register_action_types', args: { types: [{ id: 'sp.supplement', actions: [{ id: 'done', title: 'Pris', foreground: false }], hiddenPreviewsBodyPlaceholder: 'Prise à cocher' }] } },
    ]);
  });
});
