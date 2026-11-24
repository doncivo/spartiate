import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import { asEntityId, type DeviceId, type LocalDate } from '../../../domain/types';
import { RepositoryError } from '../../../db/repositories/common';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { BODY_FILE_NAMES, type BodyFileName } from '../../../domain/health/bodyShortcutFiles';
import type { ShortcutFileRead, ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { createHealthBodyImportService } from './service';

/** NUTRI-0292 (C-128) : un refus du dépôt sur un jour de nutrition n'annule pas tout l'import (les autres jours sont écrits, le refus est compté). */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000a4');
const files = (texts: Partial<Record<BodyFileName, string>>): ShortcutFileRead[] =>
  BODY_FILE_NAMES.map((name) => (texts[name] === undefined ? { name, state: 'absent' } : { name, state: 'ok', text: texts[name] }) as unknown as ShortcutFileRead);

describe('C-128 : refus du dépôt pendant l\'import de nutrition', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.close();
  });

  it('un jour refusé est compté ; l\'autre jour est écrit ; l\'import est « done »', async () => {
    const reader = { kind: 'folder' as const, automatic: true, read: vi.fn(async () => files({ 'energie.csv': '2026-11-07T08:00:00+01:00;2000;kcal\n2026-11-08T08:00:00+01:00;2200;kcal\n' })) } as unknown as ShortcutFilesReader;
    const service = createHealthBodyImportService({
      reader,
      transaction: (work) =>
        db.data.transaction(async (repos) => {
          const meals = await repos.mealEntries();
          const refusing = { ...meals, create: async (draft: Parameters<typeof meals.create>[0]) => { if (draft.date === '2026-11-07') throw new RepositoryError('invalid', 'meal_entry', 'x'); return meals.create(draft); } };
          return work({ weights: await repos.bodyWeights(), measurements: await repos.measurements(), meals: refusing as typeof meals });
        }),
      clock: createManualClock('2026-11-08T10:00:00.000Z'),
      timeZone: 'Europe/Paris',
      log: () => undefined,
      state: { get: async () => null, set: async () => undefined },
    });
    const result = await service.run('manual');
    expect(result.status).toBe('done');
    expect(result.nutrition).toMatchObject({ created: 1, refused: 1 });
    const written = await (await db.data.repos.mealEntries()).listBetween('2026-11-01' as LocalDate, '2026-11-30' as LocalDate);
    expect(written.map((e) => e.date)).toEqual(['2026-11-08']);
  });
});
