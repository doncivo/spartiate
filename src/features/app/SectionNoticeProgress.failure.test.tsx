import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { SectionNotice } from './SectionNotice';

/**
 * PROG-0301a, P-37 (D-719 point 3) : un onglet dont le bloc ne se charge pas affiche « Impossible d'afficher cet écran. » et « Réessayer »,
 * comme les blocs avant les onglets ; les autres onglets restent utilisables. Le bloc du Bilan est rendu illisible ici.
 */
vi.mock('../progress/WeeklyReview', () => ({
  get WeeklyReview(): never {
    throw new Error('bloc illisible (test)');
  },
}));

const DEVICE = '60000000-0000-4000-8000-0000000003a2' as DeviceId;

describe('PROG-0301a : P-37, échec de chargement d’un onglet', () => {
  let db: TestDb;
  beforeEach(async () => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-04T08:00:00.000Z');
    await Promise.all([import('./SectionNoticeProgress'), import('../strength/StrengthScore'), import('../../../content/strength/standards.json'), import('../../../content/exercises/exercises.json')]);
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('Bilan illisible : message et Réessayer dans son panneau ; Force reste affichable', async () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    render(
      <AppContainerProvider container={container}>
        <SectionNotice tab="progress" />
      </AppContainerProvider>,
    );
    const tabs = await screen.findByRole('tablist', { name: 'Progrès' });
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Bilan' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Bilan' });
    expect(await within(panel).findByText('Impossible d’afficher cet écran.')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Force' }));
    expect(await within(await screen.findByRole('tabpanel', { name: 'Force' })).findByRole('region', { name: 'Strength Score' })).toBeInTheDocument();
  });
});
