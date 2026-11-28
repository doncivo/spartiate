import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { createFakeNotificationScheduler, type NotificationScheduler } from '../../../platform/notifications';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { MeasurementRhythmSettings } from './MeasurementRhythmSettings';

/**
 * CORPS-0301d (BL-180, D-713, D-714) : Corps › Mesures, rythme des mesures (7, 14 ou 28 jours) et rappel iPhone. Le PC montre le rythme et les
 * phrases, dit que le rappel est émis sur l'iPhone et n'envoie rien. Valeurs inventées ; aucune requête réseau.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
const NOW = '2026-11-12T09:00:00.000Z'; // 10:00 à Paris
let db: TestDb;

const mount = (samples: readonly { kind: string; day: LocalDate }[], notifications?: NotificationScheduler, zone: string | null = 'Europe/Paris', data: TestDb['data'] = db.data) =>
  render(
    <AppContainerProvider
      container={createAppContainer({
        clock: db.clock,
        hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }),
        data,
        platform: { runtime: 'web', os: notifications ? 'ios' : 'other' },
        ...(notifications ? { notifications, notificationClock: { nowMs: () => Date.parse(NOW), zone: () => zone } } : {}),
      })}
    >
      <MeasurementRhythmSettings samples={samples} />
    </AppContainerProvider>,
  );
const waist = (day: string) => ({ kind: 'waist', day: day as LocalDate });
/** Le service relit la table `measurement` (déclencheurs d'ouverture et de synchro) : la mesure passée à l'écran y est aussi écrite. */
const seed = async (day: string) => (await db.data.repos.measurements()).save(day as LocalDate, 'waist', 80);

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('aucune requête réseau attendue'))));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

/**
 * FIX-0302a (BL-183, docs/CORPS-0301d.md) : lecture des réglages retenue jusqu'à `release()`. Avant la lecture, l'écran ne connaît que les valeurs
 * par défaut : un choix fait à ce moment enregistrait le rythme par défaut et écrasait un 14 ou un 28 déjà stocké.
 */
function slowSettings(data: TestDb['data']): { readonly data: TestDb['data']; readonly release: () => void } {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const settings = new Proxy(data.repos.settings, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (key !== 'get' || typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        await gate;
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  const repos = new Proxy(data.repos, { get: (target, key, receiver) => (key === 'settings' ? settings : Reflect.get(target, key, receiver)) });
  return { data: { ...data, repos }, release: () => release() };
}

describe('FIX-0302a : un choix fait avant la lecture des réglages n’écrase pas le réglage stocké', () => {
  it('iPhone : contrôles inactifs pendant la lecture ; un appui sur l’interrupteur ne réécrit pas le rythme 28 en 7', async () => {
    await db.data.repos.settings.set('bodyProgress.measurementRhythm', 28);
    await seed('2026-11-09');
    const slow = slowSettings(db.data);
    mount([waist('2026-11-09')], createFakeNotificationScheduler(), 'Europe/Paris', slow.data);
    const toggle = screen.getByRole('switch', { name: 'Rappel le matin du jour prévu' });
    expect(toggle).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Chaque semaine' })).toBeDisabled();
    fireEvent.click(toggle);
    slow.release();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Toutes les 4 semaines' })).toHaveAttribute('aria-checked', 'true'));
    expect(await db.data.repos.settings.get('bodyProgress.measurementRhythm')).toBe(28);
    expect(screen.getByRole('switch', { name: 'Rappel le matin du jour prévu' })).not.toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Rappel le matin du jour prévu' })).toHaveAttribute('aria-checked', 'true');
  });

  it('iPhone : service introuvable, les contrôles restent inactifs et l’échec est dit (FIX-0304, BL-188, D-804 ; révise le critère 3 de FIX-0302a)', async () => {
    const repos = new Proxy(db.data.repos, {
      get: (target, key, receiver) => {
        if (key === 'settings') throw new Error('service introuvable (test)');
        return Reflect.get(target, key, receiver);
      },
    });
    mount([waist('2026-11-09')], createFakeNotificationScheduler(), 'Europe/Paris', { ...db.data, repos });
    expect(await screen.findByRole('alert')).toHaveTextContent('Réglages du rythme illisibles');
    expect(screen.getByRole('switch', { name: 'Rappel le matin du jour prévu' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Chaque semaine' })).toBeDisabled();
  });

  it('lecture des réglages en échec : dit à l’écran, contrôles inactifs, rien n’est écrit ; « Réessayer » relit le 28 stocké (FIX-0304, BL-188)', async () => {
    await db.data.repos.settings.set('bodyProgress.measurementRhythm', 28);
    let broken = true;
    const real = db.data.repos.settings;
    const settings = new Proxy(real, {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver);
        if (key !== 'get' || typeof value !== 'function') return value;
        return async (...args: unknown[]) => {
          if (broken) throw new Error('lecture impossible (test)');
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    });
    const repos = new Proxy(db.data.repos, { get: (target, key, receiver) => (key === 'settings' ? settings : Reflect.get(target, key, receiver)) });
    mount([waist('2026-11-09')], createFakeNotificationScheduler(), 'Europe/Paris', { ...db.data, repos });
    expect(await screen.findByRole('alert')).toHaveTextContent('Réglages du rythme illisibles');
    const weekly = screen.getByRole('radio', { name: 'Chaque semaine' });
    expect(weekly).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Rappel le matin du jour prévu' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Toutes les 2 semaines' }));
    expect(await real.get('bodyProgress.measurementRhythm')).toBe(28);
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Toutes les 4 semaines' })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('radio', { name: 'Chaque semaine' })).not.toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('PC : le rythme ne se règle qu’après la lecture ; le 14 stocké reste 14', async () => {
    await db.data.repos.settings.set('bodyProgress.measurementRhythm', 14);
    const slow = slowSettings(db.data);
    mount([waist('2026-11-09')], undefined, 'Europe/Paris', slow.data);
    const weekly = screen.getByRole('radio', { name: 'Chaque semaine' });
    expect(weekly).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Toutes les 4 semaines' }));
    slow.release();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Toutes les 2 semaines' })).toHaveAttribute('aria-checked', 'true'));
    expect(await db.data.repos.settings.get('bodyProgress.measurementRhythm')).toBe(14);
    expect(screen.getByRole('radio', { name: 'Chaque semaine' })).not.toBeDisabled();
  });
});

describe('rythme des mesures', () => {
  it('iPhone : chaque semaine par défaut, phrases, rappel actif posé à 09:00 le jour prévu', async () => {
    const scheduler = createFakeNotificationScheduler();
    await seed('2026-11-09');
    mount([waist('2026-11-09')], scheduler);
    expect(await screen.findByRole('region', { name: 'Rythme des mesures' })).toBeInTheDocument();
    expect(screen.getByText('Dernière séance de mesures il y a 3 jours')).toBeInTheDocument();
    expect(screen.getByText('Prochaine conseillée dans 4 jours')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Chaque semaine' })).toHaveAttribute('aria-checked', 'true');
    const toggle = await screen.findByRole('switch', { name: 'Rappel le matin du jour prévu' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await waitFor(async () => expect((await scheduler.pending()).map((r) => r.id)).toEqual(['measurement:2026-11-16']));
  });

  it('iPhone : le rythme se règle (clé locale) et déplace la prochaine séance et le rappel', async () => {
    const scheduler = createFakeNotificationScheduler();
    await seed('2026-11-09');
    mount([waist('2026-11-09')], scheduler);
    fireEvent.click(await screen.findByRole('radio', { name: 'Toutes les 2 semaines' }));
    expect(await screen.findByText('Prochaine conseillée dans 11 jours')).toBeInTheDocument();
    await waitFor(async () => expect(await db.data.repos.settings.get('bodyProgress.measurementRhythm')).toBe(14));
    await waitFor(async () => expect((await scheduler.pending()).map((r) => r.id)).toEqual(['measurement:2026-11-23']));
  });

  it('iPhone : l’interrupteur coupe le rappel (retiré) et le réglage est gardé', async () => {
    const scheduler = createFakeNotificationScheduler();
    await seed('2026-11-09');
    mount([waist('2026-11-09')], scheduler);
    const toggle = await screen.findByRole('switch', { name: 'Rappel le matin du jour prévu' });
    await waitFor(async () => expect(await scheduler.pending()).toHaveLength(1));
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    await waitFor(async () => expect(await scheduler.pending()).toEqual([]));
    expect(await db.data.repos.settings.get('bodyProgress.measurementReminder')).toBe(false);
  });

  it('iPhone : l’interrupteur est rendu dès l’affichage, sans attendre le passage de planification (relecture CORPS-0301d, point 1)', async () => {
    const scheduler = createFakeNotificationScheduler();
    await seed('2026-11-09');
    mount([waist('2026-11-09')], scheduler);
    expect(screen.getByRole('switch', { name: 'Rappel le matin du jour prévu' })).toBeInTheDocument();
    await waitFor(async () => expect(await scheduler.pending()).toHaveLength(1));
  });

  it('iPhone : fuseau illisible, rappel non posé : l’écran le dit (relecture CORPS-0301d, point 3)', async () => {
    const scheduler = createFakeNotificationScheduler();
    await seed('2026-11-09');
    mount([waist('2026-11-09')], scheduler, null);
    expect(await screen.findByText('Le rappel n’a pas pu être programmé.')).toBeInTheDocument();
    expect(await scheduler.pending()).toEqual([]);
  });

  it('PC : rythme et phrases visibles, pas d’interrupteur, « émis sur l’iPhone »', async () => {
    mount([waist('2026-11-12')]);
    expect(await screen.findByText('Le rappel est émis sur l’iPhone.')).toBeInTheDocument();
    expect(screen.getByText('Dernière séance de mesures aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText('Prochaine conseillée dans 7 jours')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Rythme des mesures' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('sans mesure : « Aucune séance de mesures », sans prochaine ; mesures importées et notes ignorées', async () => {
    mount([{ kind: 'health_waist_cm', day: '2026-11-10' as LocalDate }, { kind: 'note_fatigue', day: '2026-11-10' as LocalDate }]);
    expect(await screen.findByText('Aucune séance de mesures')).toBeInTheDocument();
    expect(screen.queryByText(/Prochaine conseillée/)).toBeNull();
  });

  it('échéance passée : « aujourd’hui », jamais un nombre négatif ; hier : « il y a 1 jour »', async () => {
    const view = mount([waist('2026-10-01')]);
    expect(await screen.findByText('Prochaine conseillée aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText('Dernière séance de mesures il y a 42 jours')).toBeInTheDocument();
    view.unmount();
    mount([waist('2026-11-11')]);
    expect(await screen.findByText('Dernière séance de mesures il y a 1 jour')).toBeInTheDocument();
    expect(screen.getByText('Prochaine conseillée dans 6 jours')).toBeInTheDocument();
  });

  it('rythme relu du réglage à l’ouverture (28 jours)', async () => {
    await db.data.repos.settings.set('bodyProgress.measurementRhythm', 28);
    mount([waist('2026-11-09')]);
    expect(await screen.findByText('Prochaine conseillée dans 25 jours')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Toutes les 4 semaines' })).toHaveAttribute('aria-checked', 'true');
  });
});
