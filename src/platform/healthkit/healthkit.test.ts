import { describe, expect, it, vi } from 'vitest';
import {
  createTauriHealthKit,
  isMissingHealthKitEntitlement,
  unsupportedHealthKit,
  type HealthKitInvoker,
} from './index';

function rig(replies: Record<string, unknown>) {
  const calls: string[] = [];
  const invoke: HealthKitInvoker = vi.fn(async (command: string) => {
    calls.push(command);
    const reply = replies[command];
    if (reply instanceof Error || typeof reply === 'string') throw reply;
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

    const explicitDenial = rig({ healthkit_authorize: 'healthkit-denied' });
    expect(await explicitDenial.healthKit.requestAuthorization()).toBe('denied');

    const falseGrant = rig({ healthkit_authorize: { permission: 'granted' } });
    expect(await falseGrant.healthKit.requestAuthorization()).toBe('error');
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
    const denied = rig({ healthkit_body_mass_today: 'healthkit-denied' });
    const unavailable = rig({ healthkit_step_count_today: { state: 'unavailable' } });
    const failed = rig({ healthkit_step_count_today: new Error('private native message') });

    expect(await denied.healthKit.bodyMassToday()).toEqual({ state: 'denied' });
    expect(await unavailable.healthKit.stepCountToday()).toEqual({ state: 'unavailable' });
    expect(await failed.healthKit.stepCountToday()).toEqual({ state: 'error', code: 'healthkit-step-count-failed' });
  });

  it('returns unsupported on Windows without invoking native commands', async () => {
    const healthKit = unsupportedHealthKit;
    expect(await healthKit.availability()).toBe('unsupported');
    expect(await healthKit.requestAuthorization()).toBe('unsupported');
    expect(await healthKit.bodyMassToday()).toEqual({ state: 'unsupported' });
    expect(await healthKit.stepCountToday()).toEqual({ state: 'unsupported' });
  });
});

describe('HealthKit diagnostic natif (0.1.3)', () => {
  const NATIVE = { domain: 'com.apple.healthkit', code: 4, description: 'Missing com.apple.developer.healthkit entitlement.' };

  it('rend le statut complet : disponibilité, texte d’usage et dernière erreur native (domaine, code, description)', async () => {
    const { healthKit, calls } = rig({ healthkit_status: { available: true, usageDescription: true, lastError: NATIVE } });
    expect(await healthKit.diagnostic()).toEqual({ available: true, usageDescription: true, error: NATIVE });
    expect(calls).toEqual(['healthkit_status']);
  });

  it('sans erreur native : error est null ; une valeur absente reste inconnue (null), jamais inventée', async () => {
    expect(await rig({ healthkit_status: { available: false, usageDescription: false } }).healthKit.diagnostic()).toEqual({
      available: false,
      usageDescription: false,
      error: null,
    });
    expect(await rig({ healthkit_status: {} }).healthKit.diagnostic()).toEqual({ available: null, usageDescription: null, error: null });
  });

  it('une erreur malformée est ignorée ; une description trop longue est tronquée', async () => {
    const bad = rig({ healthkit_status: { available: true, usageDescription: true, lastError: { domain: 3, code: 'x' } } });
    expect((await bad.healthKit.diagnostic()).error).toBeNull();
    const long = rig({ healthkit_status: { available: true, usageDescription: true, lastError: { ...NATIVE, description: 'x'.repeat(900) } } });
    expect((await long.healthKit.diagnostic()).error?.description.length).toBeLessThanOrEqual(200);
  });

  it('échec du statut natif : tout reste inconnu, sans exception', async () => {
    expect(await rig({ healthkit_status: new Error('native failure') }).healthKit.diagnostic()).toEqual({
      available: null,
      usageDescription: null,
      error: null,
    });
  });

  it('hors iPhone : rien à diagnostiquer', async () => {
    expect(await unsupportedHealthKit.diagnostic()).toEqual({ available: null, usageDescription: null, error: null });
  });

  it('la réponse de authorize qui porte l’erreur native reste une erreur de demande', async () => {
    const failed = rig({ healthkit_authorize: { permission: 'error', error: NATIVE } });
    expect(await failed.healthKit.requestAuthorization()).toBe('error');
  });
});

describe('entitlement HealthKit absent : compte Apple gratuit (0.1.4 point 6)', () => {
  it('reconnaît « Missing com.apple.developer.healthkit entitlement » (code 4 de Santé, capture du 6 nov.)', () => {
    expect(isMissingHealthKitEntitlement({ domain: 'com.apple.healthkit', code: 4, description: 'Missing com.apple.developer.healthkit entitlement.' })).toBe(true);
    expect(isMissingHealthKitEntitlement({ domain: 'com.apple.healthkit', code: 4, description: 'MISSING COM.APPLE.DEVELOPER.HEALTHKIT ENTITLEMENT' })).toBe(true);
  });

  it('ne confond pas avec un refus de l’utilisateur ni avec une absence d’erreur', () => {
    expect(isMissingHealthKitEntitlement({ domain: 'com.apple.healthkit', code: 5, description: 'Authorization not determined' })).toBe(false);
    expect(isMissingHealthKitEntitlement({ domain: 'com.apple.healthkit', code: 4, description: 'Authorization denied' })).toBe(false);
    expect(isMissingHealthKitEntitlement(null)).toBe(false);
  });
});
