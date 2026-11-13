import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { CardioView } from './CardioView';

/**
 * I6-06 (D-221, D-223, D-224) : Entraînement › Cardio — saisie (type, début, durée, distance et FC facultatives, ressenti, notes), refus d'un champ
 * fautif sans rien écrire, historique (modifier, supprimer avec confirmation). Fixtures synthétiques ; aucune requête réseau.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000ca' as DeviceId;
const NOW = '2026-11-13T18:00:00.000Z';
const TZ = 'Europe/Paris';
let db: TestDb;

const mount = (os: 'ios' | 'other' = 'other') =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } })}>
      <CardioView timeZone={TZ} />
    </AppContainerProvider>,
  );
const repo = async () => db.data.repos.cardio();
const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('aucune requête réseau attendue'))));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('Entraînement › Cardio : saisie', () => {
  it('formulaire complet, historique vide dit en texte, début proposé : aujourd’hui à l’heure locale (24 h)', async () => {
    mount();
    expect(await screen.findByText('Aucune séance de cardio pour l’instant.')).toBeInTheDocument();
    for (const label of ['Type', 'Date', 'Heure de début', 'Durée (min ou h:mm:ss)', 'Distance (km, facultative)', 'FC moyenne (bpm, facultative)', 'Ressenti (1 à 10)', 'Notes']) expect(field(label)).toBeInTheDocument();
    expect((field('Date') as HTMLInputElement).value).toBe('2026-11-13');
    expect((field('Heure de début') as HTMLInputElement).value).toBe('19:00');
    const kinds = within(field('Type')).getAllByRole('option').map((o) => o.textContent);
    expect(kinds).toEqual(['Marche', 'Course', 'Vélo', 'Rameur', 'Elliptique', 'SkiErg', 'Autre']);
  });

  it('séance saisie : enregistrée (début en UTC, km → m), listée avec durée, distance, ressenti, FC et allure', async () => {
    mount();
    await screen.findByText('Aucune séance de cardio pour l’instant.');
    type('Type', 'run');
    type('Heure de début', '18:15');
    type('Durée (min ou h:mm:ss)', '45');
    type('Distance (km, facultative)', '7,5');
    type('FC moyenne (bpm, facultative)', '150');
    type('Ressenti (1 à 10)', '7');
    type('Notes', 'Footing au parc');
    save();
    expect(await screen.findByRole('status')).toHaveTextContent('Séance enregistrée.');
    const list = await repo().then((r) => r.list());
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'run', startedAt: '2026-11-13T17:15:00.000Z', durationSec: 2700, distanceM: 7500, avgHr: 150, rpe: 7, notes: 'Footing au parc', source: 'manual' });
    expect(await screen.findByText('13 nov. 2026 à 18:15 · Course')).toBeInTheDocument();
    expect(screen.getByText('45 min · 7,5 km · ressenti 7/10')).toBeInTheDocument();
    expect(screen.getByText('FC moyenne 150 bpm · allure 6:00 /km')).toBeInTheDocument();
    expect((field('Durée (min ou h:mm:ss)') as HTMLInputElement).value).toBe('');
  });

  it('sans distance ni FC : admis, « ressenti » seul ; durée h:mm:ss', async () => {
    mount();
    await screen.findByText('Aucune séance de cardio pour l’instant.');
    type('Type', 'row');
    type('Durée (min ou h:mm:ss)', '1:05:00');
    type('Ressenti (1 à 10)', '5');
    save();
    expect(await screen.findByText('1 h 05 min · ressenti 5/10')).toBeInTheDocument();
    expect((await (await repo()).list())[0]).toMatchObject({ kind: 'row', durationSec: 3900, distanceM: null, avgHr: null });
  });

  it.each<[Partial<Record<'duration' | 'distance' | 'hr' | 'rpe' | 'time', string>>, string]>([
    [{ duration: '' }, 'Indique la durée.'],
    [{ duration: 'abc' }, 'Durée illisible : écris des minutes (45) ou h:mm:ss (1:05:00).'],
    [{ duration: '0' }, 'La durée doit être comprise entre 1 seconde et 24 heures.'],
    [{ distance: '5,2,1' }, 'Distance illisible : écris des kilomètres (5,2).'],
    [{ distance: '2000' }, 'La distance doit être comprise entre 1 m et 1 000 km.'],
    [{ hr: '14,5' }, 'FC moyenne illisible : écris un nombre entier.'],
    [{ hr: '300' }, 'La FC moyenne doit être comprise entre 30 et 250 bpm.'],
    [{ rpe: '' }, 'Choisis un ressenti de 1 à 10.'],
    [{ time: '25:99' }, 'Date ou heure de début illisible.'],
    [{ time: '20:00' }, 'La séance ne peut pas commencer dans le futur.'],
  ])('champ fautif %o : « %s », rien d’écrit', async (over, text) => {
    mount();
    await screen.findByText('Aucune séance de cardio pour l’instant.');
    type('Durée (min ou h:mm:ss)', over.duration ?? '30');
    type('Distance (km, facultative)', over.distance ?? '');
    type('FC moyenne (bpm, facultative)', over.hr ?? '');
    type('Ressenti (1 à 10)', over.rpe ?? '6');
    if (over.time !== undefined) type('Heure de début', over.time);
    save();
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(await (await repo()).list()).toEqual([]);
  });
});

describe('Entraînement › Cardio : historique', () => {
  const seed = async () => {
    await (await repo()).add({ kind: 'bike', startedAt: '2026-11-12T07:00:00.000Z', durationSec: 3600, distanceM: 30000, avgHr: null, rpe: 6, notes: '', source: 'manual' });
  };

  it('modifier : formulaire rempli, champs changés publiés, liste à jour', async () => {
    await seed();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la séance du 12 nov. 2026' }));
    expect(screen.getByRole('heading', { name: 'Modifier la séance' })).toBeInTheDocument();
    expect((field('Durée (min ou h:mm:ss)') as HTMLInputElement).value).toBe('1:00:00');
    expect((field('Distance (km, facultative)') as HTMLInputElement).value).toBe('30');
    expect((field('Heure de début') as HTMLInputElement).value).toBe('08:00');
    type('Ressenti (1 à 10)', '8');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Séance modifiée.');
    await waitFor(async () => expect((await (await repo()).list())[0]?.rpe).toBe(8));
    expect((await (await repo()).list())[0]).toMatchObject({ startedAt: '2026-11-12T07:00:00.000Z', durationSec: 3600, distanceM: 30000 });
    expect(await screen.findByText('1 h 00 min · 30 km · ressenti 8/10')).toBeInTheDocument();
  });

  it('supprimer : confirmation demandée ; « Annuler » ne touche à rien ; « Supprimer » retire la séance', async () => {
    await seed();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la séance du 12 nov. 2026' }));
    expect(await screen.findByText('La séance du 12 nov. 2026 sera supprimée sur tous tes appareils.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(await (await repo()).list()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la séance du 12 nov. 2026' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Aucune séance de cardio pour l’instant.')).toBeInTheDocument();
    expect(await (await repo()).list()).toEqual([]);
  });
});
