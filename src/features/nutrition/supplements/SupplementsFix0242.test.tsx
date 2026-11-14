import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { planSupplementNotifications } from '../../../domain/supplementNotificationPlan';
import type { DeviceId, LocalDate, LocalDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { formatSupplementDose } from '../../../i18n/supplementsText';
import { SupplementsView } from './SupplementsView';

/**
 * FIX-0242 : masque des jours d'un complément de la saisie au rappel (vendredi compris), et unité « g » jamais affichée « G » (majuscule automatique du
 * clavier de l'iPhone). Fixtures synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
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

describe('FIX-0242 : compléments', () => {
  it('vendredi seul coché, unité tapée « G » : enregistré 16 et « g », listé « 1 g · 08:00 · ven. », rappel du vendredi seulement', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un complément' }));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Créatine' } });
    fireEvent.change(screen.getByLabelText('Dose'), { target: { value: '1' } });
    const unit = screen.getByLabelText('Unité');
    expect(unit).toHaveAttribute('autocapitalize', 'none');
    fireEvent.change(unit, { target: { value: 'G' } });
    for (const day of ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Samedi', 'Dimanche']) fireEvent.click(screen.getByRole('checkbox', { name: day }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const row = await screen.findByRole('listitem', { name: 'Créatine' });
    expect(within(row).getByText('1 g · 08:00 · ven.')).toBeInTheDocument();
    const supplements = await (await db.data.repos.supplements()).list();
    expect(supplements[0]).toMatchObject({ unit: 'g', days: 16 });
    // Jeudi 19/11 à 07:00 : sur 3 jours (jeudi, vendredi, samedi), un seul rappel, le vendredi 20/11 à 08:00.
    const plan = planSupplementNotifications({ now: '2026-11-19T07:00' as LocalDateTime, enabled: true, supplements, intakes: [] });
    expect(plan.items.map((i) => i.fireAt)).toEqual(['2026-11-20T08:00']);
  });

  it('unité déjà enregistrée en « G » ou « MG » (avant FIX-0242) : affichée « 1 g », « 300 mg »', () => {
    expect(formatSupplementDose(1, 'G')).toBe('1 g');
    expect(formatSupplementDose(300, 'MG')).toBe('300 mg');
    expect(formatSupplementDose(2, 'gélules')).toBe('2 gélules');
  });
});
