import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { Contributor, RecoveryDayOutput, RecoveryDaySummary } from '../../domain/recovery';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { RecoveryProgress } from './RecoveryProgress';
import { RecoveryToday } from './RecoveryToday';

/**
 * I6-01 points A, B, D (§ 16.7) : carte « valeurs inhabituelles, repos conseillé », journal de facteurs de la veille (cases à cocher, « rien de
 * particulier ») sur Aujourd'hui, iPhone et PC ; section Progrès › Récupération (écart de Recovery avec / sans). Fixtures synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e6' as DeviceId;
const NOW = '2026-11-10T09:00:00.000Z';
let db: TestDb;

const contributors = (hrv: number, rhr: number): Contributor[] => [
  { key: 'hrv', value: hrv, weight: 0.7 },
  { key: 'resting_hr', value: rhr, weight: 0.3 },
  { key: 'sleep', value: 0.5, weight: null },
];
const summary = (day: string, patch: Partial<RecoveryDaySummary> = {}): RecoveryDaySummary => ({
  day,
  level: 'C',
  recovery: 60,
  abstainReason: null,
  quality: 'good',
  exertion: 3,
  exertionPrevDay: 0,
  sleepMinutes: 432,
  sleepNeedMinutes: 450,
  sleepScore: 96,
  bedtimeSigmaMinutes: 20,
  targetZone: { from: 6, to: 8 },
  hrvMs: 60,
  restingHr: 50,
  learningNights: 14,
  contributors: contributors(0.4, 0.2),
  explanationKeys: [],
  computedAt: `${day}T07:00:00.000Z`,
  ...patch,
});
const save = async (s: RecoveryDaySummary): Promise<void> => {
  const output: RecoveryDayOutput = { summary: s, muscles: [] };
  await (await db.data.repos.recovery()).saveDay(output);
};
const container = (os: 'ios' | 'other') => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } });
const mount = (os: 'ios' | 'other' = 'ios') =>
  render(
    <AppContainerProvider container={container(os)}>
      <RecoveryToday />
    </AppContainerProvider>,
  );
const mountProgress = () =>
  render(
    <AppContainerProvider container={container('other')}>
      <RecoveryProgress />
    </AppContainerProvider>,
  );
const factors = async () => db.data.repos.recoveryFactors();
const CARD = 'Valeurs inhabituelles : repos conseillé';

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

describe('carte « valeurs inhabituelles, repos conseillé » (A)', () => {
  const twoBadNights = async (hrv = -2, rhr = 0.1): Promise<void> => {
    await save(summary('2026-11-09', { contributors: contributors(hrv, rhr) }));
    await save(summary('2026-11-10', { contributors: contributors(hrv, rhr) }));
  };

  it('deux nuits de suite à au moins 2 σ : la carte s’affiche sur iPhone et sur PC, en texte, sans diagnostic', async () => {
    await twoBadNights();
    for (const os of ['ios', 'other'] as const) {
      const view = mount(os);
      const card = await screen.findByRole('region', { name: CARD });
      expect(within(card).getByText(/HRV basse/i)).toBeInTheDocument();
      expect(card.textContent ?? '').toMatch(/pas un avis médical/i);
      expect(card.textContent ?? '').not.toMatch(/maladie|malade|infection|diagnostic :/i);
      view.unmount();
    }
  });

  it('fréquence cardiaque au repos élevée : raison dite en texte', async () => {
    await twoBadNights(0.2, -2);
    mount();
    const card = await screen.findByRole('region', { name: CARD });
    expect(within(card).getByText(/fréquence cardiaque au repos élevée/i)).toBeInTheDocument();
  });

  it('une seule nuit inhabituelle, jours non consécutifs, ou retour à la normale : aucune carte (elle disparaît d’elle-même)', async () => {
    await save(summary('2026-11-09'));
    await save(summary('2026-11-10', { contributors: contributors(-2, 0) }));
    mount();
    await screen.findByRole('img', { name: /Recovery : 60 sur 100/ });
    expect(screen.queryByRole('region', { name: CARD })).toBeNull();
    cleanup();
    await db.close();
    db = await openBaseDb(DEVICE, NOW);
    await save(summary('2026-11-08', { contributors: contributors(-2, 0) }));
    await save(summary('2026-11-10', { contributors: contributors(-2, 0) }));
    mount();
    await screen.findByRole('img', { name: /Recovery : 60 sur 100/ });
    expect(screen.queryByRole('region', { name: CARD })).toBeNull();
  });

  it('baseline incomplète (niveau B) : aucune carte', async () => {
    await save(summary('2026-11-09', { level: 'B', recovery: null, abstainReason: 'baseline_incomplete', contributors: contributors(-2, -2) }));
    await save(summary('2026-11-10', { level: 'B', recovery: null, abstainReason: 'baseline_incomplete', contributors: contributors(-2, -2) }));
    mount();
    await screen.findByText(/En apprentissage/);
    expect(screen.queryByRole('region', { name: CARD })).toBeNull();
  });
});

describe('journal de facteurs de la veille (B)', () => {
  it('jamais renseigné : huit cases décochées plus « Rien de particulier », libellés textuels, aucune écriture', async () => {
    mount('other');
    const group = await screen.findByRole('group', { name: /Hier/ });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(9);
    for (const name of ['Alcool', 'Caféine après 16 h', 'Repas tardif', 'Stress', 'Courbatures', 'Maladie', 'Voyage', 'Entraînement tardif', 'Rien de particulier']) {
      expect(within(group).getByRole('checkbox', { name })).not.toBeChecked();
    }
    expect(within(group).getByText('Non renseigné')).toBeInTheDocument();
    expect(await (await factors()).list('2026-11-01' as LocalDate, '2026-11-30' as LocalDate)).toEqual([]);
  });

  it('cocher des cases enregistre la journée de la veille (2026-11-09), modifiable ensuite ; tout décocher efface (non renseigné)', async () => {
    mount();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Alcool' }));
    await waitFor(async () => expect((await (await factors()).get('2026-11-09' as LocalDate))?.factors).toEqual(['alcohol']));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Stress' }));
    await waitFor(async () => expect((await (await factors()).get('2026-11-09' as LocalDate))?.factors).toEqual(['alcohol', 'stress']));
    expect(await (await factors()).get('2026-11-10' as LocalDate)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alcool' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Stress' }));
    await waitFor(async () => expect(await (await factors()).get('2026-11-09' as LocalDate)).toBeNull());
    expect(screen.getByText('Non renseigné')).toBeInTheDocument();
  });

  it('« Rien de particulier » en un tap : jour renseigné sans facteur, distinct de « non renseigné » ; cocher un facteur le retire', async () => {
    mount();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Rien de particulier' }));
    await waitFor(async () => expect(await (await factors()).get('2026-11-09' as LocalDate)).toMatchObject({ none: true, factors: [] }));
    expect(screen.getByRole('checkbox', { name: 'Rien de particulier' })).toBeChecked();
    expect(screen.queryByText('Non renseigné')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Voyage' }));
    await waitFor(async () => expect(await (await factors()).get('2026-11-09' as LocalDate)).toMatchObject({ none: false, factors: ['travel'] }));
    expect(screen.getByRole('checkbox', { name: 'Rien de particulier' })).not.toBeChecked();
  });

  it('une saisie existante (autre appareil) est affichée cochée ; chaque case mesure au moins 44 pt', async () => {
    await (await factors()).save('2026-11-09' as LocalDate, { factors: ['late_meal'], none: false });
    mount();
    expect(await screen.findByRole('checkbox', { name: 'Repas tardif' })).toBeChecked();
    for (const box of screen.getAllByRole('checkbox')) expect(box.closest('label')?.className ?? '').toContain('ct-factors__option');
  });

  it('un échec d’écriture est annoncé, la case revient à son état enregistré', async () => {
    mount();
    const box = await screen.findByRole('checkbox', { name: 'Alcool' });
    vi.spyOn(db.data.repos, 'recoveryFactors').mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(box);
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible');
    expect(screen.getByRole('checkbox', { name: 'Alcool' })).not.toBeChecked();
  });

  it('I6-01 relecture : un échec suivi d’une saisie enchaînée, puis une saisie réussie : l’alerte disparaît (compteur jamais négatif)', async () => {
    mount();
    const alcohol = await screen.findByRole('checkbox', { name: 'Alcool' });
    const stress = screen.getByRole('checkbox', { name: 'Stress' });
    vi.spyOn(db.data.repos, 'recoveryFactors').mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(alcohol);
    fireEvent.click(stress);
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible');
    // Une saisie suivante, réussie : la file est vide, l'écran relit et l'alerte disparaît.
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Courbatures' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('checkbox', { name: 'Courbatures' })).toBeChecked();
  });
});

describe('Progrès › Récupération : écart de Recovery avec / sans facteur (B)', () => {
  /** `n` jours consécutifs depuis 2026-09-01 : journal à J, Recovery à J+1 (D-95). */
  const seed = async (n: number, alcoholEvery: number, delta: number): Promise<void> => {
    const repo = await factors();
    const start = Date.UTC(2026, 8, 1);
    for (let i = 0; i < n; i += 1) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10) as LocalDate;
      const next = new Date(start + (i + 1) * 86_400_000).toISOString().slice(0, 10);
      const drank = i % alcoholEvery === 0;
      await repo.save(day, drank ? { factors: ['alcohol'], none: false } : { factors: [], none: true });
      await save(summary(next, { recovery: drank ? 70 + delta : 70 }));
    }
  };

  it('moins de 30 jours renseignés : dit combien il en manque, aucun écart affiché', async () => {
    await seed(12, 3, -10);
    mountProgress();
    expect(await screen.findByText(/12 jours sur 30/)).toBeInTheDocument();
    expect(screen.queryByText(/association observée/i)).toBeNull();
  });

  it('30 jours et 5 occurrences : écart moyen avec / sans, avec n, et la mention « association observée, pas une cause »', async () => {
    await seed(35, 4, -12);
    mountProgress();
    const item = await screen.findByRole('listitem', { name: /Alcool/ });
    expect(item).toHaveTextContent(/9 jours avec/);
    expect(item).toHaveTextContent(/26 jours sans/);
    expect(item).toHaveTextContent(/58/);
    expect(item).toHaveTextContent(/70/);
    expect(item).toHaveTextContent(/12 points plus bas/);
    expect(screen.getByText(/association observée, pas une cause/i)).toBeInTheDocument();
  });

  it('aucun jour renseigné : état vide en texte, sans faux zéro', async () => {
    mountProgress();
    expect(await screen.findByText(/Aucun jour renseigné/)).toBeInTheDocument();
  });
});
