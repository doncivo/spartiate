import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { setGeolocation, type GeoEvent, type GeoPermission, type Geolocation } from '../../platform/geolocation';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { CardioView } from './CardioView';

/**
 * I6-06 (D-222, H-35) : suivi GPS sur l'iPhone, premier plan seulement, par la façade (faux GPS injecté, positions SYNTHÉTIQUES le long d'un méridien
 * depuis 0° / 0°). Permission demandée au premier usage ; refus ou panne dits à l'écran, saisie manuelle intacte ; « Arrêter et reporter » remplit le
 * formulaire ; le tracé est gardé sur l'appareil ; aucune position dans la console.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000cc' as DeviceId;
const NOW = '2026-11-13T17:00:00.000Z';
let db: TestDb;

interface FakeGps {
  readonly geo: Geolocation;
  readonly calls: { requested: number; watching: number; stopped: number };
  emit(event: GeoEvent): void;
}
function fakeGps(permission: GeoPermission, onRequest: GeoPermission = 'granted'): FakeGps {
  let state = permission;
  let listener: ((e: GeoEvent) => void) | null = null;
  const calls = { requested: 0, watching: 0, stopped: 0 };
  return {
    calls,
    emit: (e) => act(() => listener?.(e)),
    geo: {
      available: true,
      permission: async () => state,
      request: async () => {
        calls.requested += 1;
        state = onRequest;
        return state;
      },
      watch: async (cb) => {
        calls.watching += 1;
        listener = cb;
        return async () => {
          calls.stopped += 1;
          listener = null;
        };
      },
    },
  };
}
const fix = (i: number): GeoEvent => ({ kind: 'fix', fix: { lat: i * 0.001, lon: 0, accuracyM: 5, at: Date.parse(NOW) + i * 30_000 } });

const mount = (os: 'ios' | 'other') =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } })}>
      <CardioView timeZone="Europe/Paris" />
    </AppContainerProvider>,
  );
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
let spies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('aucune requête réseau attendue'))));
  spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
});
afterEach(async () => {
  cleanup();
  setGeolocation(null);
  vi.unstubAllGlobals();
  for (const spy of spies) {
    // Aucune position (ni latitude ni longitude synthétiques) n'est jamais écrite dans la console.
    for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/0\.00[12]|latitude|longitude/);
    spy.mockRestore();
  }
  await db.close();
});

describe('suivi GPS (iPhone, premier plan)', () => {
  it('permission demandée au premier usage ; durée et distance suivies ; reportées dans le formulaire ; enregistrée « GPS » avec le tracé local', async () => {
    const gps = fakeGps('prompt');
    setGeolocation(gps.geo);
    mount('ios');
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' }));
    expect(await screen.findByText('En attente du signal GPS…')).toBeInTheDocument();
    expect(gps.calls).toEqual({ requested: 1, watching: 1, stopped: 0 });
    gps.emit(fix(0));
    db.clock.advance(30_000);
    gps.emit(fix(1));
    db.clock.advance(30_000);
    gps.emit(fix(2));
    expect(await screen.findByText('Suivi en cours : 1 min · 0,22 km')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter et reporter' }));
    expect(await screen.findByText('Durée et distance reportées : vérifie le ressenti, puis enregistre.')).toBeInTheDocument();
    expect(gps.calls.stopped).toBe(1);
    expect(field('Durée (min ou h:mm:ss)').value).toBe('1:00');
    expect(field('Distance (km, facultative)').value).toBe('0,222');
    expect(field('Heure de début').value).toBe('18:00');
    fireEvent.change(field('Ressenti (1 à 10)'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Séance enregistrée.')).toBeInTheDocument();
    const repo = await db.data.repos.cardio();
    const [saved] = await repo.list();
    expect(saved).toMatchObject({ source: 'gps', durationSec: 60, distanceM: 222, startedAt: NOW, hasTrack: true });
    expect(await repo.track(saved?.id ?? '')).toHaveLength(3);
    expect(await screen.findByText('allure 4:30 /km · Suivi GPS · Tracé gardé sur cet appareil')).toBeInTheDocument();
  });

  it('région masquée (role status) : son texte ne change qu’à la minute, jamais à chaque seconde', async () => {
    const gps = fakeGps('granted');
    setGeolocation(gps.geo);
    mount('ios');
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' }));
    await screen.findByText('En attente du signal GPS…');
    gps.emit(fix(0));
    const status = (): string => screen.getAllByRole('status').map((s) => s.textContent ?? '').find((t) => t.startsWith('Suivi en cours')) ?? '';
    const chrono = (): string => (document.querySelector('.ct-cardio__gps-stat-value')?.textContent ?? '');
    gps.emit({ kind: 'error', code: 'unavailable' });
    let last = status();
    const changes: string[] = [];
    for (let s = 1; s <= 130; s += 1) {
      db.clock.advance(1_000);
      gps.emit({ kind: 'error', code: 'unavailable' });
      const now = status();
      if (now !== last) changes.push(chrono());
      last = now;
    }
    // Le texte ne change qu’au passage d’une minute entière du chrono (m:00), jamais à mi-minute ni chaque seconde.
    expect(changes.length).toBeGreaterThan(0);
    for (const at of changes) expect(at).toMatch(/:00$/);
  });

  it('permission refusée : dit à l’écran, aucun suivi ; la saisie manuelle reste possible', async () => {
    const gps = fakeGps('denied');
    setGeolocation(gps.geo);
    mount('ios');
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Localisation refusée : saisis la séance à la main');
    expect(gps.calls.watching).toBe(0);
    expect(field('Durée (min ou h:mm:ss)')).toBeInTheDocument();
  });

  it('signal perdu : dit, le suivi continue ; permission retirée en cours : suivi arrêté, dit', async () => {
    const gps = fakeGps('granted');
    setGeolocation(gps.geo);
    mount('ios');
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' }));
    await screen.findByText('En attente du signal GPS…');
    expect(gps.calls.requested).toBe(0);
    gps.emit(fix(0));
    gps.emit({ kind: 'error', code: 'unavailable' });
    expect(await screen.findByText('Signal GPS perdu : le suivi continue, la distance reprendra avec le signal.')).toBeInTheDocument();
    gps.emit({ kind: 'error', code: 'denied' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Localisation refusée');
    expect(gps.calls.stopped).toBe(1);
  });

  it('abandonner : suivi arrêté, formulaire intact', async () => {
    const gps = fakeGps('granted');
    setGeolocation(gps.geo);
    mount('ios');
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' }));
    await screen.findByText('En attente du signal GPS…');
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner le suivi' }));
    expect(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' })).toBeInTheDocument();
    expect(gps.calls.stopped).toBe(1);
    expect(field('Durée (min ou h:mm:ss)').value).toBe('');
  });

  it('PC : aucun bloc GPS (stub sans GPS), saisie manuelle seule', async () => {
    mount('other');
    expect(await screen.findByText('Aucune séance de cardio pour l’instant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Démarrer le suivi GPS' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Suivi GPS' })).toBeNull();
  });
});
