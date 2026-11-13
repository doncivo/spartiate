import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { SupplementsView } from './SupplementsView';

/**
 * ERGO-02 (C1, C2, C9) : écran Compléments d'après l'aperçu (Complements-apres) : « 2 / 3 pris aujourd'hui » en héros, prises du jour groupées
 * par heure (Matin / Soir), coche de 44 px, bande « Constance · 14 jours » lisible sans la couleur. Gestion (modifier, pause, supprimer)
 * et rappels : inchangés (SupplementsView.test.tsx).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const TODAY = '2026-11-13' as LocalDate;
let db: TestDb;

beforeAll(async () => {
  await import('./SupplementsView');
  await import('../../../i18n/supplementsText');
});

const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <SupplementsView today={TODAY} />
    </AppContainerProvider>,
  );

async function seed(): Promise<void> {
  const repo = await db.data.repos.supplements();
  const creatine = await repo.create({ name: 'Créatine', dose: 5, unit: 'g', times: ['08:00' as LocalTime], days: 127, active: true });
  const d3 = await repo.create({ name: 'Vitamine D3', dose: 1000, unit: 'UI', times: ['08:00' as LocalTime], days: 127, active: true });
  await repo.create({ name: 'Oméga-3', dose: 2, unit: 'capsules', times: ['20:00' as LocalTime], days: 127, active: true });
  await repo.setTaken(creatine.id, TODAY, '08:00' as LocalTime, true);
  await repo.setTaken(d3.id, TODAY, '08:00' as LocalTime, true);
}

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-13T06:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Compléments (Complements-apres)', () => {
  it('héros : prises du jour en « 2 / 3 », dites en texte', async () => {
    await seed();
    mount();
    const hero = await screen.findByRole('group', { name: 'Prises du jour' });
    expect(within(hero).getByText('2 / 3')).toBeInTheDocument();
    expect(within(hero).getByText('pris aujourd’hui')).toBeInTheDocument();
  });

  it('prises groupées par heure, avec la dose et l’état dits en texte', async () => {
    await seed();
    mount();
    expect(await screen.findByText('Matin · 08:00')).toBeInTheDocument();
    expect(screen.getByText('Soir · 20:00')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Créatine : pris' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Marquer Oméga-3 comme pris' })).not.toBeChecked();
    expect(screen.getByText('5 g · pris')).toBeInTheDocument();
    expect(screen.getByText('2 capsules · prévu à 20:00')).toBeInTheDocument();
  });

  it('cocher une prise l’enregistre, passe le héros à « 3 / 3 » et renomme la coche', async () => {
    await seed();
    mount();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Marquer Oméga-3 comme pris' }));
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Oméga-3 : pris' })).toBeChecked();
    await waitFor(async () => expect(await (await db.data.repos.supplements()).intakes(TODAY, TODAY)).toHaveLength(3));
  });

  it('décocher une prise la retire', async () => {
    await seed();
    mount();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Créatine : pris' }));
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    await waitFor(async () => expect(await (await db.data.repos.supplements()).intakes(TODAY, TODAY)).toHaveLength(1));
  });

  it('constance : 14 jours, chaque jour dit en texte (jamais la couleur seule), part des prises', async () => {
    await seed();
    mount();
    const strip = await screen.findByRole('list', { name: 'Constance sur 14 jours' });
    const items = within(strip).getAllByRole('listitem');
    expect(items).toHaveLength(14);
    expect(items[13]!.textContent).toMatch(/en partie/);
    expect(items[0]!.textContent).toMatch(/rien de prévu/);
    expect(screen.getByText(/67 % des prises/)).toBeInTheDocument();
  });

  it('aucune prise prévue aujourd’hui : un tiret et sa raison, jamais « 0 / 0 »', async () => {
    const repo = await db.data.repos.supplements();
    await repo.create({ name: 'Zinc', dose: null, unit: null, times: ['08:00' as LocalTime], days: 127, active: false });
    mount();
    expect(await screen.findByText('aucune prise prévue aujourd’hui')).toBeInTheDocument();
    expect(screen.queryByText('0 / 0')).toBeNull();
  });

  it('aucun point d’exclamation', async () => {
    await seed();
    const view = mount();
    await screen.findByText('2 / 3');
    expect(view.container.textContent ?? '').not.toContain('!');
  });
});
