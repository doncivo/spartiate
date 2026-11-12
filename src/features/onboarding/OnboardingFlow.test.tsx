import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { loadTrainingContent } from '../training/content';
import { OnboardingFlow } from './OnboardingFlow';

const DEVICE = '60000000-0000-4000-8000-0000000000c8' as DeviceId;

/** Un clic sur un bouton du texte donné (les requêtes par rôle sont lentes sous couverture : texte et sélecteur). */
const press = (label: string | RegExp, selector = 'button'): void => {
  fireEvent.click(screen.getByText(label, { selector }));
};
const title = (text: string) => screen.findByText(text, { selector: 'h1' });

describe('Onboarding en 8 écrans (I3-07)', () => {
  let db: TestDb;
  const onClose = vi.fn();
  const open = () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <OnboardingFlow mode="first-launch" onClose={onClose} />
      </AppContainerProvider>,
    );
  };

  beforeAll(async () => {
    await loadTrainingContent();
  });
  beforeEach(async () => {
    onClose.mockClear();
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('écran 1 : « Toi », étape 1 sur 8, dialogue modal, le titre reçoit le focus ; aucune valeur inventée', async () => {
    open();
    const heading = await title('Toi');
    expect(screen.getByText('Configuration · étape 1 sur 8')).toBeInTheDocument();
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(heading).toHaveFocus();
    expect(screen.getByLabelText('Taille (cm)')).toHaveValue('');
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue('');
    expect(screen.getByLabelText('Année de naissance')).toHaveValue('');
    expect(screen.getByText(/indisponible/i)).toBeInTheDocument();
    expect(screen.queryByText('Retour')).toBeNull();
  });

  it('la dépense de départ (Mifflin-St Jeor) s’affiche dès que tout est saisi, comme point de départ recalculé après 2 semaines', async () => {
    open();
    await title('Toi');
    press('Homme');
    fireEvent.change(screen.getByLabelText('Année de naissance'), { target: { value: '1996' } });
    fireEvent.change(screen.getByLabelText('Taille (cm)'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('Poids (kg)'), { target: { value: '80' } });
    press('Modérément actif');
    expect(await screen.findByText(/Dépense estimée : 2\s?760 kcal par jour/)).toBeInTheDocument();
    expect(screen.getByText(/point de départ, recalculé après 2 semaines/i)).toBeInTheDocument();
  });

  it('valeur hors bornes : message en français, on ne passe pas à l’écran suivant', async () => {
    open();
    await title('Toi');
    fireEvent.change(screen.getByLabelText('Année de naissance'), { target: { value: '1900' } });
    press('Continuer');
    expect(await screen.findByText(/L’année de naissance doit être comprise entre 1920 et 2016/)).toBeInTheDocument();
    expect(screen.getByText('Toi', { selector: 'h1' })).toBeInTheDocument();
  });

  it('Passer avance sans rien enregistrer ; Retour revient en gardant les valeurs ; Retour absent au premier écran', async () => {
    open();
    await title('Toi');
    fireEvent.change(screen.getByLabelText('Taille (cm)'), { target: { value: '181' } });
    press('Continuer');
    await title('Objectif');
    expect(screen.getByText('Configuration · étape 2 sur 8')).toBeInTheDocument();
    press('Passer cette étape');
    await title('Expérience');
    press('Retour');
    await title('Objectif');
    press('Retour');
    await title('Toi');
    expect(screen.getByLabelText('Taille (cm)')).toHaveValue('181');
  });

  it('reprise après fermeture : le brouillon est relu à l’écran où Ali s’était arrêté', async () => {
    const first = open();
    await title('Toi');
    press('Femme');
    press('Continuer');
    await title('Objectif');
    press('Prendre du muscle');
    press('Continuer');
    await title('Expérience');
    await waitFor(async () => expect(await db.data.repos.settings.get('onboarding.draft')).toMatchObject({ step: 'experience', sex: 'female', goal: 'muscle' }));
    first.unmount();
    open();
    await title('Expérience');
    press('Retour');
    await title('Objectif');
    expect(screen.getByText('Prendre du muscle', { selector: 'button' })).toHaveAttribute('aria-checked', 'true');
  });

  it('objectif : le rythme n’est proposé que pour prendre du muscle ou perdre du gras, borné de −1 % à +0,5 %', async () => {
    open();
    await title('Toi');
    press('Continuer');
    await title('Objectif');
    press('Maintenir');
    expect(screen.queryByText('Rythme par semaine')).toBeNull();
    press('Perdre du gras');
    expect(await screen.findByText('Rythme par semaine')).toBeInTheDocument();
    expect(screen.getByText('−1 % par semaine', { selector: 'button' })).toBeInTheDocument();
    expect(screen.queryByText('−1,5 % par semaine', { selector: 'button' })).toBeNull();
    press('Prendre du muscle');
    expect(screen.getByText('+0,5 % par semaine', { selector: 'button' })).toBeInTheDocument();
    expect(screen.queryByText('+0,75 % par semaine', { selector: 'button' })).toBeNull();
  });

  it('disponibilité : moins de jours que de séances est refusé avec une phrase', async () => {
    open();
    await title('Toi');
    press('Continuer');
    await title('Objectif');
    press('Continuer');
    await title('Expérience');
    press('Continuer');
    await title('Disponibilité');
    press('4', 'button');
    fireEvent.click(screen.getByLabelText('Lundi'));
    fireEvent.click(screen.getByLabelText('Mercredi'));
    press('Continuer');
    expect(await screen.findByText('Choisis au moins autant de jours que de séances par semaine.')).toBeInTheDocument();
  });

  it('priorités : toucher un muscle le fait passer prioritaire, évité, normal ; 2 prioritaires au plus', async () => {
    open();
    await title('Toi');
    for (const next of ['Objectif', 'Expérience', 'Disponibilité', 'Matériel', 'Priorités']) {
      press('Continuer');
      await title(next);
    }
    const chest = (): HTMLElement => screen.getByLabelText(/^Pectoraux, /);
    expect(chest()).toHaveAttribute('aria-label', 'Pectoraux, normal');
    fireEvent.click(chest());
    expect(chest()).toHaveAttribute('aria-label', 'Pectoraux, à prioriser');
    expect(screen.getByText('Prioriser : 1 sur 2')).toBeInTheDocument();
    fireEvent.click(chest());
    expect(chest()).toHaveAttribute('aria-label', 'Pectoraux, à éviter');
    expect(screen.getByText('Éviter : 1 sur 4')).toBeInTheDocument();
    fireEvent.click(chest());
    expect(chest()).toHaveAttribute('aria-label', 'Pectoraux, normal');
    fireEvent.click(screen.getByLabelText(/^Dos, /));
    fireEvent.click(screen.getByLabelText(/^Épaules, /));
    fireEvent.click(screen.getByLabelText(/^Biceps, /));
    expect(screen.getByText('Prioriser : 2 sur 2')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Biceps, /)).toHaveAttribute('aria-label', 'Biceps, à éviter');
  });

  it('parcours complet de 8 écrans : profil, pesée, routine proposée ajoutée, onboarding terminé, retour à Aujourd’hui', async () => {
    open();
    await title('Toi');
    press('Homme');
    fireEvent.change(screen.getByLabelText('Année de naissance'), { target: { value: '1996' } });
    fireEvent.change(screen.getByLabelText('Taille (cm)'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('Poids (kg)'), { target: { value: '80' } });
    press('Modérément actif');
    press('Continuer');
    await title('Objectif');
    press('Prendre du muscle');
    press('+0,25 % par semaine');
    press('Continuer');
    await title('Expérience');
    press('Intermédiaire');
    press('Continuer');
    await title('Disponibilité');
    press('3', 'button');
    press('60 min');
    press('Continuer');
    await title('Matériel');
    press('Fitness Park Antony');
    press('Continuer');
    await title('Priorités');
    press('Continuer');
    await title('Split');
    expect(await screen.findByText(/Full Body 3 j/)).toBeInTheDocument();
    press('Continuer');
    await title('Résultat');
    expect(screen.getByText('Configuration · étape 8 sur 8')).toBeInTheDocument();
    expect(await screen.findByText(/Dépense estimée/)).toBeInTheDocument();
    expect(screen.getByText(/Première séance/)).toBeInTheDocument();
    press('Commencer');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('done'));
    expect(await db.driver.select('SELECT sex, birth_year, height_cm, goal, experience FROM profile')).toEqual([{ sex: 'male', birth_year: 1996, height_cm: 180, goal: 'gain', experience: 'intermediate' }]);
    expect(await (await db.data.repos.trainingRoutines()).list()).toHaveLength(1);
    expect(await db.data.repos.settings.get('onboarding.completed')).toBe(true);
    expect(useNavigationStore.getState().route).toEqual({ tab: 'today' });
  });

  it('résultat : la dépense de départ est modifiable et peut être rétablie', async () => {
    open();
    await title('Toi');
    press('Homme');
    fireEvent.change(screen.getByLabelText('Année de naissance'), { target: { value: '1996' } });
    fireEvent.change(screen.getByLabelText('Taille (cm)'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('Poids (kg)'), { target: { value: '80' } });
    press('Modérément actif');
    for (const next of ['Objectif', 'Expérience', 'Disponibilité', 'Matériel', 'Priorités', 'Split', 'Résultat']) {
      press('Continuer');
      await title(next);
    }
    const field = await screen.findByLabelText('Dépense de départ (kcal par jour)');
    expect(field).toHaveValue('2760');
    fireEvent.change(field, { target: { value: '2900' } });
    expect(screen.getByLabelText('Dépense de départ (kcal par jour)')).toHaveValue('2900');
    press('Rétablir l’estimation');
    expect(screen.getByLabelText('Dépense de départ (kcal par jour)')).toHaveValue('2760');
  });

  it('Modifier revient au premier écran sans rien écrire', async () => {
    open();
    await title('Toi');
    for (const next of ['Objectif', 'Expérience', 'Disponibilité', 'Matériel', 'Priorités', 'Split', 'Résultat']) {
      press('Continuer');
      await title(next);
    }
    press('Modifier');
    await title('Toi');
    expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Échap et Fermer quittent sans terminer ; le brouillon reste', async () => {
    open();
    await title('Toi');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('closed'));
    expect(await db.data.repos.settings.get('onboarding.completed')).toBe(false);
  });

  it('les cibles tactiles et les groupes ont un nom accessible : tous les boutons nomment leur action', async () => {
    open();
    await title('Toi');
    for (const button of Array.from(document.querySelectorAll('button'))) {
      expect((button.getAttribute('aria-label') ?? button.textContent ?? '').trim(), button.outerHTML).not.toBe('');
    }
  });
});
