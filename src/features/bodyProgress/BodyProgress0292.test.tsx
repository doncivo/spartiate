import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { PC_MEDIA_QUERY } from '../../ui/useLayout';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { createFakePrivacyShield } from '../../platform/privacyShield';
import { BodyProgress } from './BodyProgress';

/** C-105 : Corps : « Taille » ambigu, pastilles au clavier, valeur gardée au changement de zone, date figée au montage. */
const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
let db: TestDb;
const viewport = (pc: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: pc && query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
};
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, privacyShield: createFakePrivacyShield() })}>
      <BodyProgress pickPhoto={() => Promise.resolve(null)} />
    </AppContainerProvider>,
  );
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('C-105', () => {
  it('le tour de taille s’appelle « Tour de taille », la hauteur « Hauteur » (jamais deux « Taille »)', async () => {
    viewport(false);
    const repo = await db.data.repos.measurements();
    await repo.save('2026-11-09' as never, 'health_height_cm', 178);
    await repo.save('2026-11-09' as never, 'health_fiber_g', 28);
    mount();
    const group = await screen.findByRole('radiogroup', { name: 'Zone' });
    expect(within(group).getByRole('radio', { name: 'Tour de taille' })).toBeInTheDocument();
    expect(within(group).queryByRole('radio', { name: 'Taille' })).toBeNull();
    expect(await screen.findByText('Hauteur')).toBeInTheDocument();
    // Les fibres sont un apport (Nutrition), pas une mesure du corps : absentes de la carte « Importé de Santé (Renpho) ».
    expect(screen.queryByText('Fibres')).toBeNull();
  });

  it('pastilles : une seule tabulable, les flèches changent de zone et déplacent le focus', async () => {
    viewport(false);
    mount();
    const group = await screen.findByRole('radiogroup', { name: 'Zone' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    const waist = within(group).getByRole('radio', { name: 'Tour de taille' });
    waist.focus();
    fireEvent.keyDown(waist, { key: 'ArrowRight' });
    const next = within(group).getByRole('radio', { name: 'Hanches' });
    expect(next).toBeChecked();
    expect(document.activeElement).toBe(next);
  });

  it('valeur saisie : effacée au changement de zone (jamais enregistrée sur une autre zone)', async () => {
    viewport(true);
    mount();
    const field = await screen.findByLabelText('Mesure (cm)');
    fireEvent.change(field, { target: { value: '86,5' } });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect((screen.getByLabelText('Mesure (cm)') as HTMLInputElement).value).toBe('');
  });

  it('date de saisie : suit le jour courant tant qu’Ali ne l’a pas choisie', async () => {
    viewport(false);
    mount();
    const input = await screen.findByLabelText('Date');
    expect((input as HTMLInputElement).value).toBe('2026-11-12');
    act(() => db.clock.advance(24 * 3_600_000));
    fireEvent.click(screen.getByRole('radio', { name: 'Hanches' }));
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-11-13');
  });
});
