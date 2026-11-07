// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { LiveActivity, LiveActivityAvailability } from '../../platform/liveActivity';
import type { TimerNotifier, TimerNotifierPermission } from '../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { TimerTestRow } from './TimerTestRow';

/**
 * SPA-007 lot D : ligne « Tester le minuteur (60 s) » (Plus › À propos et diagnostic). Textes en français, au tutoiement ; aucune promesse de
 * notification quand elles sont refusées ; le repli de la Live Activity est expliqué ; sur PC, minuteur dans l'app seulement.
 */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000b7');
let db: TestDb;

function fakes(options: { permission?: TimerNotifierPermission; availability?: LiveActivityAvailability } = {}) {
  const scheduled: number[] = [];
  const live = { starts: 0, ends: 0 };
  const notifier: TimerNotifier = {
    permission: async () => options.permission ?? 'granted',
    requestPermission: async () => options.permission ?? 'granted',
    isPending: async () => false,
    schedule: async ({ endMs }) => (scheduled.push(endMs), true),
    cancel: async () => undefined,
  };
  const liveActivity: LiveActivity = {
    isAvailable: async () => options.availability ?? { available: true },
    start: async () => (live.starts++, { started: true }),
    end: async () => (live.ends++, { ended: true, count: 1 }),
  };
  return { notifier, liveActivity, scheduled, live };
}

const open = (props: { os: 'ios' | 'other'; notifier: TimerNotifier; liveActivity: LiveActivity }) => {
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TimerTestRow {...props} />
    </AppContainerProvider>,
  );
};

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-06T10:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  await db.close();
});

describe('Tester le minuteur (60 s)', () => {
  it('au repos : la ligne et le bouton « Lancer »', async () => {
    const f = fakes();
    open({ os: 'ios', ...f });
    expect(await screen.findByText('Tester le minuteur (60 s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arrêter' })).toBeNull();
  });

  it('lancer : décompte 1:00, « Arrêter », notification annoncée et Live Activity annoncée', async () => {
    const f = fakes();
    open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    expect(await screen.findByText('1:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeInTheDocument();
    expect(await screen.findByText(/Une notification sonnera à la fin/)).toBeInTheDocument();
    expect(await screen.findByText(/Live Activity est affichée/)).toBeInTheDocument();
    expect(f.scheduled).toHaveLength(1);
    expect(f.live.starts).toBe(1);
  });

  it('notifications refusées : le dit, ne promet aucune notification', async () => {
    const f = fakes({ permission: 'denied' });
    open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    expect(await screen.findByText(/notifications sont refusées/)).toBeInTheDocument();
    expect(screen.queryByText(/Une notification sonnera/)).toBeNull();
    expect(f.scheduled).toEqual([]);
  });

  it('Live Activity désactivée : phrase de repli qui explique pourquoi', async () => {
    const f = fakes({ availability: { available: false, reason: 'disabled', error: null } });
    open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    expect(await screen.findByText(/Live Activity n’est pas disponible/)).toBeInTheDocument();
    expect(screen.getByText(/désactivées/)).toBeInTheDocument();
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('erreur native d’ActivityKit : domaine, code et description affichés', async () => {
    const native = { domain: 'com.apple.ActivityKit.ActivityInput', code: 4, description: 'Target does not include NSSupportsLiveActivities plist key' };
    const f = fakes();
    f.liveActivity.start = async () => ({ started: false, reason: 'failed', error: native });
    open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    expect(await screen.findByText(/com\.apple\.ActivityKit\.ActivityInput/)).toBeInTheDocument();
    expect(screen.getByText(/Target does not include/)).toBeInTheDocument();
  });

  it('PC : minuteur dans l’app seulement, aucune notification système', async () => {
    const f = fakes({ permission: 'unavailable' });
    open({ os: 'other', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    expect(await screen.findByText('1:00')).toBeInTheDocument();
    expect(screen.getByText(/Sur PC, le minuteur reste dans l’app/)).toBeInTheDocument();
    expect(f.live.starts).toBe(0);
    expect(f.scheduled).toEqual([]);
  });

  it('Arrêter : retour au repos, activité fermée, aucune activité orpheline', async () => {
    const f = fakes();
    open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Arrêter' }));
    expect(await screen.findByRole('button', { name: 'Lancer' })).toBeInTheDocument();
    expect(f.live.ends).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('1:00')).toBeNull();
  });

  it('réouverture en cours de décompte : le temps restant vient de la date persistée (30 s plus tard, il reste 0:30)', async () => {
    const f = fakes();
    const first = open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    await screen.findByText('1:00');
    first.unmount();
    db.clock.advance(30_000);
    open({ os: 'ios', ...f });
    expect(await screen.findByText('0:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeInTheDocument();
  });

  it('le décompte avance avec l’horloge, sans compteur : après 45 s, 0:15 ; à l’échéance, « terminé » et l’activité est fermée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = fakes();
    open({ os: 'ios', ...f });
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    await screen.findByText('1:00');
    db.clock.advance(45_000);
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(await screen.findByText('0:15')).toBeInTheDocument();
    db.clock.advance(20_000);
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(await screen.findByText(/minuteur de test est terminé/)).toBeInTheDocument();
    expect(f.live.ends).toBeGreaterThanOrEqual(1);
  });

  it('réglage illisible ou non enregistrable : dit, jamais une erreur non gérée', async () => {
    const f = fakes();
    const failing = { ...db.data, repos: { ...db.data.repos, settings: { ...db.data.repos.settings, get: () => Promise.reject(new Error('boom')), set: () => Promise.reject(new Error('boom')) } } } as typeof db.data;
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: failing });
    render(
      <AppContainerProvider container={container}>
        <TimerTestRow os="ios" {...f} />
      </AppContainerProvider>,
    );
    expect(await screen.findByText(/minuteur n’a pas pu être lu ou enregistré/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(await screen.findAllByText(/minuteur n’a pas pu être lu ou enregistré/)).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Arrêter' })).toBeNull();
  });
});

describe('0.2.3 : texte de la ligne selon l’appareil', () => {
  it('PC : ne promet ni Live Activity ni Dynamic Island sur cet appareil', async () => {
    const f = fakes();
    open({ os: 'other', notifier: f.notifier, liveActivity: f.liveActivity });
    const hint = await screen.findByText(/minuteur dans l’app/i);
    expect(hint.textContent).toMatch(/sur l’iPhone/i);
  });
  it('iPhone : la ligne décrit la Live Activity', async () => {
    const f = fakes();
    open({ os: 'ios', notifier: f.notifier, liveActivity: f.liveActivity });
    expect(await screen.findByText(/Dynamic Island/)).toBeTruthy();
  });
});
