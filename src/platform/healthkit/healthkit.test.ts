import { describe, expect, it, vi } from 'vitest';
import {
  createTauriHealthKit,
  unsupportedHealthKit,
  type HealthKitInvoker,
} from './index';

function rig(replies: Record<string, unknown>) {
  const calls: string[] = [];
  const invoke: HealthKitInvoker = vi.fn(async (command: string) => {
    calls.push(command);
    const reply = replies[command];
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { calls, healthKit: createTauriHealthKit({ invoke }) };
}

describe('HealthKit platform adapter (SPA-006)', () => {
  it('distinguishes available, unavailable, and failed status reads', async () => {
    expect(await rig({ healthkit_status: { available: true } }).healthKit.availability()).toBe('available');
    expect(await rig({ healthkit_status: { available: false } }).healthKit.availability()).toBe('unavailable');
    expect(await rig({ healthkit_status: new Error('native failure') }).healthKit.availability()).toBe('error');
  });

  it('keeps a completed authorization request separate from confirmed read access', async () => {
    const pending = rig({ healthkit_authorize: { permission: 'unknown' } });
    expect(await pending.healthKit.requestAuthorization()).toBe('unknown');
    expect(pending.calls).toEqual(['healthkit_authorize']);

    const denied = rig({ healthkit_authorize: { permission: 'denied' } });
    expect(await denied.healthKit.requestAuthorization()).toBe('denied');

    const failed = rig({ healthkit_authorize: new Error('native failure') });
    expect(await failed.healthKit.requestAuthorization()).toBe('error');
  });

  it('returns a synthetic body-mass sample with its unit, timestamp, timezone, and provenance', async () => {
    const sample = {
      state: 'granted',
      value: {
        kg: 72.4,
        measuredAt: '2026-11-04T06:30:00.000Z',
        timezone: 'Europe/Paris',
        uuid: 'sample-body-mass-1',
        source: { name: 'HealthKit fixture', bundleIdentifier: 'test.fixture' },
      },
    };
    const r = rig({ healthkit_body_mass_today: sample });
    expect(await r.healthKit.bodyMassToday()).toEqual(sample);
    expect(r.calls).toEqual(['healthkit_body_mass_today']);
  });

  it('keeps absent body-mass data empty instead of treating it as zero or a refusal', async () => {
    const r = rig({ healthkit_body_mass_today: { state: 'empty' } });
    expect(await r.healthKit.bodyMassToday()).toEqual({ state: 'empty' });
  });

  it('returns a daily step sum with explicit local-day bounds, timezone, and provenance', async () => {
    const result = {
      state: 'granted',
      value: {
        count: 4821,
        unit: 'count',
        start: '2026-11-03T23:00:00.000Z',
        end: '2026-11-04T23:00:00.000Z',
        timezone: 'Europe/Paris',
        sources: [{ name: 'HealthKit fixture', bundleIdentifier: 'test.fixture' }],
      },
    };
    const r = rig({ healthkit_step_count_today: result });
    expect(await r.healthKit.stepCountToday()).toEqual(result);
    expect(r.calls).toEqual(['healthkit_step_count_today']);
  });

  it('keeps an empty step query distinct from a zero-count result', async () => {
    const r = rig({ healthkit_step_count_today: { state: 'empty' } });
    expect(await r.healthKit.stepCountToday()).toEqual({ state: 'empty' });
  });

  it('keeps explicit denied, unavailable, and error read outcomes distinct', async () => {
    const denied = rig({ healthkit_body_mass_today: { state: 'denied' } });
    const unavailable = rig({ healthkit_step_count_today: { state: 'unavailable' } });
    const failed = rig({ healthkit_step_count_today: new Error('private native message') });

    expect(await denied.healthKit.bodyMassToday()).toEqual({ state: 'denied' });
    expect(await unavailable.healthKit.stepCountToday()).toEqual({ state: 'unavailable' });
    expect(await failed.healthKit.stepCountToday()).toEqual({ state: 'error' });
  });

  it('returns unsupported on Windows without invoking native commands', async () => {
    const healthKit = unsupportedHealthKit;
    expect(await healthKit.availability()).toBe('unsupported');
    expect(await healthKit.requestAuthorization()).toBe('unsupported');
    expect(await healthKit.bodyMassToday()).toEqual({ state: 'unsupported' });
    expect(await healthKit.stepCountToday()).toEqual({ state: 'unsupported' });
  });
});
