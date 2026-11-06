// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { TodayScreen } from '../app/TodayScreen';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { BodyScreen } from '../settings/BodyScreen';
import { applyRemoteChanges, onSyncedDataApplied } from './remoteChanges';
import { startSyncIntegration, type SyncIntegration } from './startSync';
import { createFakeSyncService, type FakeSyncService } from './testKit';

/**
 * 0.1.4 (2) : quand la synchro applique un lot reçu, les écrans ouverts (Profil et poids, Aujourd'hui) relisent leurs données sans changer
 * d'onglet. Un événement « données synchronisées appliquées » porte les tables touchées.
 */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000b3');
const change = (...tables: string[]) => ({ tables: new Set(tables), ids: new Map<string, ReadonlySet<string>>() });
let db: TestDb;
let container: AppContainer;

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-06T08:00:00.000Z');
  container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const wrap = (node: React.ReactElement) => render(<AppContainerProvider container={container}>{node}</AppContainerProvider>);

describe('événement « données synchronisées appliquées »', () => {
  it('applyRemoteChanges le diffuse avec les tables touchées ; un abonné qui lève n’empêche pas les autres', async () => {
    const seen: string[][] = [];
    const stopBad = onSyncedDataApplied(() => {
      throw new Error('abonné défaillant');
    });
    const stop = onSyncedDataApplied((tables) => seen.push([...tables].sort()));
    const result = await applyRemoteChanges(container, change('body_weight', 'profile'));
    expect(seen).toEqual([['body_weight', 'profile']]);
    expect(result.failed).toEqual(['listener']);
    stop();
    stopBad();
    await applyRemoteChanges(container, change('profile'));
    expect(seen).toHaveLength(1);
  });

  it('un lot reçu par le service de synchro est diffusé (startSync → applyRemoteChanges)', async () => {
    const sync: FakeSyncService = createFakeSyncService();
    const withSync = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, sync });
    const seen: string[][] = [];
    const stop = onSyncedDataApplied((tables) => seen.push([...tables]));
    const integration: SyncIntegration = startSyncIntegration(withSync, { document: { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as Document, setInterval: () => 0, clearInterval: () => undefined });
    await integration.refreshed();
    act(() => sync.emitChanges(change('body_weight')));
    await integration.reloaded();
    expect(seen).toEqual([['body_weight']]);
    stop();
    integration.dispose();
  });
});

describe('écrans ouverts relus après un lot reçu', () => {
  it('Profil et poids : une pesée arrivée par la synchro apparaît sans changer d’onglet', async () => {
    wrap(<BodyScreen />);
    await screen.findByLabelText('Poids (kg)');
    expect(screen.queryByText(/106,25/)).toBeNull();
    const weights = await db.data.repos.bodyWeights();
    await weights.saveManual({ date: '2026-11-05' as never, kg: 106.25, timezone: 'Europe/Paris' }, '2026-11-06' as never);
    await act(async () => void (await applyRemoteChanges(container, change('body_weight'))));
    expect((await screen.findAllByText(/106,25/)).length).toBeGreaterThan(0);
  });

  it('Profil et poids : le profil reçu remplit les champs non modifiés, jamais ceux que tu es en train de saisir', async () => {
    wrap(<BodyScreen />);
    await screen.findByLabelText('Année de naissance');
    const height = screen.getByLabelText('Taille (cm)') as HTMLInputElement;
    const profile = await db.data.repos.profile();
    await profile.save({ birthYear: 1990, heightCm: 186 }, 2026);
    await act(async () => void (await applyRemoteChanges(container, change('profile'))));
    await screen.findByDisplayValue('1990');
    expect(height.value).toBe('186');
    // Saisie en cours sur la taille : un second lot ne l'écrase pas ; l'année, non touchée, suit.
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(height, { target: { value: '19' } });
    await profile.save({ birthYear: 1991, heightCm: 187 }, 2026);
    await act(async () => void (await applyRemoteChanges(container, change('profile'))));
    await screen.findByDisplayValue('1991');
    expect(height.value).toBe('19');
  });

  it('Aujourd’hui : la pesée reçue remplace l’ancienne sans rouvrir l’écran', async () => {
    const weights = await db.data.repos.bodyWeights();
    await weights.saveManual({ date: '2026-11-04' as never, kg: 100, timezone: 'Europe/Paris' }, '2026-11-06' as never);
    wrap(<TodayScreen />);
    await screen.findByText(/100/);
    await weights.saveManual({ date: '2026-11-05' as never, kg: 106.25, timezone: 'Europe/Paris' }, '2026-11-06' as never);
    await act(async () => void (await applyRemoteChanges(container, change('body_weight'))));
    expect((await screen.findAllByText(/106,25/)).length).toBeGreaterThan(0);
  });

  it('un lot qui ne touche aucune table affichée ne relit rien', async () => {
    const spy = vi.spyOn(await db.data.repos.bodyWeights(), 'listRecent');
    wrap(<BodyScreen />);
    await screen.findByLabelText('Poids (kg)');
    const before = spy.mock.calls.length;
    await act(async () => void (await applyRemoteChanges(container, change('autre_table'))));
    expect(spy.mock.calls.length).toBe(before);
  });
});
