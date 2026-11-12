import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { BodyProgress } from './BodyProgress';

/**
 * I6-02 (§ 17.1, § 18) : Progrès › Corps — mensurations (saisie bornée, écart entre les deux dernières, suppression) et photos de progression (ajout,
 * affichage côte à côte, suppression fichier + fiche, fiche reçue de l'autre appareil sans image). Fixtures synthétiques ; aucune requête réseau.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
const NOW = '2026-11-12T09:00:00.000Z';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
let db: TestDb;

const container = (os: 'ios' | 'other') => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } });
const mount = (os: 'ios' | 'other' = 'ios', pickPhoto: () => Promise<Uint8Array | null> = () => Promise.resolve(JPEG)) =>
  render(
    <AppContainerProvider container={container(os)}>
      <BodyProgress pickPhoto={pickPhoto} />
    </AppContainerProvider>,
  );
const measures = async () => db.data.repos.measurements();
const photos = async () => db.data.repos.progressPhotos();
const D = (n: number): LocalDate => `2026-11-${String(n).padStart(2, '0')}` as LocalDate;

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

const enter = (value: string) => fireEvent.change(screen.getByLabelText('Mesure (cm)'), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

describe('mensurations', () => {
  it('section « Corps » avec ses deux parties, sur iPhone et sur PC, sans chiffre inventé', async () => {
    for (const os of ['ios', 'other'] as const) {
      const view = mount(os);
      expect(await screen.findByRole('region', { name: 'Mensurations' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Photos de progression' })).toBeInTheDocument();
      expect(screen.getByText('Aucune mesure pour cette zone.')).toBeInTheDocument();
      view.unmount();
    }
  });

  it('saisie d’une taille en virgule décimale : enregistrée (date du jour), affichée, une seule ligne', async () => {
    mount();
    await screen.findByRole('region', { name: 'Mensurations' });
    enter('82,5');
    submit();
    expect(await screen.findByText('82,5 cm')).toBeInTheDocument();
    const rows = await (await measures()).list('waist');
    expect(rows.map((m) => [m.day, m.value])).toEqual([['2026-11-12', 82.5]]);
  });

  it('la touche Entrée dans le champ enregistre (clavier PC)', async () => {
    mount('other');
    await screen.findByRole('region', { name: 'Mensurations' });
    enter('81');
    fireEvent.submit(screen.getByLabelText('Mesure (cm)').closest('form') as HTMLFormElement);
    expect(await screen.findByText('81 cm')).toBeInTheDocument();
  });

  it.each([
    ['', /Saisis une mesure/],
    ['abc', /illisible/],
    ['500', /plage plausible .* de 40 à 200 cm/],
    ['5', /plage plausible/],
    ['-3', /illisible/],
  ])('« %s » : refusé avec une alerte, rien n’est écrit', async (text, message) => {
    mount();
    await screen.findByRole('region', { name: 'Mensurations' });
    enter(text);
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(await (await measures()).list()).toEqual([]);
  });

  it('date future : refusée', async () => {
    mount();
    await screen.findByRole('region', { name: 'Mensurations' });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-20' } });
    enter('80');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/dans le futur/);
    expect(await (await measures()).list()).toEqual([]);
  });

  it('changer de zone affiche les mesures de cette zone', async () => {
    const repo = await measures();
    await repo.save(D(1), 'waist', 84);
    await repo.save(D(2), 'hips', 96);
    mount();
    expect(await screen.findByText('84 cm')).toBeInTheDocument();
    expect(screen.queryByText('96 cm')).toBeNull();
    fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'hips' } });
    expect(await screen.findByText('96 cm')).toBeInTheDocument();
  });

  it('écart entre les deux dernières mesures dit en texte (signe et unité) ; une seule mesure : pas d’écart', async () => {
    const repo = await measures();
    await repo.save(D(1), 'waist', 84);
    mount();
    expect(await screen.findByText(/deuxième mesure permettra/)).toBeInTheDocument();
    cleanup();
    await repo.save(D(10), 'waist', 82.5);
    mount();
    expect(await screen.findByText(/Écart depuis le 1er nov. 2026 : −1,5 cm/)).toBeInTheDocument();
  });

  it('suppression d’une mesure : retirée de la liste, suppression logique en base', async () => {
    await (await measures()).save(D(1), 'waist', 84);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer la mesure du/ }));
    await waitFor(() => expect(screen.queryByText('84 cm')).toBeNull());
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM measurement')).toEqual([{ gone: 1 }]);
  });
});

describe('photos de progression', () => {
  it('la règle de confidentialité est dite en toutes lettres', async () => {
    mount();
    expect(await screen.findByText(/Les photos restent sur cet appareil .* jamais envoyées, ni synchronisées, ni exportées/)).toBeInTheDocument();
  });

  it('ajout : fichier copié sur l’appareil, fiche publiée, miniature affichée avec un texte alternatif', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une photo' }));
    const image = await screen.findByRole('img', { name: /Photo du 12 nov\. 2026/ });
    expect(image.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
    const list = await (await photos()).list();
    expect(list).toHaveLength(1);
    expect(await (await photos()).readFile(list[0]?.id ?? '')).toEqual(JPEG);
    expect(await db.driver.select("SELECT DISTINCT table_name FROM sync_outbox WHERE table_name LIKE 'progress_photo%'")).toEqual([{ table_name: 'progress_photo' }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('choix annulé : rien n’est ajouté ; image refusée ou illisible : alerte, rien n’est écrit', async () => {
    const view = mount('ios', () => Promise.resolve(null));
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une photo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter une photo' })).toBeEnabled());
    expect(await (await photos()).list()).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
    view.unmount();
    mount('ios', () => Promise.reject(new Error('illisible')));
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une photo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/impossible à enregistrer/);
    expect(await (await photos()).list()).toEqual([]);
  });

  it('fiche reçue de l’autre appareil : dite sans image, jamais une image cassée', async () => {
    await db.driver.execute(
      "INSERT INTO progress_photo (id, date, file_name, created_at, updated_at, device_id, hlc) VALUES ('7d3c2e4f-0000-4000-8000-000000000009', '2026-11-05', '7d3c2e4f-0000-4000-8000-000000000009.jpg', ?, ?, 'autre', ?)",
      [NOW, NOW, `${String(Date.UTC(2026, 10, 5)).padStart(15, '0')}-0000-autre`],
    );
    mount();
    expect(await screen.findByText(/Photo prise sur un autre appareil/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('côte à côte : deux photos cochées s’affichent avec leur date ; une troisième est refusée', async () => {
    const repo = await photos();
    await repo.add(D(1), JPEG);
    await repo.add(D(8), JPEG);
    await repo.add(D(10), JPEG);
    mount();
    const boxes = await screen.findAllByRole('checkbox', { name: /Comparer la photo du/ });
    expect(boxes).toHaveLength(3);
    expect(screen.getByText('Coche deux photos pour les voir côte à côte.')).toBeInTheDocument();
    fireEvent.click(boxes[0] as HTMLElement);
    fireEvent.click(boxes[2] as HTMLElement);
    const compare = await screen.findByRole('region', { name: 'Côte à côte' });
    await waitFor(() => expect(within(compare).getAllByRole('img')).toHaveLength(2));
    expect(within(compare).getByText("1er nov. 2026")).toBeInTheDocument();
    expect(within(compare).getByText('10 nov. 2026')).toBeInTheDocument();
    expect(boxes[1]).toBeDisabled();
    expect(screen.getByText(/Deux photos au plus/)).toBeInTheDocument();
  });

  it('suppression en deux temps : le coût est annoncé, la confirmation efface le fichier ET la fiche', async () => {
    const added = await (await photos()).add(D(1), JPEG);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer la photo du/ }));
    expect(screen.getByText(/sans retour possible/)).toBeInTheDocument();
    expect(await (await photos()).list()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la suppression/ }));
    await waitFor(async () => expect(await (await photos()).list()).toEqual([]));
    expect(await (await photos()).readFile(added.id)).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM progress_photo_file')).toEqual([]);
    expect(await screen.findByText('Aucune photo.')).toBeInTheDocument();
  });

  it('annuler la suppression garde la photo', async () => {
    await (await photos()).add(D(1), JPEG);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer la photo du/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(await (await photos()).list()).toHaveLength(1);
    expect(screen.queryByText(/sans retour possible/)).toBeNull();
  });
});
