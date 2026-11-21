import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tPlural } from '../../i18n/plural';
import { tTraining } from '../../i18n/trainingText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { TrainingScreen } from './TrainingScreen';

/** MOTEUR-0281c (§ 14.2, C-191) : bibliothèque filtrée par muscle et par pattern, combinés avec le groupe, la compatibilité et le texte. */
const DEVICE = '60000000-0000-4000-8000-0000000002c1' as DeviceId;
let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'library' } as Route));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
};
const count = (n: number): string => tPlural(tTraining, n, 'countOne', 'countMany');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-06T08:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('MOTEUR-0281c : filtres de la bibliothèque', () => {
  it('muscle (liste groupée par région) puis pattern, combinés avec la bascule « compatibles » et la recherche', async () => {
    open();
    const toggle = await screen.findByRole('switch', { name: tTraining('compatibleOnly') });
    fireEvent.click(toggle);
    const muscle = screen.getByLabelText(tTraining('muscleFilter'));
    expect(muscle.querySelector('optgroup[label="Jambes"]')).not.toBeNull();
    fireEvent.change(muscle, { target: { value: 'hamstrings' } });
    expect(screen.getByText(count(38))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Curl nordique' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(tTraining('patternFilter')), { target: { value: 'hinge' } });
    expect(screen.queryByRole('button', { name: 'Curl nordique' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Soulevé de terre roumain à la barre' })).toBeInTheDocument();
    expect(screen.getByText(count(18))).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(tTraining('groupFilter')), { target: { value: 'glutes' } });
    expect(screen.getByRole('button', { name: 'Hip thrust à la barre' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soulevé de terre roumain à la barre' })).toBeNull();
    fireEvent.change(screen.getByLabelText(tTraining('search')), { target: { value: 'hip thrust' } });
    expect(screen.getByText(count(3))).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(tTraining('muscleFilter')), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(tTraining('patternFilter')), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Hip thrust à la machine' })).toBeInTheDocument();
  });

  it('textes du filtre au catalogue de l’entraînement', () => {
    for (const key of ['muscleFilter', 'muscleAll', 'patternFilter', 'patternAll'] as const) expect(tTraining(key)).toMatch(/\S/);
  });
});
