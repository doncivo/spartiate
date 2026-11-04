import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { SectionNotice } from './SectionNotice';

const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;

describe('sections I0 : états explicites, sans faux zéro ni bouton mort (SPA-009 critères 1 et 4)', () => {
  let db: TestDb;
  const open = (tab: 'today' | 'training' | 'nutrition' | 'progress') => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <SectionNotice tab={tab} />
      </AppContainerProvider>,
    );
  };
  beforeEach(async () => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-04T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it.each([
    ['training', 'Entraînement'],
    ['nutrition', 'Nutrition'],
    ['progress', 'Progrès'],
  ] as const)('%s : titre, explication de l’indisponibilité, aucun bouton, aucun chiffre', async (tab, title) => {
    open(tab);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(/arrive avec une prochaine version/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(document.body.textContent ?? '').not.toMatch(/\d/);
  });

  it('Aujourd’hui : état vide explicite et une seule action utile, qui ouvre Profil et poids', async () => {
    open('today');
    expect(await screen.findByRole('heading', { name: 'Aujourd’hui' })).toBeInTheDocument();
    expect(screen.getByText(/Aucune donnée pour l’instant/)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/\d/);
    fireEvent.click(screen.getByRole('button', { name: 'Renseigner mon profil et mon poids' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
  });
});
