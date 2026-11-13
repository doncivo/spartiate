import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { ResetDataScreen } from './ResetDataScreen';

/** RESET-01 (D-180 à D-186) : Plus › Données › « Repartir de zéro ». Données synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000e7' as DeviceId;
const W = '7e2d1c3a-0000-4000-8000-0000000000e7';

describe('Plus › Repartir de zéro', () => {
  let db: TestDb;
  const open = (onDone: () => void) => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <ResetDataScreen onDone={onDone} />
      </AppContainerProvider>,
    );
  };
  const weights = async (): Promise<number> => (await db.driver.select('SELECT 1 FROM body_weight')).length;

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-12T08:00:00.000Z');
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-12' as LocalDate);
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('dit ce qui est effacé, ce qui est gardé, que c’est irréversible et vaut pour les deux appareils', () => {
    open(vi.fn());
    expect(screen.getByRole('heading', { level: 1, name: 'Repartir de zéro' })).toBeTruthy();
    expect(screen.getByText('Ce qui est effacé')).toBeTruthy();
    expect(screen.getByText('Ce qui est gardé')).toBeTruthy();
    expect(screen.getByText(/L’appairage et la clé de synchro/)).toBeTruthy();
    expect(screen.getByText(/S’applique à tes deux appareils/)).toBeTruthy();
    expect(screen.getByText(/C’est irréversible/)).toBeTruthy();
  });

  it('confirmation obligatoire : bouton inactif sans le mot exact ; « effacer » en minuscules ne suffit pas ; rien n’est effacé', async () => {
    const onDone = vi.fn();
    open(onDone);
    const button = screen.getByRole('button', { name: 'Tout effacer' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    fireEvent.change(screen.getByLabelText('Pour confirmer, tape EFFACER'), { target: { value: 'effacer' } });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onDone).not.toHaveBeenCalled();
    expect(await weights()).toBe(1);
  });

  it('EFFACER tapé : tout est effacé, puis l’app redémarre (onboarding ouvert au démarrage)', async () => {
    const onDone = vi.fn();
    open(onDone);
    fireEvent.change(screen.getByLabelText('Pour confirmer, tape EFFACER'), { target: { value: 'EFFACER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(await weights()).toBe(0);
    expect(await db.data.repos.settings.get('onboarding.completed')).toBe(false);
  });

  it('séance en cours : refus visible, rien n’est effacé, pas de redémarrage', async () => {
    await (await db.data.repos.workouts()).start({ source: 'empty', id: W, name: 'En cours' });
    const onDone = vi.fn();
    open(onDone);
    fireEvent.change(screen.getByLabelText('Pour confirmer, tape EFFACER'), { target: { value: 'EFFACER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Une séance est en cours');
    expect(onDone).not.toHaveBeenCalled();
    expect(await weights()).toBe(1);
  });
});
