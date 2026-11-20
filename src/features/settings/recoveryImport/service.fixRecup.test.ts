// FIX-RECUP (C-052) : le jour le plus ancien d'un pas.csv (total peut-être partiel) n'écrase jamais un total déjà importé. Données synthétiques.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import { asEntityId, type DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { ShortcutFileRead } from '../../../platform/shortcutFiles';
import { createShortcutImportService } from './service';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000012');
const NOW = '2026-11-08T10:00:00.000Z';
const ok = (text: string): ShortcutFileRead => ({ name: 'pas.csv', state: 'ok', text });

describe('import pas.csv : jour partiel (C-052)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
  });
  afterEach(async () => {
    await db.close();
  });
  const run = (text: string) =>
    createShortcutImportService({
      reader: { kind: 'picker', automatic: true, read: vi.fn(async () => [ok(text)]) },
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock: createManualClock(NOW),
      timeZone: 'Europe/Paris',
      log: () => undefined,
    }).run('manual');
  const totals = async () =>
    (await (await db.data.repos.recoverySamples()).listWindow('pas', '2026-11-01T00:00:00.000Z', '2026-11-09T00:00:00.000Z')).map((s) => [s.startAt.slice(0, 10), s.value]);

  it('8 000 pas complets du 06/11, puis un fichier dont le 06/11 (1 200) est le jour le plus ancien : 8 000 gardé, les autres jours remplacés', async () => {
    await run('2026-11-05T12:00:00+01:00;5000\n2026-11-06T12:00:00+01:00;8000\n2026-11-07T12:00:00+01:00;3000');
    expect(await totals()).toEqual([['2026-11-05', 5000], ['2026-11-06', 8000], ['2026-11-07', 3000]]);
    const second = await run('2026-11-06T18:00:00+01:00;1200\n2026-11-07T12:00:00+01:00;9000\n2026-11-08T09:00:00+01:00;900');
    expect(await totals()).toEqual([['2026-11-05', 5000], ['2026-11-06', 8000], ['2026-11-07', 9000], ['2026-11-08', 900]]);
    expect(second.files[0]).toMatchObject({ state: 'imported', added: 1, updated: 1, duplicates: 1 });
  });

  it('jour le plus ancien absent de la base : il est inséré (jamais perdu au premier import)', async () => {
    await run('2026-11-06T18:00:00+01:00;1200\n2026-11-07T12:00:00+01:00;9000');
    expect(await totals()).toEqual([['2026-11-06', 1200], ['2026-11-07', 9000]]);
  });
});
