import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { Contributor, RecoveryDayOutput, RecoveryDaySummary } from '../../domain/recovery';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { RecoveryToday } from './RecoveryToday';

/** I5-02 point 2.1 : cadrans Recovery, Exertion, Sommeil et tuile Pas d'Aujourd'hui ; jamais de faux zéro, jamais de diagnostic. */
const DEVICE = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const NOW = '2026-11-10T09:00:00.000Z';
let db: TestDb;

const contributors: Contributor[] = [
  { key: 'hrv', value: 1.1, weight: 0.7 },
  { key: 'resting_hr', value: -0.9, weight: 0.3 },
  { key: 'sleep', value: 0.9, weight: null },
];
const summary = (patch: Partial<RecoveryDaySummary> = {}): RecoveryDaySummary => ({
  day: '2026-11-10',
  level: 'A',
  recovery: 72,
  abstainReason: null,
  quality: 'good',
  exertion: 3.46,
  exertionPrevDay: 0,
  sleepMinutes: 432,
  sleepNeedMinutes: 450,
  sleepScore: 96,
  bedtimeSigmaMinutes: 20,
  targetZone: { from: 6, to: 8 },
  hrvMs: 60,
  restingHr: 50,
  learningNights: 14,
  contributors,
  explanationKeys: ['exertion_cardio_not_counted'],
  computedAt: '2026-11-10T07:00:00.000Z',
  ...patch,
});
const save = async (s: RecoveryDaySummary): Promise<void> => {
  const output: RecoveryDayOutput = { summary: s, muscles: [] };
  await (await db.data.repos.recovery()).saveDay(output);
};
const mount = (os: 'ios' | 'other' = 'ios') =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } })}>
      <RecoveryToday />
    </AppContainerProvider>,
  );

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

describe('états', () => {
  it('chargement : message de chargement annoncé', () => {
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement de la récupération');
  });

  it('jamais importé (iPhone) : invite vers Plus, Apple Santé, Raccourcis, sans erreur ni chiffre', async () => {
    mount();
    expect(await screen.findByText('Aucune donnée de récupération importée pour l’instant.')).toBeInTheDocument();
    expect(screen.getByText(/Plus → Apple Santé → Raccourcis/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/\d/);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Apple Santé' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'health' });
  });

  it('jamais reçu (PC) : le dit sans bouton ni erreur', async () => {
    mount('other');
    expect(await screen.findByText('Aucun résumé de récupération reçu de l’iPhone.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('échec de lecture : message et Réessayer, puis les cadrans', async () => {
    await save(summary());
    const spy = vi.spyOn(db.data.repos, 'recovery').mockRejectedValueOnce(new Error('boom'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Lecture impossible des données de récupération.');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('img', { name: /Recovery : 72 sur 100/ })).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it('données périmées : le dernier résumé reçu est ancien, le texte le dit', async () => {
    await save(summary({ day: '2026-11-05', computedAt: '2026-11-05T07:00:00.000Z' }));
    mount('other');
    expect(await screen.findByText(/Dernier résumé reçu il y a 5 jours/)).toBeInTheDocument();
    expect(screen.getByText(/Résumé du/)).toBeInTheDocument();
  });

  it('import ancien sur iPhone : le dit', async () => {
    await save(summary({ day: '2026-11-06', computedAt: '2026-11-06T07:00:00.000Z' }));
    await (await db.data.repos.recoverySamples()).recordImport({ type: 'hrv', importedAt: '2026-11-06T07:00:00.000Z', newestSampleAt: null, added: 1, duplicates: 0, rejected: 0 });
    mount();
    expect(await screen.findByText(/Dernier import il y a 4 jours/)).toBeInTheDocument();
  });
});

describe('cadrans', () => {
  it('valeurs, qualité, contributeurs, explication et mention « pas un avis médical »', async () => {
    await save(summary());
    mount('other');
    expect(await screen.findByRole('img', { name: /Recovery : 72 sur 100/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Exertion : 3,5 sur 10/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Sommeil : 7 h 12/ })).toBeInTheDocument();
    expect(screen.getByText('Qualité : bonne')).toBeInTheDocument();
    expect(screen.getByText('HRV au-dessus de ta base')).toBeInTheDocument();
    expect(screen.getByText('FC de repos au-dessus de ta base')).toBeInTheDocument();
    expect(screen.getByText('Sommeil court : score ajusté')).toBeInTheDocument();
    expect(screen.getByText('L’Exertion compte la musculation seule ; le cardio n’est pas compté.')).toBeInTheDocument();
    expect(screen.getByText('Estimation, pas un avis médical.')).toBeInTheDocument();
    expect(screen.getByText('Besoin : 7 h 30')).toBeInTheDocument();
  });

  it('baseline non prête : « En apprentissage J+5/14 », aucun score, aucun 0', async () => {
    await save(summary({ recovery: null, abstainReason: 'baseline_incomplete', quality: 'insufficient', learningNights: 5 }));
    mount('other');
    expect(await screen.findByRole('img', { name: /Recovery : en apprentissage J\+5\/14/ })).toBeInTheDocument();
    expect(screen.getByText('J+5/14')).toBeInTheDocument();
    expect(screen.getByText('Qualité : insuffisante')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Recovery' })).queryByText('0')).toBeNull();
  });

  it('Recovery nulle pour une mesure absente : la raison, jamais 0', async () => {
    await save(summary({ recovery: null, abstainReason: 'measure_missing_hrv', quality: 'insufficient' }));
    mount('other');
    expect(await screen.findByText('Pas de HRV mesurée cette nuit : aucun score calculé.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Recovery : aucun score/ })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Recovery' })).queryByText('0')).toBeNull();
  });

  it('Exertion à zéro : « aucune séance comptée », pas de zéro ; sommeil inconnu : non mesuré', async () => {
    await save(summary({ exertion: 0, sleepMinutes: null, sleepScore: null }));
    mount('other');
    expect(await screen.findByText('Aucune séance de musculation comptée')).toBeInTheDocument();
    expect(screen.getByText('Sommeil non mesuré')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Exertion' })).queryByText('0')).toBeNull();
  });

  it('aucun mot de diagnostic', async () => {
    await save(summary({ explanationKeys: ['sleep_short', 'sleep_debt', 'baseline_outliers_excluded', 'level_b_absolute_thresholds', 'exertion_cardio_not_counted'] }));
    mount('other');
    await screen.findByRole('img', { name: /Recovery/ });
    expect(document.body.textContent ?? '').not.toMatch(/diagnostic|maladie|malade|pathologi|surentra|danger|alerte/i);
  });
});

describe('tuile Pas', () => {
  it('iPhone : pas du jour et moyenne 7 jours, sans classement', async () => {
    await save(summary());
    const samples = await db.data.repos.recoverySamples();
    const input = (day: string, value: number) => ({ type: 'pas' as const, startAt: `${day}T12:00:00.000Z`, endAt: `${day}T12:00:00.000Z`, value, stage: null, source: 'pas.csv' });
    await samples.upsertTotals([input('2026-11-08', 6000), input('2026-11-10', 8000)], '2026-11-10T08:00:00.000Z');
    await samples.recordImport({ type: 'pas', importedAt: '2026-11-10T08:00:00.000Z', newestSampleAt: '2026-11-10T12:00:00.000Z', added: 2, duplicates: 0, rejected: 0 });
    mount();
    const tile = await screen.findByRole('region', { name: 'Pas' });
    expect(within(tile).getByText(/8\s000/)).toBeInTheDocument();
    expect(within(tile).getByText(/7\s000/)).toBeInTheDocument();
    expect(within(tile).getByText('Moyenne sur 2 jours connus (sur 7)')).toBeInTheDocument();
  });

  it('PC : « sur l’iPhone », aucune valeur inventée', async () => {
    await save(summary());
    mount('other');
    const tile = await screen.findByRole('region', { name: 'Pas' });
    expect(within(tile).getByText('Les pas restent sur l’iPhone : ils ne sont pas publiés vers le PC.')).toBeInTheDocument();
    expect(tile.textContent ?? '').not.toMatch(/\d/);
  });

  it('iPhone sans pas importés : le dit', async () => {
    await save(summary());
    await (await db.data.repos.recoverySamples()).recordImport({ type: 'hrv', importedAt: '2026-11-10T08:00:00.000Z', newestSampleAt: null, added: 1, duplicates: 0, rejected: 0 });
    mount();
    expect(await screen.findByText('Aucun pas importé ces 7 derniers jours.')).toBeInTheDocument();
  });
});
