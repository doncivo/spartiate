import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
 * EQUIP-0302 (BL-175, D-674) : éditeur du profil de matériel, champ « Poids du gilet (kg) » visible quand le gilet lesté est coché (disponible ou
 * forcé), décimale française, bornes 0,5 à 60 kg ; vide : non renseigné, l'éditeur dit que le gilet n'est alors pas proposé comme lest. Base SQLite
 * réelle (wasm), contenu embarqué. Données synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000302e1' as DeviceId;
const FIELD = /^Poids du gilet \(kg\)/;
/** Copie du profil « Poids de corps » : la copie de « Salle complète » a déjà 64 matériels disponibles, plafond de la liste (constat hors ticket). */
const COPY = 'Poids de corps (copie)';

describe('EQUIP-0302 : éditeur, poids du gilet', () => {
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
  const vest = async () => (await db.driver.select<{ vest_kg: number | null }>('SELECT vest_kg FROM equipment_profile'))[0]?.vest_kg;
  const editCopy = async (): Promise<void> => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Poids de corps/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dupliquer pour modifier' }));
    await screen.findByRole('heading', { name: COPY });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
  };
  const vestBox = (group: string) => within(screen.getByRole('group', { name: group })).getByRole('checkbox', { name: 'Gilet lesté' });
  const save = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
  };

  beforeAll(async () => {
    await loadTrainingContent();
  });
  beforeEach(async () => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-27T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('gilet non coché : aucun champ ; coché (disponible ou forcé) : champ visible, aide reliée qui dit qu’un gilet sans poids n’est pas proposé', async () => {
    await editCopy();
    expect(screen.queryByLabelText(FIELD)).toBeNull();
    fireEvent.click(vestBox('Matériel disponible'));
    const field = screen.getByLabelText(FIELD);
    expect(field).toHaveAttribute('inputmode', 'decimal');
    const hint = document.getElementById(field.getAttribute('aria-describedby') ?? '');
    expect(hint).toHaveTextContent('Sans poids renseigné, le gilet n’est pas proposé comme lest.');
    fireEvent.click(vestBox('Matériel disponible'));
    expect(screen.queryByLabelText(FIELD)).toBeNull();
    fireEvent.click(vestBox('Matériel forcé (toujours proposé)'));
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument();
  });

  it('« 7,5 » : enregistré 7,5 kg, affiché sur la fiche et relu tel quel à la modification suivante', async () => {
    await editCopy();
    fireEvent.click(vestBox('Matériel disponible'));
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '7,5' } });
    await save();
    await screen.findByRole('heading', { name: COPY });
    expect(await vest()).toBe(7.5);
    expect(screen.getByText('Gilet lesté', { selector: 'dt' }).nextElementSibling).toHaveTextContent('7,5 kg');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
    expect(screen.getByLabelText(FIELD)).toHaveValue('7,5');
  });

  it('valeur hors bornes, au-delà du dixième ou illisible : message nommé, rien d’écrit', async () => {
    await editCopy();
    fireEvent.click(vestBox('Matériel disponible'));
    for (const bad of ['70', '0,2', '7,55', 'dix']) {
      fireEvent.change(screen.getByLabelText(FIELD), { target: { value: bad } });
      await save();
      expect(await screen.findByRole('alert')).toHaveTextContent('Poids du gilet : un nombre de 0,5 à 60 kg, au dixième (ex. 7,5).');
    }
    expect(await vest()).toBeNull();
  });

  it('champ vide : poids non renseigné (nul), la fiche le dit ; gilet décoché ensuite : le poids enregistré est gardé', async () => {
    await editCopy();
    fireEvent.click(vestBox('Matériel disponible'));
    await save();
    await screen.findByRole('heading', { name: COPY });
    expect(await vest()).toBeNull();
    expect(screen.getByText('Gilet lesté', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Poids non renseigné : pas de lest proposé');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '12' } });
    await save();
    await screen.findByRole('heading', { name: COPY });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
    fireEvent.click(vestBox('Matériel disponible'));
    await save();
    await screen.findByRole('heading', { name: COPY });
    expect(await vest()).toBe(12);
    expect(screen.queryByText('Gilet lesté', { selector: 'dt' })).toBeNull();
  });

  it('D-796 : copie de « Salle complète » (64 matériels déjà disponibles) : gilet coché avec 10 kg, enregistré et relu', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Dupliquer pour modifier' }));
    await screen.findByRole('heading', { name: 'Salle complète (copie)' });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
    fireEvent.click(vestBox('Matériel disponible'));
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '10' } });
    await save();
    await screen.findByRole('heading', { name: 'Salle complète (copie)' });
    expect(await vest()).toBe(10);
    const rows = await db.driver.select<{ inventory: string }>('SELECT inventory FROM equipment_profile');
    expect((JSON.parse(rows[0]?.inventory ?? '{}') as { available: string[] }).available).toContain('weighted-vest');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
    expect(screen.getByLabelText(FIELD)).toHaveValue('10');
  });

  it('D-796 : un refus de l’éditeur nomme sa raison (forcé et interdit à la fois, nom vide), jamais « Enregistrement impossible »', async () => {
    await editCopy();
    fireEvent.click(vestBox('Matériel forcé (toujours proposé)'));
    fireEvent.click(vestBox('Matériel interdit (jamais proposé)'));
    await save();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gilet lesté est à la fois forcé et interdit : décoche-le d’une des deux listes.');
    expect(alert).not.toHaveTextContent('Enregistrement impossible');
    fireEvent.click(vestBox('Matériel interdit (jamais proposé)'));
    fireEvent.change(screen.getByLabelText(/^Nom du profil/), { target: { value: '  ' } });
    await save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Le nom du profil est vide.');
  });
});
