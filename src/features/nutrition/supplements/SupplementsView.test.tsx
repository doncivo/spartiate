import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { SupplementsView } from './SupplementsView';

/** I6-05 (critères 1, 3, 4) : section « Compléments » de Nutrition — liste, saisie, pause, suppression, constance ; rappels : PC = rien n'est envoyé. */
const DEVICE = '60000000-0000-4000-8000-0000000000d8' as DeviceId;
let db: TestDb;
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <SupplementsView today={'2026-11-13' as LocalDate} />
    </AppContainerProvider>,
  );

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-13T06:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('I6-05 : SupplementsView', () => {
  it('vide : l’invitation et le bouton d’ajout ; PC : les rappels sont envoyés par l’iPhone', async () => {
    mount();
    expect(await screen.findByText('Aucun complément. Ajoute le premier.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter un complément' })).toBeInTheDocument();
    expect(await screen.findByText('Les rappels sont envoyés par l’iPhone.')).toBeInTheDocument();
  });

  it('ajout : nom vide refusé avec un message ; saisie valide enregistrée et listée (dose, heures, jours)', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un complément' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Donne un nom au complément.');
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Magnésium' } });
    fireEvent.change(screen.getByLabelText('Dose'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Unité'), { target: { value: 'mg' } });
    fireEvent.change(screen.getByLabelText('Heure 1'), { target: { value: '21:30' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dimanche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const row = await screen.findByRole('listitem', { name: 'Magnésium' });
    expect(within(row).getByText('300 mg · 21:30 · lun., mar., mer., jeu., ven., sam.')).toBeInTheDocument();
    const [saved] = await (await db.data.repos.supplements()).list();
    expect(saved).toMatchObject({ name: 'Magnésium', dose: 300, unit: 'mg', times: ['21:30'], days: 63, active: true });
  });

  it('pause et reprise, suppression après confirmation', async () => {
    await (await db.data.repos.supplements()).create({ name: 'Zinc', dose: null, unit: null, times: ['08:00' as LocalTime], days: 127, active: true });
    mount();
    const row = await screen.findByRole('listitem', { name: 'Zinc' });
    fireEvent.click(within(row).getByRole('switch', { name: 'Actif' }));
    await waitFor(async () => expect((await (await db.data.repos.supplements()).list())[0]?.active).toBe(false));
    expect(await within(row).findByText('En pause')).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le complément' }));
    await waitFor(async () => expect(await (await db.data.repos.supplements()).list()).toEqual([]));
  });

  it('constance : 7 et 30 jours, série ; rien de dû : « — » (jamais un faux zéro)', async () => {
    const repo = await db.data.repos.supplements();
    const s = await repo.create({ name: 'Créatine', dose: 5, unit: 'g', times: ['08:00' as LocalTime], days: 127, active: true });
    await repo.setTaken(s.id, '2026-11-13' as LocalDate, '08:00' as LocalTime, true);
    mount();
    const stats = await screen.findByRole('region', { name: 'Constance' });
    await waitFor(() => expect(within(stats).getByText('7 jours : 100 % (1 sur 1)')).toBeInTheDocument());
    expect(within(stats).getByText('30 jours : 100 % (1 sur 1)')).toBeInTheDocument();
    expect(within(stats).getByText('Série : 1 jour complet')).toBeInTheDocument();
  });
});
