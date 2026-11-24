import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { loadTrainingContent } from './content';
import { TrainingScreen } from './TrainingScreen';

/**
 * SEANCE-0292 (partie B) : écran Matériel, saisie des listes de poids (C-066) et inventaire (C-081). Base SQLite réelle (wasm), contenu embarqué.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000c2' as DeviceId;

describe('Matériel : listes de poids', () => {
  let db: TestDb;
  const open = () => {
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'equipment' } as Route));
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <TrainingScreen />
      </AppContainerProvider>,
    );
  };
  const inventory = async (): Promise<{ platesPerSideKg: { weightKg: number; count: number }[]; kettlebellsKg: number[] }> => {
    const rows = await db.driver.select<{ inventory: string }>('SELECT inventory FROM equipment_profile');
    return JSON.parse(rows[0]?.inventory ?? '{}') as { platesPerSideKg: { weightKg: number; count: number }[]; kettlebellsKg: number[] };
  };
  const editCopy = async (): Promise<void> => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Dupliquer pour modifier' }));
    await screen.findByRole('heading', { name: 'Salle complète (copie)' });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
  };

  // Contenu embarqué chargé une fois avant le premier rendu (import à la demande, coûteux à froid sous Vitest).
  beforeAll(async () => {
    await loadTrainingContent();
  });
  beforeEach(async () => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-06T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  describe('C-066 : « 12,16 » n’est pas un poids de 12,16 kg', () => {
    it('kettlebells « 12,16 » : refusé avec un message qui dit de séparer par des points-virgules, rien d’écrit', async () => {
      await editCopy();
      const before = await inventory();
      fireEvent.change(screen.getByLabelText(/^Kettlebells/), { target: { value: '12,16' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/points-virgules/);
      expect(await inventory()).toEqual(before);
    });

    it('disques « 20,1 » : refusé ; « 1,25 » (décimale réelle) accepté', async () => {
      await editCopy();
      const plates = screen.getByLabelText(/^Disques par côté/);
      fireEvent.change(plates, { target: { value: '20,1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/points-virgules/);
      fireEvent.change(plates, { target: { value: '20 ; 1,25' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      await screen.findByRole('heading', { name: 'Salle complète (copie)' });
      expect((await inventory()).platesPerSideKg.map((p) => p.weightKg)).toEqual([20, 1.25]);
    });
  });

  describe('C-081 : nombre de disques modifiable, poids en double refusé', () => {
    it('« 20 × 4 ; 10 » : quatre disques de 20 kg par côté, un de 10 ; relu tel quel à la modification suivante', async () => {
      await editCopy();
      fireEvent.change(screen.getByLabelText(/^Disques par côté/), { target: { value: '20 × 4 ; 10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      await screen.findByRole('heading', { name: 'Salle complète (copie)' });
      expect((await inventory()).platesPerSideKg).toEqual([
        { weightKg: 20, count: 4 },
        { weightKg: 10, count: 1 },
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
      expect(screen.getByLabelText(/^Disques par côté/)).toHaveValue('20 × 4 ; 10');
    });

    it('« 20 ; 20 » ou kettlebells « 16 ; 16 » : refusé (poids en double), rien d’écrit', async () => {
      await editCopy();
      const before = await inventory();
      fireEvent.change(screen.getByLabelText(/^Disques par côté/), { target: { value: '20 ; 20' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/en double/);
      fireEvent.change(screen.getByLabelText(/^Disques par côté/), { target: { value: '20' } });
      fireEvent.change(screen.getByLabelText(/^Kettlebells/), { target: { value: '16 ; 16' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/en double/);
      expect(await inventory()).toEqual(before);
    });
  });
});
