import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { createFakeSyncService } from '../sync/testKit';
import { BodyScreen } from './BodyScreen';

const DEVICE = '60000000-0000-4000-8000-0000000000b3' as DeviceId;

describe('Profil et poids (Plus)', () => {
  let db: TestDb;
  const open = (extra: Partial<AppContainer> = {}) => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, ...extra });
    return render(
      <AppContainerProvider container={container}>
        <BodyScreen />
      </AppContainerProvider>,
    );
  };

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-10-05T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('à l’ouverture : champs vides (aucun zéro affiché) et aucune ligne profile créée', async () => {
    open();
    const height = await screen.findByLabelText('Taille (cm)');
    expect(height).toHaveValue('');
    expect(screen.getByLabelText('Année de naissance')).toHaveValue('');
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue('');
    expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
  });

  it('enregistrer le profil crée la ligne avec NULL pour ce qui est vide', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Année de naissance'), { target: { value: '1990' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
    await waitFor(async () => expect(await db.driver.select('SELECT birth_year, height_cm, sex FROM profile')).toEqual([{ birth_year: 1990, height_cm: null, sex: null }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Profil enregistré');
  });

  it('une taille hors bornes est refusée en français et rien n’est écrit', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Taille (cm)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La taille doit être comprise entre 100 et 250 cm');
    expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
  });

  it('le sexe, l’objectif et l’expérience se choisissent en groupes radio', async () => {
    open();
    const sex = await screen.findByRole('radiogroup', { name: 'Sexe' });
    expect(within(sex).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Homme', 'Femme']);
    fireEvent.click(within(sex).getByRole('radio', { name: 'Femme' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
    await waitFor(async () => expect(await db.driver.select('SELECT sex FROM profile')).toEqual([{ sex: 'female' }]));
  });

  it('une pesée avec virgule est enregistrée à la date du jour et listée', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Poids (kg)'), { target: { value: '82,4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la pesée' }));
    await waitFor(async () => expect(await db.driver.select('SELECT id, kg FROM body_weight')).toEqual([{ id: 'weight|2026-10-05|manual', kg: 82.4 }]));
    expect(await screen.findByText('82,4 kg')).toBeInTheDocument();
  });

  it('un poids de zéro ou illisible est refusé', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Poids (kg)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la pesée' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le poids doit être supérieur à 0');
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
  });

  it('appareil fraîchement appairé, sans profil : le formulaire attend la première synchro', async () => {
    const sync = createFakeSyncService({ phase: 'idle', lastSyncAt: null });
    open({ sync });
    expect(await screen.findByText('En attente de la première synchronisation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le profil' })).toBeDisabled();
    sync.setStatus({ lastSyncAt: '2026-10-05T08:01:00.000Z' as never });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer le profil' })).toBeEnabled());
  });

  it('synchro non configurée : le formulaire est utilisable tout de suite', async () => {
    const sync = createFakeSyncService({ phase: 'not-configured', lastSyncAt: null });
    open({ sync });
    expect(await screen.findByRole('button', { name: 'Enregistrer le profil' })).toBeEnabled();
  });
});
