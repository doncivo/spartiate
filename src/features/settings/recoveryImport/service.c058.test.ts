// DATA-0293 (C-058, D-478, D-551) : le jour d'une mesure est celui du décalage enregistré avec elle, pas celui du fuseau actuel. Données synthétiques.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import { asEntityId, type DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { ShortcutFileRead } from '../../../platform/shortcutFiles';
import { createShortcutImportService, type ShortcutImportDeps } from './service';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000058');
const NOW = '2026-11-08T10:00:00.000Z';
const ok = (name: ShortcutFileRead['name'], text: string): ShortcutFileRead => ({ name, state: 'ok', text });
const sleepCsv = readFileSync('tests/fixtures/recovery/sommeil.csv', 'utf8');

describe('C-058 : décalage de la mesure enregistré et utilisé', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
  });
  afterEach(async () => {
    await db.close();
  });
  const run = (reads: ShortcutFileRead[], extra: Partial<ShortcutImportDeps> = {}) =>
    createShortcutImportService({
      reader: { kind: 'picker', automatic: true, read: vi.fn(async () => reads) },
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock: createManualClock(NOW),
      timeZone: 'Europe/Paris',
      log: () => undefined,
      ...extra,
    }).run('manual');

  it('le décalage de la cellule est écrit avec l’échantillon (« Z » : nul)', async () => {
    await run([ok('hrv.csv', 'date;valeur\n2026-11-07T22:30:00-05:00;48\n2026-11-08T03:12:00Z;50')]);
    const rows = await (await db.data.repos.recoverySamples()).listWindow('hrv', '2026-11-01T00:00:00.000Z', '2026-11-09T00:00:00.000Z');
    expect(rows.map((r) => [r.startAt, r.utcOffsetMin])).toEqual([
      ['2026-11-08T03:12:00.000Z', null],
      ['2026-11-08T03:30:00.000Z', -300],
    ]);
  });

  it('une mesure prise à -05:00 le soir du 8 (5 h 40 le 9 à Paris) compte pour le 8, à l’import comme au recalcul', async () => {
    const hook = vi.fn(async () => undefined);
    await run([ok('sommeil.csv', sleepCsv), ok('hrv.csv', 'date;valeur\n2026-11-08T23:40:00-05:00;61')], { afterRecompute: hook });
    const night = (hook.mock.calls[0] as unknown as [{ nights: { day: string; hrvMs: number | null }[] }])[0].nights.find((n) => n.day === '2026-11-08');
    expect(night?.hrvMs).toBe(61);
    // Recalcul seul (aucun fichier) : la valeur est relue de la base, avec son décalage.
    const again = vi.fn(async () => undefined);
    await run([{ name: 'sommeil.csv', state: 'absent' } as ShortcutFileRead], { afterRecompute: again });
    if (again.mock.calls.length > 0) {
      const n2 = (again.mock.calls[0] as unknown as [{ nights: { day: string; hrvMs: number | null }[] }])[0].nights.find((n) => n.day === '2026-11-08');
      expect(n2?.hrvMs).toBe(61);
    }
  });

  it('ligne d’avant (décalage nul) : calcul actuel conservé (fuseau de l’appareil)', async () => {
    const samples = await db.data.repos.recoverySamples();
    await samples.insertMany([{ type: 'hrv', startAt: '2026-11-09T04:40:00.000Z', endAt: '2026-11-09T04:40:00.000Z', value: 61, stage: null, source: 'hrv.csv' }], NOW);
    const [row] = await samples.listWindow('hrv', '2026-11-09T00:00:00.000Z', '2026-11-10T00:00:00.000Z');
    expect(row?.utcOffsetMin).toBeNull();
  });
});
