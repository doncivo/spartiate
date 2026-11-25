import { renderHook, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { useProfileSummaryDetail } from './ProfileCard';

const DEVICE = '60000000-0000-4000-8000-0000000000e6' as DeviceId;

/** SHELL-0294c (BL-143) : le poids du sommaire PC vient d'une valeur structurée, jamais d'une recherche de « kg » dans un texte formaté. */
describe('résumé du profil : poids structuré', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-04T08:00:00.000Z');
  });
  afterEach(() => db.close());

  it('expose le texte du poids à part du reste', async () => {
    await (await db.data.repos.profile()).save({ heightCm: 178, goal: 'gain' }, 2026);
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-04' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-04' as LocalDate);
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    const { result } = renderHook(() => useProfileSummaryDetail(), { wrapper: ({ children }) => <AppContainerProvider container={container}>{children}</AppContainerProvider> });
    await waitFor(() => expect(result.current.weight).not.toBeNull());
    expect(result.current.weight).toContain('82,4');
    expect(result.current.parts).toHaveLength(3);
  });

  it('SettingsScreenPc ne cherche plus « kg » dans un texte', () => {
    expect(readFileSync(join(import.meta.dirname, 'SettingsScreenPc.tsx'), 'utf8')).not.toContain("includes(' kg')");
  });
});
