import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { loadTrainingContent } from '../training/content';
import { OnboardingHost } from './OnboardingHost';
import { SKIP_ONBOARDING_KEY } from './onboardingData';

const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;

describe('Hôte de l’onboarding : premier lancement sur base vide (I3-07)', () => {
  let db: TestDb;
  const open = () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <OnboardingHost />
      </AppContainerProvider>,
    );
  };
  const dialog = (): Element | null => document.querySelector('[role="dialog"]');
  /** Attend que l'hôte ait pris sa décision (repère posé sur <html>), au lieu d'un délai. */
  const decided = (): Promise<void> => waitFor(() => expect(document.documentElement.hasAttribute('data-ct-onboarding')).toBe(true));

  beforeAll(async () => {
    await loadTrainingContent();
  });
  beforeEach(async () => {
    localStorage.removeItem(SKIP_ONBOARDING_KEY);
    document.documentElement.removeAttribute('data-ct-onboarding');
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    localStorage.setItem(SKIP_ONBOARDING_KEY, '1');
    await db.close();
  });

  it('base vide et jamais terminé : l’onboarding s’affiche tout seul', async () => {
    open();
    expect(await screen.findByText('Toi', { selector: 'h1' })).toBeInTheDocument();
    expect(dialog()).not.toBeNull();
  });

  it('base qui contient déjà des données (mise à jour d’une installation) : rien n’est montré, l’onboarding est marqué terminé', async () => {
    await (await db.data.repos.profile()).save({ sex: 'male' }, 2026);
    open();
    await waitFor(async () => expect(await db.data.repos.settings.get('onboarding.completed')).toBe(true));
    expect(dialog()).toBeNull();
  });

  it('déjà terminé : jamais tout seul, même sur base vide', async () => {
    await db.data.repos.settings.set('onboarding.completed', true);
    open();
    await decided();
    expect(document.documentElement.getAttribute('data-ct-onboarding')).toBe('skip');
    expect(dialog()).toBeNull();
  });

  it('« Revoir mes réglages » (surcouche demandée) : s’affiche même terminé et sur base non vide ; Fermer retire la surcouche', async () => {
    await db.data.repos.settings.set('onboarding.completed', true);
    await (await db.data.repos.profile()).save({ sex: 'male', heightCm: 180 }, 2026);
    open();
    act(() => useNavigationStore.getState().openOverlay({ kind: 'onboarding' }));
    expect(await screen.findByText('Toi', { selector: 'h1' })).toBeInTheDocument();
    // Les réglages enregistrés préremplissent les champs.
    expect(await screen.findByLabelText('Taille (cm)')).toHaveValue('180');
    fireEvent.click(screen.getByLabelText('Fermer la configuration'));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(useNavigationStore.getState().overlays).toEqual([]);
  });

  it('premier lancement fermé : l’onboarding est marqué terminé et ne revient pas', async () => {
    const view = open();
    await screen.findByText('Toi', { selector: 'h1' });
    fireEvent.click(screen.getByLabelText('Fermer la configuration'));
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(async () => expect(await db.data.repos.settings.get('onboarding.completed')).toBe(true));
    view.unmount();
    document.documentElement.removeAttribute('data-ct-onboarding');
    open();
    await decided();
    expect(document.documentElement.getAttribute('data-ct-onboarding')).toBe('skip');
    expect(dialog()).toBeNull();
  });

  it('accroche de développement (e2e, tests) : le drapeau local masque le lancement automatique sans rien écrire', async () => {
    localStorage.setItem(SKIP_ONBOARDING_KEY, '1');
    open();
    await decided();
    expect(document.documentElement.getAttribute('data-ct-onboarding')).toBe('disabled');
    expect(dialog()).toBeNull();
    expect(await db.data.repos.settings.get('onboarding.completed')).toBe(false);
  });
});
