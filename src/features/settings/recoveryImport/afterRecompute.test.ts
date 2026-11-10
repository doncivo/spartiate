import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import { asEntityId, type DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { ShortcutFileRead } from '../../../platform/shortcutFiles';
import { createShortcutImportService, type ShortcutImportDeps } from './service';

/** I5-02 point 2.3 : point d'extension appelé après un recalcul réussi (replanification des notifications de récupération). */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000012');
const NOW = '2026-11-08T10:00:00.000Z';
const ok = (name: ShortcutFileRead['name'], text: string): ShortcutFileRead => ({ name, state: 'ok', text });
const sleepCsv = readFileSync('tests/fixtures/recovery/sommeil.csv', 'utf8');

describe('afterRecompute (service d’import)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
  });
  afterEach(async () => {
    await db.close();
  });

  const build = (reads: ShortcutFileRead[], extra: Partial<ShortcutImportDeps>) =>
    createShortcutImportService({
      reader: { kind: 'picker', automatic: true, read: vi.fn(async () => reads) },
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock: createManualClock(NOW),
      timeZone: 'Europe/Paris',
      log: () => undefined,
      ...extra,
    });

  it('appelé une fois après un recalcul réussi, avec le jour local, les nuits et l’Exertion du jour', async () => {
    const hook = vi.fn(async () => undefined);
    await build([ok('sommeil.csv', sleepCsv)], { afterRecompute: hook }).run('manual');
    expect(hook).toHaveBeenCalledTimes(1);
    const info = (hook.mock.calls[0] as unknown as [{ today: string; nights: unknown[]; exertionToday: number }])[0];
    expect(info.today).toBe('2026-11-08');
    expect(info.nights.length).toBeGreaterThan(0);
    expect(typeof info.exertionToday).toBe('number');
  });

  it('jamais appelé sans fichier importé (dossier absent)', async () => {
    const hook = vi.fn(async () => undefined);
    await build([{ name: 'sommeil.csv', state: 'absent' } as ShortcutFileRead], { afterRecompute: hook }).run('manual');
    expect(hook).not.toHaveBeenCalled();
  });

  it('un échec du point d’extension ne casse pas l’import (résultat « done », recalcul non marqué en échec)', async () => {
    const result = await build([ok('sommeil.csv', sleepCsv)], { afterRecompute: async () => { throw new Error('boom'); } }).run('manual');
    expect(result.status).toBe('done');
    expect(result.recomputeFailed).toBe(false);
  });
});
