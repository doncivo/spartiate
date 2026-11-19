import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NewChecklist, NewChecklistItem } from '../../../domain/model';
import { asEntityId, type ChecklistId, type ChecklistItemId, type DeviceId } from '../../../domain/types';
import { SPACE_PRO_ID } from '../../seed/defaultSpaces';
import { openTestDb, type TestDb } from './testSetup';

/** C-04, A-006 (FIX-0272) : 200 items créés en une transaction en moins de 300 ms (mesure inchangée, sortie de `npm run test`, lancée par `npm run test:perf`). */
const DEVICE = asEntityId<DeviceId>('30000000-0000-4000-8000-0000000000c1');
const listId = (n: number) => asEntityId<ChecklistId>(`c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const itemId = (n: number) => asEntityId<ChecklistItemId>(`c2000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const newList = (n: number, over: Partial<NewChecklist> = {}): NewChecklist => ({ id: listId(n), spaceId: SPACE_PRO_ID, title: `Liste ${String(n)}`, icon: null, date: null, isTemplate: false, ...over });
const newItem = (n: number, checklist: number, over: Partial<NewChecklistItem> = {}): NewChecklistItem => ({ id: itemId(n), checklistId: listId(checklist), text: `Item ${String(n)}`, checked: false, sortOrder: n, ...over });

describe('ChecklistRepository : performance (C-04)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openTestDb(DEVICE);
  });
  afterEach(async () => {
    await db.close();
  });

  it('crée la checklist et ses 200 items en une transaction en moins de 300 ms', async () => {
    const items = Array.from({ length: 200 }, (_, i) => newItem(i + 1, 7, { text: `Élément ${String(i + 1)}` }));
    const started = performance.now();
    const result = await db.data.transaction((repos) => repos.checklists.createWithItems(newList(7, { title: 'Grande liste' }), items));
    const elapsed = performance.now() - started;
    expect(result.items).toHaveLength(200);
    expect(elapsed).toBeLessThan(300);
  });
});
