import { describe, expect, it, vi } from 'vitest';
import { createTauriLiveActivity, unsupportedLiveActivity, type LiveActivityInvoker } from './index';

/** SPA-007 lot D : façade de la Live Activity (iPhone) et stub PC / web. Les erreurs natives remontent en clair, jamais perdues. */
function rig(replies: Record<string, unknown>) {
  const calls: { command: string; args: unknown }[] = [];
  const invoke: LiveActivityInvoker = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    const reply = replies[command];
    if (reply instanceof Error || typeof reply === 'string') throw reply;
    return reply;
  });
  return { calls, liveActivity: createTauriLiveActivity({ invoke }) };
}

describe('Live Activity : adaptateur iPhone', () => {
  it('isAvailable : areActivitiesEnabled vrai', async () => {
    const { liveActivity, calls } = rig({ live_activity_status: { available: true } });
    expect(await liveActivity.isAvailable()).toEqual({ available: true });
    expect(calls[0]?.command).toBe('live_activity_status');
  });

  it('isAvailable : refusé, avec le motif (Live Activities coupées dans Réglages) et l’erreur native', async () => {
    const native = { domain: 'com.apple.ActivityKit.ActivityInput', code: 2, description: 'Activities are not enabled' };
    const { liveActivity } = rig({ live_activity_status: { available: false, reason: 'disabled', lastError: native } });
    expect(await liveActivity.isAvailable()).toEqual({ available: false, reason: 'disabled', error: native });
  });

  it('isAvailable : motif inconnu ou réponse illisible : « unknown », jamais « disponible »', async () => {
    expect(await rig({ live_activity_status: { available: false, reason: 'zzz' } }).liveActivity.isAvailable()).toEqual({ available: false, reason: 'unknown', error: null });
    expect(await rig({ live_activity_status: 'oups' }).liveActivity.isAvailable()).toMatchObject({ available: false, reason: 'unknown' });
    expect(await rig({ live_activity_status: new Error('boom') }).liveActivity.isAvailable()).toMatchObject({ available: false, reason: 'unknown' });
  });

  it('start : envoie la date de fin (ms) et le libellé', async () => {
    const { liveActivity, calls } = rig({ live_activity_start: { started: true } });
    expect(await liveActivity.start({ endDateMs: 1_800_000_060_000, label: 'Minuteur de test' })).toEqual({ started: true });
    expect(calls[0]).toEqual({ command: 'live_activity_start', args: { endDateMs: 1_800_000_060_000, label: 'Minuteur de test' } });
  });

  it('start : l’erreur native d’ActivityKit remonte en clair (domaine, code, description)', async () => {
    const native = { domain: 'com.apple.ActivityKit.ActivityInput', code: 4, description: 'Target does not include NSSupportsLiveActivities plist key' };
    const { liveActivity } = rig({ live_activity_start: { started: false, error: native } });
    expect(await liveActivity.start({ endDateMs: 1, label: 'x' })).toEqual({ started: false, reason: 'failed', error: native });
  });

  it('start : code de rejet du plugin (liveactivity-disabled) devient le motif « disabled »', async () => {
    const { liveActivity } = rig({ live_activity_start: 'liveactivity-disabled' });
    expect(await liveActivity.start({ endDateMs: 1, label: 'x' })).toEqual({ started: false, reason: 'disabled', error: null });
  });

  it('start : jamais de rejet vers l’appelant', async () => {
    const { liveActivity } = rig({ live_activity_start: new Error('crash') });
    await expect(liveActivity.start({ endDateMs: 1, label: 'x' })).resolves.toMatchObject({ started: false, reason: 'failed' });
  });

  it('end : nombre d’activités fermées ; échec visible', async () => {
    expect(await rig({ live_activity_end: { ended: true, count: 1 } }).liveActivity.end()).toEqual({ ended: true, count: 1 });
    expect(await rig({ live_activity_end: new Error('x') }).liveActivity.end()).toEqual({ ended: false, error: null });
    const native = { domain: 'd', code: 1, description: 'd' };
    expect(await rig({ live_activity_end: { ended: false, error: native } }).liveActivity.end()).toEqual({ ended: false, error: native });
  });

  it('description native tronquée à 200 signes', async () => {
    const long = 'x'.repeat(500);
    const result = await rig({ live_activity_status: { available: false, reason: 'disabled', lastError: { domain: 'd', code: 1, description: long } } }).liveActivity.isAvailable();
    expect(result.available === false && result.error?.description.length).toBe(200);
  });
});

describe('Live Activity : stub PC et web', () => {
  it('non disponible, sans erreur ni rejet', async () => {
    expect(await unsupportedLiveActivity.isAvailable()).toEqual({ available: false, reason: 'unsupported', error: null });
    expect(await unsupportedLiveActivity.start({ endDateMs: 1, label: 'x' })).toEqual({ started: false, reason: 'unsupported', error: null });
    expect(await unsupportedLiveActivity.end()).toEqual({ ended: true, count: 0 });
  });
});
