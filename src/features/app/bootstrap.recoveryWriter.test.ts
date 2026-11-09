import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUnavailableFiles } from '../../platform';
import { openSqliteWasmDriver } from '../../db/drivers/sqliteWasm';
import type { RecoveryDayOutput } from '../../domain/recovery';
import type { LocalDate } from '../../domain/types';
import { bootstrapApp } from './bootstrap';

/**
 * I5-01 (§ 9.1, relecture sync-icloud) : câblage de « l'iPhone écrit, le PC lit ». Sans stockage fourni, `bootstrapApp` déclare l'appareil
 * écrivain des résumés de récupération sur l'iPhone seulement ; sur le PC (et tout autre système), l'écriture locale est écartée.
 */

const common = { desktop: null, files: createUnavailableFiles(), syncPlatform: null } as const;
const DAY = '2026-11-09' as LocalDate;
const output: RecoveryDayOutput = {
  summary: {
    day: DAY, level: 'B', recovery: null, abstainReason: 'baseline_incomplete', quality: 'insufficient', exertion: 0, exertionPrevDay: 0, sleepMinutes: 420, sleepNeedMinutes: 450,
    sleepScore: null, bedtimeSigmaMinutes: null, targetZone: null, hrvMs: null, restingHr: null, learningNights: 2, contributors: [], explanationKeys: [], computedAt: '2026-11-09T07:00:00.000Z',
  },
  muscles: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function saveOn(userAgent: string): Promise<{ saved: boolean; rows: number }> {
  vi.stubGlobal('navigator', { ...globalThis.navigator, userAgent });
  const db = await openSqliteWasmDriver();
  try {
    const container = await bootstrapApp({ ...common, open: () => Promise.resolve(db) });
    if (!container) throw new Error('démarrage');
    const saved = await (await container.data.repos.recovery()).saveDay(output);
    const rows = await db.select<{ n: number }>('SELECT COUNT(*) AS n FROM recovery_day');
    return { saved: saved !== null, rows: Number(rows[0]?.n) };
  } finally {
    await db.close();
  }
}

describe('bootstrapApp : l’iPhone écrit les résumés de récupération, le PC les lit', () => {
  it('iPhone : résumé écrit', async () => {
    expect(await saveOn('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toEqual({ saved: true, rows: 1 });
  });
  it('PC Windows : écriture écartée, aucune ligne', async () => {
    expect(await saveOn('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toEqual({ saved: false, rows: 0 });
  });
});
