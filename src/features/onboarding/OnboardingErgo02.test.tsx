import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { HealthKit, HealthKitBodyMass, HealthKitRead } from '../../platform/healthkit';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { loadTrainingContent } from '../training/content';
import { OnboardingFlow } from './OnboardingFlow';

/** ERGO-02 (C4, C5, C6, C9) : onboarding en 8 étapes selon l'aperçu du 13/11, iPhone (440 px) et PC (1 440 px). Présentation seule. */
const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;
const TITLES = ['Toi', 'Ton objectif', 'Ton expérience', 'Ton temps', 'Où t’entraînes-tu ?', 'Tes priorités', 'Ta semaine', 'Prêt'] as const;
const NAMES = ['Toi', 'Objectif', 'Expérience', 'Disponibilité', 'Matériel', 'Priorités', 'Split', 'Résultat'] as const;

const press = (label: string | RegExp, selector = 'button'): void => {
  fireEvent.click(screen.getByText(label, { selector }));
};
const title = (text: string) => screen.findByText(text, { selector: 'h1' });
const setWidth = (px: number): void => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
};
const key = (name: string): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: name });
};
const mass = (kg: number): HealthKitBodyMass => ({ kg, measuredAt: '2026-11-13T06:40:00.000Z', timezone: 'Europe/Paris', uuid: 'u1', source: { name: 'Renpho', bundleIdentifier: 'fr.test' } });
const fakeHealthKit = (read: HealthKitRead<HealthKitBodyMass>) => {
  const bodyMassToday = vi.fn(async () => read);
  const requestAuthorization = vi.fn(async () => 'granted' as const);
  const healthKit: HealthKit = {
    availability: async () => 'available',
    requestAuthorization,
    bodyMassToday,
    stepCountToday: async () => ({ state: 'empty' }),
    diagnostic: async () => ({ available: true, usageDescription: true, error: null }),
  };
  return { healthKit, bodyMassToday, requestAuthorization };
};

describe('ERGO-02 : onboarding selon l’aperçu du 13/11', () => {
  let db: TestDb;
  const onClose = vi.fn();
  const open = (healthKit?: HealthKit) => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <OnboardingFlow mode="first-launch" onClose={onClose} {...(healthKit ? { healthKit } : {})} />
      </AppContainerProvider>,
    );
  };

  beforeAll(async () => {
    await loadTrainingContent();
  });
  beforeEach(async () => {
    onClose.mockClear();
    setWidth(1440);
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    db = await openBaseDb(DEVICE, '2026-11-13T09:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    setWidth(1024);
    await db.close();
  });

  it('les 8 étapes ont les titres et l’indicateur « Étape n sur 8 » de l’aperçu, de Toi à Prêt', async () => {
    open();
    for (let i = 0; i < TITLES.length; i += 1) {
      await title(TITLES[i] as string);
      expect(screen.getByText(`Étape ${String(i + 1)} sur 8`)).toBeInTheDocument();
      if (i < TITLES.length - 1) press('Passer cette étape');
    }
  });

  it('PC : les 8 étapes sont listées à gauche avec leur avancement, la question au centre', async () => {
    open();
    await title('Toi');
    const nav = screen.getByRole('navigation', { name: 'Étapes de la configuration' });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(8);
    NAMES.forEach((name, i) => expect(items[i]).toHaveTextContent(name));
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveAttribute('data-state', 'current');
    expect(items[1]).toHaveAttribute('data-state', 'todo');
    expect(screen.getByText('Configuration · ≈ 6 min')).toBeInTheDocument();
    expect(screen.getByText('Brouillon gardé à chaque étape. Toute question non essentielle peut être passée.')).toBeInTheDocument();
    expect(document.querySelectorAll('[role="dialog"] h1')).toHaveLength(1);
    press('Continuer');
    await title('Ton objectif');
    const after = within(screen.getByRole('navigation', { name: 'Étapes de la configuration' })).getAllByRole('listitem');
    expect(after[0]).toHaveAttribute('data-state', 'done');
    expect(after[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Entrée pour continuer')).toBeInTheDocument();
  });

  it('iPhone : pas de colonne d’étapes ; « ≈ 6 min », 8 segments de progression, « Passer » en tête d’écran', async () => {
    setWidth(440);
    open();
    await title('Toi');
    expect(screen.queryByRole('navigation', { name: 'Étapes de la configuration' })).toBeNull();
    expect(screen.getByText('≈ 6 min')).toBeInTheDocument();
    expect(screen.getByText('Λ SPARTIATE')).toBeInTheDocument();
    expect(document.querySelectorAll('.ct-onb__segment')).toHaveLength(8);
    expect(document.querySelector('.ct-onb__header')).toContainElement(screen.getByText('Passer cette étape'));
  });

  it('objectif et expérience : cartes de choix avec leur précision, rythme chiffré avec l’équivalent en kilos', async () => {
    open();
    await title('Toi');
    fireEvent.change(screen.getByLabelText('Poids (kg)'), { target: { value: '80' } });
    press('Continuer');
    await title('Ton objectif');
    expect(screen.getByText('surplus léger')).toBeInTheDocument();
    expect(screen.getByText('déficit modéré, muscle préservé')).toBeInTheDocument();
    press('Perdre du gras');
    press('−0,5 % par semaine');
    expect(screen.getByText('−0,5 %', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/du poids \/ sem\. · ≈ −0,4 kg/)).toBeInTheDocument();
    press('Continuer');
    await title('Ton expérience');
    expect(screen.getByText('Moins d’un an de musculation régulière, ou reprise après une longue pause.')).toBeInTheDocument();
    expect(screen.getByText('Plus de 4 ans, programmation structurée, progression devenue lente.')).toBeInTheDocument();
  });

  it('étape 1, PC : le poids n’est jamais lu dans Santé, le texte de l’aperçu l’explique', async () => {
    const { healthKit, bodyMassToday } = fakeHealthKit({ state: 'granted', value: mass(81.2) });
    open(healthKit);
    await title('Toi');
    expect(screen.getByText('Sur le PC, le poids n’est pas lu dans Apple Santé : saisis-le, ou laisse l’iPhone le compléter à la prochaine synchro.')).toBeInTheDocument();
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue('');
    expect(bodyMassToday).not.toHaveBeenCalled();
  });

  it('étape 1, iPhone : poids pré-rempli depuis Santé quand l’autorisation existe, modifiable', async () => {
    setWidth(440);
    const { healthKit } = fakeHealthKit({ state: 'granted', value: mass(81.2) });
    open(healthKit);
    await title('Toi');
    await waitFor(() => expect(screen.getByLabelText('Poids (kg)')).toHaveValue('81,2'));
    expect(screen.getByText(/Poids pré-rempli depuis Apple Santé/)).toBeInTheDocument();
    expect(screen.queryByText(/Sur le PC/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Poids (kg)'), { target: { value: '80,5' } });
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue('80,5');
  });

  it('étape 1, iPhone : sans autorisation ou sans mesure, rien n’est pré-rempli et aucune demande d’autorisation n’est faite', async () => {
    setWidth(440);
    for (const state of ['denied', 'empty', 'unavailable'] as const) {
      const { healthKit, bodyMassToday, requestAuthorization } = fakeHealthKit({ state });
      const view = open(healthKit);
      await title('Toi');
      await waitFor(() => expect(bodyMassToday).toHaveBeenCalled());
      expect(screen.getByLabelText('Poids (kg)')).toHaveValue('');
      expect(screen.queryByText(/pré-rempli depuis Apple Santé/)).toBeNull();
      expect(requestAuthorization).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('clavier PC : Entrée continue depuis un champ, 1 / 2 / 3 choisissent l’expérience, ← → règlent les séances par semaine', async () => {
    open();
    await title('Toi');
    fireEvent.keyDown(screen.getByLabelText('Poids (kg)'), { key: 'Enter' });
    await title('Ton objectif');
    key('Enter');
    await title('Ton expérience');
    key('2');
    expect(screen.getByText('Intermédiaire', { selector: 'button' })).toHaveAttribute('aria-checked', 'true');
    key('3');
    expect(screen.getByText('Avancé', { selector: 'button' })).toHaveAttribute('aria-checked', 'true');
    key('1');
    expect(screen.getByText('Débutant', { selector: 'button' })).toHaveAttribute('aria-checked', 'true');
    key('Enter');
    await title('Ton temps');
    key('ArrowRight');
    const group = screen.getByText('Séances par semaine').closest('.ct-onb__group') as HTMLElement;
    const checked = () => within(group).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked()).toHaveLength(1);
    const before = Number(checked()[0]?.textContent);
    key('ArrowRight');
    expect(Number(checked()[0]?.textContent)).toBe(before + 1);
  });

  it('clavier : hors PC, ni Entrée ni 1 / 2 / 3 ne font rien', async () => {
    setWidth(440);
    open();
    await title('Toi');
    fireEvent.keyDown(screen.getByLabelText('Poids (kg)'), { key: 'Enter' });
    expect(screen.getByText('Toi', { selector: 'h1' })).toBeInTheDocument();
    press('Continuer');
    await title('Ton objectif');
    press('Continuer');
    await title('Ton expérience');
    key('2');
    expect(screen.getByText('Intermédiaire', { selector: 'button' })).toHaveAttribute('aria-checked', 'false');
  });

  it('étape 8 : la dépense est dite « point de départ, recalculée après 2 semaines » ; première séance en tableau (exercice, cible)', async () => {
    open();
    await title('Toi');
    press('Homme');
    fireEvent.change(screen.getByLabelText('Année de naissance'), { target: { value: '1996' } });
    fireEvent.change(screen.getByLabelText('Taille (cm)'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('Poids (kg)'), { target: { value: '80' } });
    press('Modérément actif');
    press('Continuer');
    await title('Ton objectif');
    press('Passer cette étape');
    await title('Ton expérience');
    press('Passer cette étape');
    await title('Ton temps');
    press('3', 'button');
    press('60 min');
    press('Continuer');
    await title('Où t’entraînes-tu ?');
    press('Salle complète');
    press('Continuer');
    await title('Tes priorités');
    press('Continuer');
    await title('Ta semaine');
    expect(await screen.findByText(/Full Body 3 j/)).toBeInTheDocument();
    press('Continuer');
    await title('Prêt');
    expect(screen.getByText(/Dépense : point de départ de 2\s?760 kcal \(Mifflin-St Jeor\), recalculée après 2 semaines de journal et de pesées\./)).toBeInTheDocument();
    expect(screen.queryByText('Passer cette étape')).toBeNull();
    const table = await screen.findByRole('table', { name: 'Première séance' });
    expect(within(table).getByText('Exercice', { selector: 'th' })).toBeInTheDocument();
    expect(within(table).getByText('Cible', { selector: 'th' })).toBeInTheDocument();
    expect(screen.getByText('Entrée pour commencer')).toBeInTheDocument();
  });

  it('FIX-0171 inchangé : tout passer n’écrit ni profil ni pesée ; le brouillon est gardé à chaque étape', async () => {
    open();
    await title('Toi');
    press('Passer cette étape');
    await title('Ton objectif');
    await waitFor(async () => expect(await db.data.repos.settings.get('onboarding.draft')).toMatchObject({ step: 'goal' }));
    for (let i = 0; i < 6; i += 1) press('Passer cette étape');
    await title('Prêt');
    expect(await db.driver.select('SELECT kg FROM body_weight')).toEqual([]);
    expect(await db.driver.select('SELECT sex FROM profile')).toEqual([]);
  });

  it('garde-fous : une seule action pleine par étape, aucun point d’exclamation, boutons nommés', async () => {
    open();
    for (let i = 0; i < TITLES.length; i += 1) {
      await title(TITLES[i] as string);
      expect(document.querySelectorAll('.ct-button--primary, .ct-button--danger').length).toBeLessThanOrEqual(1);
      expect(document.querySelector('[role="dialog"]')?.textContent ?? '').not.toContain('!');
      for (const button of Array.from(document.querySelectorAll('button'))) {
        expect((button.getAttribute('aria-label') ?? button.textContent ?? '').trim(), button.outerHTML).not.toBe('');
      }
      if (i < TITLES.length - 1) press('Passer cette étape');
    }
  });
});
