import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { reviewWeekLabel, tWeeklyReview } from '../../i18n/weeklyReviewText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { shareReviewText } from './reviewExport';
import { WeeklyReview } from './WeeklyReview';

/** BILAN-029 : Progrès › Bilan de la semaine (C-4, C-5, C-6). Base de test, valeurs synthétiques. */

const DEVICE = '60000000-0000-4000-8000-0000000000b9' as DeviceId;
const NOW = '2026-11-18T18:00:00.000Z';
const u = (n: number): string => `b11a0290-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: TestDb;
let next = 100;

const mount = (props: Parameters<typeof WeeklyReview>[0] = {}) =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <WeeklyReview {...props} />
    </AppContainerProvider>,
  );

async function sessionAt(at: string, loadKg = 60): Promise<void> {
  db.clock.set(at);
  const r = await db.data.repos.workouts();
  const id = u((next += 1));
  await r.start({ source: 'empty', id, name: 'Séance' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 1 });
  await r.validateSet((w.sets[0] as { id: string }).id, { loadKg, reps: 8 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
}

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-10-01T08:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const region = () => screen.findByRole('region', { name: tWeeklyReview('title') });

describe('Progrès › Bilan de la semaine', () => {
  it('base vide : semaine passée affichée, chaque thème « pas assez de données », jamais 0', async () => {
    db.clock.set(NOW);
    mount();
    const card = await region();
    expect(await within(card).findByText(reviewWeekLabel('2026-11-09' as LocalDate, '2026-11-15' as LocalDate), { selector: 'h3' })).toBeInTheDocument();
    for (const key of ['insufficientSessions', 'insufficientRecords', 'insufficientVolume', 'insufficientWeight', 'insufficientNutrition'] as const) {
      expect(within(card).getByText(tWeeklyReview(key), { exact: false })).toBeInTheDocument();
    }
    expect(within(card).queryByText(/^0 /)).toBeNull();
  });

  it('séances de la semaine passée : phrase avec sa source lisible, record compté ; semaine en cours exclue', async () => {
    await sessionAt('2026-11-03T08:00:00.000Z', 60);
    await sessionAt('2026-11-10T08:00:00.000Z', 70);
    await sessionAt('2026-11-12T08:00:00.000Z', 72.5);
    await sessionAt('2026-11-17T08:00:00.000Z', 80);
    db.clock.set(NOW);
    mount();
    const card = await region();
    expect(await within(card).findByText('2 séances closes. · source : séances closes')).toBeInTheDocument();
    expect(within(card).getByText(/^4 records : Développé couché à la barre\. · source : records des séances closes$/)).toBeInTheDocument();
    expect(within(card).getByText(/source : séries de travail validées$/)).toBeInTheDocument();
  });

  it('semaines précédentes : 7 boutons ≥ 44 pt ; en choisir une l’affiche', async () => {
    await sessionAt('2026-11-03T08:00:00.000Z');
    db.clock.set(NOW);
    mount();
    const card = await region();
    const list = await within(card).findByRole('list', { name: tWeeklyReview('previousTitle') });
    const buttons = within(list).getAllByRole('button');
    expect(buttons).toHaveLength(7);
    for (const b of buttons) expect(b.className).toContain('ct-review__week');
    fireEvent.click(within(list).getByRole('button', { name: reviewWeekLabel('2026-11-02' as LocalDate, '2026-11-08' as LocalDate) }));
    expect(await within(card).findByText(reviewWeekLabel('2026-11-02' as LocalDate, '2026-11-08' as LocalDate), { selector: 'h3' })).toBeInTheDocument();
    expect(within(card).getByText('1 séance close. · source : séances closes')).toBeInTheDocument();
  });

  it('début de semaine au dimanche : semaine du 8 au 14', async () => {
    db.clock.set(NOW);
    mount({ firstWeekday: 'sunday' });
    const card = await region();
    expect(await within(card).findByText(reviewWeekLabel('2026-11-08' as LocalDate, '2026-11-14' as LocalDate), { selector: 'h3' })).toBeInTheDocument();
  });

  it('« Exporter » : fichier Markdown de la semaine affichée, statut dit', async () => {
    await sessionAt('2026-11-10T08:00:00.000Z');
    db.clock.set(NOW);
    const share = vi.fn(async () => 'downloaded' as const);
    mount({ share });
    const card = await region();
    await within(card).findByText('1 séance close. · source : séances closes');
    fireEvent.click(within(card).getByRole('button', { name: tWeeklyReview('export') }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [text, fileName] = share.mock.calls[0] as unknown as [string, string];
    expect(fileName).toBe('spartiate-bilan-2026-11-09.md');
    expect(text).toContain('- 1 séance close. · source : séances closes');
    expect(await within(card).findByText(tWeeklyReview('exportDownloaded'))).toBeInTheDocument();
  });

  it('échec de lecture : message et « Réessayer »', async () => {
    db.clock.set(NOW);
    const failing = { ...db.data, repos: { ...db.data.repos, workouts: () => Promise.reject(new Error('lecture')) } };
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: failing as typeof db.data, platform: { runtime: 'web', os: 'other' } })}>
        <WeeklyReview />
      </AppContainerProvider>,
    );
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(tWeeklyReview('loadFailed'))).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: tWeeklyReview('retry') })).toBeInTheDocument();
  });
});

describe('BILAN-029 : partage du fichier texte (C-6, sans réseau)', () => {
  it('feuille du système si elle accepte le fichier ; annulation ; sinon téléchargement', async () => {
    const share = vi.fn(async () => undefined);
    const download = vi.fn();
    expect(await shareReviewText('# bilan', 'b.md', { nav: { share, canShare: () => true }, download })).toBe('shared');
    expect(download).not.toHaveBeenCalled();
    const abort = vi.fn(async () => Promise.reject(new DOMException('annulé', 'AbortError')));
    expect(await shareReviewText('# bilan', 'b.md', { nav: { share: abort, canShare: () => true }, download })).toBe('cancelled');
    expect(await shareReviewText('# bilan', 'b.md', { nav: {}, download })).toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(1);
    const blob = (download.mock.calls[0] as unknown as [Blob, string])[0];
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(await blob.text()).toBe('# bilan');
  });
});
