import { render } from '@testing-library/react';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import type { TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import type { ReactElement } from 'react';

/** SUIVIS-029 : montage commun des tests des suivis (base de test réelle, horloge figée, plateforme choisie). Valeurs synthétiques seulement. */
export const DEVICE = '60000000-0000-4000-8000-0000000000f9' as DeviceId;
export const NOW = '2026-11-21T09:00:00.000Z';
export const TODAY = '2026-11-21';

export function mountWith(db: TestDb, ui: ReactElement, os: 'ios' | 'other' = 'ios') {
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } })}>{ui}</AppContainerProvider>,
  );
}

/** Totaux de pas par jour tels que l'import de `pas.csv` les écrit (midi UTC), et l'état d'import du type `pas`. */
export async function seedSteps(db: TestDb, days: readonly (readonly [string, number])[], recordState = true): Promise<void> {
  const samples = await db.data.repos.recoverySamples();
  if (days.length > 0) {
    await samples.upsertTotals(
      days.map(([day, value]) => ({ type: 'pas' as const, startAt: `${day}T12:00:00.000Z`, endAt: `${day}T12:00:00.000Z`, value, stage: null, source: 'pas.csv' })),
      '2026-11-21T08:00:00.000Z',
    );
  }
  if (recordState) await samples.recordImport({ type: 'pas', importedAt: '2026-11-21T08:00:00.000Z', newestSampleAt: null, added: days.length, duplicates: 0, rejected: 0 });
}
