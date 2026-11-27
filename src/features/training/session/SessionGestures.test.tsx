import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import { tTraining } from '../../../i18n/trainingText';
import { createFakeHaptics, type FakeHaptics } from '../../../platform/haptics';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { UndoToast } from '../../app/UndoToast';
import { TrainingScreen } from '../TrainingScreen';
import { warmTraining } from '../warmTraining';

/**
 * GEST-0303 (BL-169, D-653, § 18.1, § 18.6) : deux gestes iPhone dans l'écran de séance, et rien d'autre.
 * 1. Glisser une série vers la gauche (doigt) au-delà du seuil la supprime, avec « Annuler » (la série revient intacte) ; en deçà, retour élastique ;
 *    jamais par un défilement vertical, ni à la souris, ni pendant la pause.
 * 2. Appui long sur un exercice : mode réordonner, glisser vers le haut ou le bas, ordre écrit en base, retour haptique ; « Monter » / « Descendre »
 *    en alternative accessible (VoiceOver, clavier du PC).
 * Pointeurs simulés (jsdom), base SQLite réelle, valeurs inventées.
 */
const DEVICE = '60000000-0000-4000-8000-0000000003d4' as DeviceId;
const u = (n: number): string => `3d4b0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';
const CURL = 'Curl à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: ROW, sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
        { id: u(5), exerciseId: 'curl-barbell', exerciseName: CURL, sets: 1, repMin: 8, repMax: 12, rir: null, restSec: 60, position: 2 },
      ],
    },
  ],
};
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => ({ ended: true, count: 1 }) };

let db: TestDb;
let haptics: FakeHaptics;

beforeAll(async () => {
  const warm = await openBaseDb(DEVICE, '2026-11-27T17:00:00.000Z');
  try {
    await warmTraining(warm);
    await import('./sessionGestures');
  } finally {
    await warm.close();
  }
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-27T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
  haptics = createFakeHaptics();
});
afterEach(async () => {
  vi.useRealTimers();
  cleanup();
  await db.close();
});

async function openAndStart(os: 'ios' | 'other' = 'ios'): Promise<void> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, haptics });
  render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os, notifier, liveActivity }} />
      <UndoToast />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('region', { name: BENCH });
  if (os === 'ios') await waitFor(() => expect(document.querySelector('.ct-session__active')).toHaveAttribute('data-gestures', 'on'));
}

const benchSets = (): HTMLElement[] => within(screen.getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ });
const second = (): HTMLElement => {
  const row = benchSets()[1];
  if (!row) throw new Error('deuxième série absente');
  return row;
};
type PointerKind = 'touch' | 'mouse';
const pointer = (el: Element, type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel', x: number, y: number, kind: PointerKind = 'touch'): void => {
  fireEvent[type](el, { pointerId: 7, pointerType: kind, isPrimary: true, button: 0, clientX: x, clientY: y });
};
/** Glisser d'un doigt de (300, 50) vers (300 + dx, 50 + dy), en trois étapes, puis relâcher. */
const swipe = (el: Element, dx: number, dy: number, kind: PointerKind = 'touch'): void => {
  pointer(el, 'pointerDown', 300, 50, kind);
  pointer(el, 'pointerMove', 300 + dx / 3, 50 + dy / 3, kind);
  pointer(el, 'pointerMove', 300 + (2 * dx) / 3, 50 + (2 * dy) / 3, kind);
  pointer(el, 'pointerMove', 300 + dx, 50 + dy, kind);
  pointer(el, 'pointerUp', 300 + dx, 50 + dy, kind);
};
const liveSetIds = async (): Promise<string[]> =>
  (await db.driver.select<{ id: string }>('SELECT id FROM workout_set WHERE deleted_at IS NULL ORDER BY position')).map((r) => r.id);
const order = async (): Promise<string[]> =>
  [...new Set((await db.driver.select<{ exercise_id: string }>('SELECT exercise_id FROM workout_set WHERE deleted_at IS NULL ORDER BY position')).map((r) => r.exercise_id))];

describe('GEST-0303 : glisser une série vers la gauche', () => {
  it('au-delà du seuil : la série est supprimée, « Annuler » la rend intacte (saisie en cours comprise) à sa place', async () => {
    await openAndStart();
    const before = await liveSetIds();
    const row = second();
    fireEvent.change(within(row).getByLabelText(tTraining('sessionLoad')), { target: { value: '82,5' } });
    fireEvent.change(within(row).getByLabelText(tTraining('sessionReps')), { target: { value: '7' } });
    swipe(row, -150, 4);
    await waitFor(() => expect(benchSets()).toHaveLength(2));
    const removedId = before[1] ?? '';
    expect(await liveSetIds()).not.toContain(removedId);
    const toast = await screen.findByText(`« ${tSession('swipeSetTitle', { name: BENCH, n: 2 })} » supprimée`);
    fireEvent.click(within(toast.closest('.ct-undo-host') ?? document.body).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(benchSets()).toHaveLength(3));
    expect(await liveSetIds()).toEqual(before);
    const [restored] = await db.driver.select<{ load_kg: number | null; reps: number | null; done: number }>('SELECT load_kg, reps, done FROM workout_set WHERE id = ?', [removedId]);
    expect(restored).toEqual({ load_kg: 82.5, reps: 7, done: 0 });
    expect(within(second()).getByLabelText(tTraining('sessionLoad'))).toHaveValue('82,5');
    expect(await db.driver.select("SELECT table_name FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });

  it('en deçà du seuil : retour élastique, rien n’est supprimé', async () => {
    await openAndStart();
    const before = await liveSetIds();
    const row = second();
    pointer(row, 'pointerDown', 300, 50);
    pointer(row, 'pointerMove', 240, 52);
    expect(row.style.transform).toBe('translateX(-60px)');
    pointer(row, 'pointerUp', 240, 52);
    expect(row.style.transform).toBe('');
    expect(row).toHaveClass('ct-session__set--returning');
    expect(benchSets()).toHaveLength(3);
    expect(await liveSetIds()).toEqual(before);
  });

  it('défilement vertical (même s’il finit vers la gauche), souris, série validée : jamais de suppression', async () => {
    await openAndStart();
    const before = await liveSetIds();
    // Défilement : le doigt part vers le bas (axe vertical choisi), puis glisse loin vers la gauche.
    const row = second();
    pointer(row, 'pointerDown', 300, 50);
    pointer(row, 'pointerMove', 298, 80);
    pointer(row, 'pointerMove', 60, 90);
    expect(row.style.transform).toBe('');
    pointer(row, 'pointerUp', 60, 90);
    expect(benchSets()).toHaveLength(3);
    swipe(second(), -200, 0, 'mouse');
    const [first] = benchSets();
    if (!first) throw new Error('première série absente');
    fireEvent.change(within(first).getByLabelText(tTraining('sessionLoad')), { target: { value: '80' } });
    fireEvent.change(within(first).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: tTraining('sessionValidate') }));
    await screen.findByText(tTraining('sessionSummary', { done: 1, planned: 6 }));
    swipe(benchSets()[0] as HTMLElement, -200, 0);
    expect(benchSets()).toHaveLength(3);
    expect(await liveSetIds()).toEqual(before);
  });

  it('pendant la pause : le geste ne supprime rien', async () => {
    await openAndStart();
    const before = await liveSetIds();
    fireEvent.click(screen.getByRole('button', { name: tSession('pause') }));
    await screen.findByText(tSession('paused'));
    swipe(second(), -200, 0);
    expect(second().style.transform).toBe('');
    expect(benchSets()).toHaveLength(3);
    expect(await liveSetIds()).toEqual(before);
  });

  it('le bouton de suppression reste (le geste n’est qu’un raccourci)', async () => {
    await openAndStart('other');
    expect(document.querySelector('.ct-session__active')).not.toHaveAttribute('data-gestures');
    fireEvent.click(within(second()).getByRole('button', { name: tTraining('sessionRemoveSet') }));
    await waitFor(() => expect(benchSets()).toHaveLength(2));
  });
});

/** Boîtes verticales simulées (jsdom ne met rien en page) : un exercice par tranche de 100 px, dans l'ordre affiché. */
function layout(): void {
  for (const [index, name] of [BENCH, ROW, CURL].entries()) {
    const region = screen.getByRole('region', { name });
    vi.spyOn(region, 'getBoundingClientRect').mockReturnValue({ top: index * 100, bottom: index * 100 + 100, left: 0, right: 400, width: 400, height: 100, x: 0, y: index * 100, toJSON: () => ({}) } as DOMRect);
  }
}
const handle = (name: string): Element => {
  const el = screen.getByRole('heading', { level: 3, name });
  return el;
};
const hold = (el: Element, y: number, ms = 500): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  pointer(el, 'pointerDown', 100, y);
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  vi.useRealTimers();
};

describe('GEST-0303 : appui long sur un exercice', () => {
  it('appui long puis glisser vers le haut : mode réordonner annoncé, retour haptique, nouvel ordre écrit en base', async () => {
    await openAndStart();
    layout();
    const curl = handle(CURL);
    hold(curl, 250);
    expect(screen.getByText(tSession('reorderLifted', { name: CURL }))).toBeInTheDocument();
    expect(screen.getByRole('region', { name: CURL })).toHaveClass('ct-session__block--lifted');
    expect(haptics.calls).toContainEqual({ type: 'impact', style: 'medium' });
    pointer(curl, 'pointerMove', 100, 150);
    pointer(curl, 'pointerMove', 100, 30);
    pointer(curl, 'pointerUp', 100, 30);
    await screen.findByText(tSession('reorderDone', { name: CURL, n: 1, total: 3 }));
    expect(await order()).toEqual(['curl-barbell', 'bench-press-barbell', 'row-barbell']);
    expect(screen.getByRole('region', { name: CURL })).not.toHaveClass('ct-session__block--lifted');
  });

  it('le doigt bouge avant l’appui long (défilement), ou se lève trop tôt : rien ne bouge', async () => {
    await openAndStart();
    layout();
    const curl = handle(CURL);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    pointer(curl, 'pointerDown', 100, 250);
    pointer(curl, 'pointerMove', 100, 210);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    pointer(curl, 'pointerUp', 100, 30);
    pointer(curl, 'pointerDown', 100, 250);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    pointer(curl, 'pointerUp', 100, 250);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();
    expect(screen.queryByText(tSession('reorderLifted', { name: CURL }))).toBeNull();
    expect(haptics.calls.filter((c) => c.type === 'impact')).toEqual([]);
    expect(await order()).toEqual(['bench-press-barbell', 'row-barbell', 'curl-barbell']);
  });

  it('relâché à sa place ou geste annulé par le système : mode réordonner quitté, rien n’est écrit', async () => {
    await openAndStart();
    layout();
    const row = handle(ROW);
    hold(row, 150);
    pointer(row, 'pointerMove', 100, 160);
    pointer(row, 'pointerUp', 100, 160);
    expect(screen.queryByText(tSession('reorderLifted', { name: ROW }))).toBeNull();
    hold(row, 150);
    pointer(row, 'pointerCancel', 100, 20);
    expect(screen.getByRole('region', { name: ROW })).not.toHaveClass('ct-session__block--lifted');
    expect(await order()).toEqual(['bench-press-barbell', 'row-barbell', 'curl-barbell']);
  });

  it('pendant la pause : l’appui long ne soulève rien', async () => {
    await openAndStart();
    fireEvent.click(screen.getByRole('button', { name: tSession('pause') }));
    await screen.findByText(tSession('paused'));
    layout();
    const curl = handle(CURL);
    hold(curl, 250);
    pointer(curl, 'pointerMove', 100, 30);
    pointer(curl, 'pointerUp', 100, 30);
    expect(screen.queryByText(tSession('reorderLifted', { name: CURL }))).toBeNull();
    expect(await order()).toEqual(['bench-press-barbell', 'row-barbell', 'curl-barbell']);
  });

  it('alternative accessible (PC, VoiceOver) : « Monter » / « Descendre » nommés, bornés, ordre écrit et annoncé, focus gardé', async () => {
    await openAndStart('other');
    const up = screen.getByRole('button', { name: tSession('moveUpLabel', { name: BENCH }) });
    expect(up).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: tSession('moveDownLabel', { name: CURL }) })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(up);
    expect(await order()).toEqual(['bench-press-barbell', 'row-barbell', 'curl-barbell']);
    fireEvent.click(screen.getByRole('button', { name: tSession('moveDownLabel', { name: BENCH }) }));
    await screen.findByText(tSession('reorderDone', { name: BENCH, n: 2, total: 3 }));
    expect(await order()).toEqual(['row-barbell', 'bench-press-barbell', 'curl-barbell']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: tSession('moveDownLabel', { name: BENCH }) })));
    fireEvent.click(screen.getByRole('button', { name: tSession('moveUpLabel', { name: CURL }) }));
    await screen.findByText(tSession('reorderDone', { name: CURL, n: 2, total: 3 }));
    expect(await order()).toEqual(['row-barbell', 'curl-barbell', 'bench-press-barbell']);
  });

  it('« Monter » / « Descendre » suspendus pendant la pause', async () => {
    await openAndStart('other');
    fireEvent.click(screen.getByRole('button', { name: tSession('pause') }));
    await screen.findByText(tSession('paused'));
    expect(screen.getByRole('button', { name: tSession('moveDownLabel', { name: BENCH }) })).toBeDisabled();
  });
});
