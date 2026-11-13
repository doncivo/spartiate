import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { PC_MEDIA_QUERY } from '../../ui/useLayout';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { createFakePrivacyShield } from '../../platform/privacyShield';
import { BodyProgress } from './BodyProgress';

/**
 * ERGO-02 (C1, C2, C9) : Progrès › Corps d'après l'aperçu (Corps-apres, PC-Corps-apres) : silhouette et zones, dernière mesure en héros avec
 * l'écart sur 4 semaines, saisie en une ligne, valeurs Renpho ; PC : liste des zones à gauche, flèches et Entrée au clavier.
 * Fixtures synthétiques ; les calculs, les dépôts et l'enregistrement sont ceux d'I6-02.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const NOW = '2026-11-12T09:00:00.000Z';
let db: TestDb;
const D = (m: number, d: number): LocalDate => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` as LocalDate;

beforeAll(async () => {
  // Premier rendu à froid : modules et catalogue chargés avant les tests (aucune attente allongée).
  await import('./BodyProgress');
  await import('../../i18n/bodyProgressText');
  await import('../../ui/MissingValue');
});

function viewport(pc: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: pc && query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, privacyShield: createFakePrivacyShield() })}>
      <BodyProgress pickPhoto={() => Promise.resolve(null)} />
    </AppContainerProvider>,
  );
async function seedWaist(): Promise<void> {
  const repo = await db.data.repos.measurements();
  await repo.save(D(10, 12), 'waist', 88.5);
  await repo.save(D(11, 9), 'waist', 86.5);
  await repo.save(D(11, 9), 'hips', 98);
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, NOW);
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('aucune requête réseau attendue'))));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('Corps iPhone (Corps-apres)', () => {
  beforeEach(() => viewport(false));

  it('héros : dernière mesure de la zone, écart sur 4 semaines dit en texte (signe, unité), date de la dernière mesure', async () => {
    await seedWaist();
    mount();
    const region = await screen.findByRole('region', { name: 'Mensurations' });
    expect(within(region).getByText('86,5')).toBeInTheDocument();
    expect(within(region).getByText('−2 cm en 4 semaines')).toBeInTheDocument();
    expect(within(region).getByText('dernière mesure le 9 nov. 2026')).toBeInTheDocument();
  });

  it('silhouette : zone sélectionnée dite en texte ; toucher une zone de la silhouette la choisit', async () => {
    await seedWaist();
    const view = mount();
    expect(await screen.findByRole('img', { name: 'Silhouette, zone Taille sélectionnée' })).toBeInTheDocument();
    fireEvent.click(view.container.querySelector('[data-zone="hips"]') as Element);
    expect(await screen.findByRole('img', { name: 'Silhouette, zone Hanches sélectionnée' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hanches' })).toBeChecked();
  });

  it('les 11 zones sont des boutons radio nommés ; choisir une zone la sélectionne', async () => {
    await seedWaist();
    mount();
    const group = await screen.findByRole('radiogroup', { name: 'Zone' });
    expect(within(group).getAllByRole('radio')).toHaveLength(11);
    expect(within(group).getByRole('radio', { name: 'Taille' })).toBeChecked();
    fireEvent.click(within(group).getByRole('radio', { name: 'Cuisse gauche' }));
    expect(within(group).getByRole('radio', { name: 'Cuisse gauche' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Taille' })).not.toBeChecked();
  });

  it('zone sans mesure : un tiret et sa raison, jamais un 0', async () => {
    await seedWaist();
    mount();
    fireEvent.click(await screen.findByRole('radio', { name: 'Cou' }));
    const region = screen.getByRole('region', { name: 'Mensurations' });
    expect(await within(region).findByText('pas encore de mesure pour cette zone')).toBeInTheDocument();
    expect(region.textContent ?? '').not.toMatch(/(^|\D)0 cm/);
  });

  it('saisie en une ligne : date, mesure, bouton ; aucune liste déroulante ; une mesure enregistrée apparaît dans le héros', async () => {
    mount();
    const region = await screen.findByRole('region', { name: 'Mensurations' });
    expect(region.querySelector('select')).toBeNull();
    const form = region.querySelector('form') as HTMLFormElement;
    expect(form.querySelectorAll('input')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Mesure (cm)'), { target: { value: '85,5' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(region).findByText('85,5')).toBeInTheDocument();
    expect((await (await db.data.repos.measurements()).list('waist')).map((m) => [m.day, m.value])).toEqual([['2026-11-12', 85.5]]);
  });

  it('valeurs importées de Santé : étiquette et valeur séparées (grille), lecture seule', async () => {
    const repo = await db.data.repos.measurements();
    await repo.save(D(11, 11), 'health_body_fat_pct', 17.8);
    await repo.save(D(11, 11), 'health_lean_mass_kg', 66.9);
    mount();
    const card = within(await screen.findByRole('region', { name: 'Importé de Santé (Renpho)' }));
    expect(card.getByText('Masse grasse')).toBeInTheDocument();
    expect(card.getByText('17,8 %')).toBeInTheDocument();
    expect(card.getByText('Masse maigre')).toBeInTheDocument();
    expect(card.getByText('66,9 kg')).toBeInTheDocument();
    expect(card.queryByRole('button')).toBeNull();
  });

  it('photos : sélecteur existant inchangé, rappel que les images restent sur l’appareil', async () => {
    mount();
    const photos = await screen.findByRole('region', { name: 'Photos de progression' });
    expect(within(photos).getByRole('button', { name: 'Ajouter une photo' })).toBeInTheDocument();
    expect(within(photos).getByText(/restent sur cet appareil/)).toBeInTheDocument();
  });
});

describe('Corps PC (PC-Corps-apres)', () => {
  beforeEach(() => viewport(true));

  it('liste des zones à gauche : dernière valeur et écart sur 4 semaines par zone, tiret sans mesure ; pas de silhouette', async () => {
    await seedWaist();
    mount();
    const group = await screen.findByRole('radiogroup', { name: 'Zone' });
    const waist = within(group).getByRole('radio', { name: 'Taille' });
    expect(waist).toBeChecked();
    expect(waist.textContent).toContain('86,5');
    expect(waist.textContent).toContain('−2');
    expect(within(group).getByRole('radio', { name: 'Cou' }).textContent).toContain('—');
    expect(screen.queryByRole('img', { name: /Silhouette/ })).toBeNull();
  });

  it('flèche bas / haut dans le champ de saisie change de zone', async () => {
    await seedWaist();
    mount();
    const input = await screen.findByLabelText('Mesure (cm)');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(await screen.findByRole('radio', { name: 'Hanches' })).toBeChecked();
    fireEvent.keyDown(screen.getByLabelText('Mesure (cm)'), { key: 'ArrowUp' });
    expect(await screen.findByRole('radio', { name: 'Taille' })).toBeChecked();
  });

  it('clavier : Entrée enregistre (formulaire), Tab suit l’ordre date, mesure, Enregistrer ; aucun tabindex positif', async () => {
    mount();
    const value = await screen.findByLabelText('Mesure (cm)');
    const date = screen.getByLabelText('Date');
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    expect(date.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(value.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).toHaveLength(0);
    fireEvent.change(value, { target: { value: '90' } });
    fireEvent.submit(value.closest('form') as HTMLFormElement);
    await waitFor(async () => expect((await (await db.data.repos.measurements()).list('waist')).map((m) => m.value)).toEqual([90]));
  });

  it('courbe : image nommée avec la première et la dernière valeur', async () => {
    await seedWaist();
    mount();
    expect(await screen.findByRole('img', { name: 'Taille : de 88,5 à 86,5 cm' })).toBeInTheDocument();
  });
});
