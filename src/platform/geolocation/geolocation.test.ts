import { afterEach, describe, expect, it, vi } from 'vitest';
import { geolocationExpected, resolveGeolocation, setGeolocation, unavailableGeolocation, type GeoEvent, type Geolocation } from './index';
import { createTauriGeolocation, type GeolocationPluginModule } from './tauriGeolocation';

/**
 * I6-06 (D-222) : façade de la géolocalisation. PC et navigateur : stub sans GPS (saisie manuelle). iPhone installé : plugin officiel chargé à la
 * demande. Le plugin est remplacé par un faux module : positions SYNTHÉTIQUES, aucun appareil.
 */
afterEach(() => setGeolocation(null));

function fakePlugin(over: Partial<GeolocationPluginModule> = {}) {
  let cb: Parameters<GeolocationPluginModule['watchPosition']>[1] = () => undefined;
  const calls = { requested: [] as unknown[], cleared: [] as number[], options: [] as unknown[] };
  const plugin: GeolocationPluginModule = {
    checkPermissions: async () => ({ location: 'prompt' }),
    requestPermissions: async (p) => {
      calls.requested.push(p);
      return { location: 'granted' };
    },
    watchPosition: async (options, c) => {
      calls.options.push(options);
      cb = c;
      return 7;
    },
    clearWatch: async (id) => {
      calls.cleared.push(id);
    },
    ...over,
  };
  return { plugin, calls, emit: (...args: Parameters<typeof cb>) => cb(...args) };
}

describe('choix de la façade', () => {
  it('PC (Windows) et navigateur : stub sans GPS ; iPhone installé : GPS attendu', async () => {
    for (const [runtime, os] of [['tauri', 'windows'], ['web', 'ios'], ['web', 'other']] as const) {
      expect(geolocationExpected(runtime, os)).toBe(false);
      expect(await resolveGeolocation(runtime, os)()).toBe(unavailableGeolocation);
    }
    expect(geolocationExpected('tauri', 'ios')).toBe(true);
  });

  it('stub : aucune permission, le suivi rend « indisponible » sans rien suivre', async () => {
    expect(unavailableGeolocation.available).toBe(false);
    expect(await unavailableGeolocation.permission()).toBe('denied');
    expect(await unavailableGeolocation.request()).toBe('denied');
    const events: GeoEvent[] = [];
    const stop = await unavailableGeolocation.watch((e) => events.push(e));
    expect(events).toEqual([{ kind: 'error', code: 'unavailable' }]);
    await stop();
  });

  it('façade injectée (tests, e2e) : prioritaire partout', async () => {
    const fake: Geolocation = { ...unavailableGeolocation, available: true };
    setGeolocation(fake);
    expect(geolocationExpected('web', 'other')).toBe(true);
    expect(await resolveGeolocation('tauri', 'windows')()).toBe(fake);
  });
});

describe('façade sur le plugin officiel (iPhone)', () => {
  it('permission : état lu, demande « location » seulement ; service coupé (rejet) : « refusé »', async () => {
    const { plugin, calls } = fakePlugin();
    const geo = await createTauriGeolocation(async () => plugin);
    expect(geo.available).toBe(true);
    expect(await geo.permission()).toBe('prompt');
    expect(await geo.request()).toBe('granted');
    expect(calls.requested).toEqual([['location']]);
    const off = await createTauriGeolocation(async () => fakePlugin({ checkPermissions: () => Promise.reject(new Error('service coupé')), requestPermissions: () => Promise.reject(new Error('service coupé')) }).plugin);
    expect(await off.permission()).toBe('denied');
    expect(await off.request()).toBe('denied');
    for (const [state, expected] of [['granted', 'granted'], ['denied', 'denied'], ['prompt-with-rationale', 'prompt']] as const) {
      const g = await createTauriGeolocation(async () => fakePlugin({ checkPermissions: async () => ({ location: state }) }).plugin);
      expect(await g.permission()).toBe(expected);
    }
  });

  it('suivi : haute précision, positions converties ; erreur du système réduite à un code (aucun texte relayé) ; arrêt = clearWatch', async () => {
    const { plugin, calls, emit } = fakePlugin();
    const geo = await createTauriGeolocation(async () => plugin);
    const events: GeoEvent[] = [];
    const stop = await geo.watch((e) => events.push(e));
    expect(calls.options).toEqual([{ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }]);
    emit({ timestamp: 1_800_000_000_000, coords: { latitude: 0.001, longitude: 0, accuracy: 5 } });
    emit(null, 'The operation couldn’t be completed. (kCLErrorDomain error 0.)');
    emit(null, 'User denied location authorization');
    expect(events).toEqual([
      { kind: 'fix', fix: { lat: 0.001, lon: 0, accuracyM: 5, at: 1_800_000_000_000 } },
      { kind: 'error', code: 'unavailable' },
      { kind: 'error', code: 'denied' },
    ]);
    await stop();
    expect(calls.cleared).toEqual([7]);
    const failing = await createTauriGeolocation(async () => fakePlugin({ clearWatch: () => Promise.reject(new Error('déjà arrêté')) }).plugin);
    await expect((await failing.watch(() => undefined))()).resolves.toBeUndefined();
  });

  it('la façade ne journalise rien (aucune position dans la console)', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const { plugin, emit } = fakePlugin();
    const geo = await createTauriGeolocation(async () => plugin);
    await geo.watch(() => undefined);
    emit({ timestamp: 1_800_000_000_000, coords: { latitude: 0.001234, longitude: 0.005678, accuracy: 5 } });
    emit(null, 'erreur');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });
});
