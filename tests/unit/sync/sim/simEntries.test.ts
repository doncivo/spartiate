import { beforeAll, describe, expect, it } from 'vitest';
import { I0_SCHEMA_VERSION, createSimDevice, liveTitles, pair, setupFirst, simSchema, syncFolders, taskSnapshot, selectSimSchema, warmSimDevices, type SimDevice } from '../../../sim/syncDevice';
import { SIM_ENTRY_TABLE } from '../../../sim/syncEntries';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { TaskId } from '../../../../src/domain/types';

/**
 * CLEAN-03 (D-201) : banc Spartiate du simulateur. Un fichier qui appelle `selectSimSchema('i0')` crée des appareils sur la migration réelle et le
 * catalogue de production ; la forme « tâche » des scénarios hérités écrit la table publiée `meal_entry` (aucune table de l'ancien schéma).
 */
selectSimSchema('i0');
beforeAll(() => warmSimDevices(), 60_000);

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function room(): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', clock: a.clock, devicePlatform: 'ios' });
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  return [a, b];
}

describe('CLEAN-03 : appareils simulés au schéma Spartiate', () => {
  it('le schéma du fichier vaut pour les appareils, la table des entrées est publiée et la base n’a aucune table de l’ancien schéma', async () => {
    expect(simSchema()).toBe('i0');
    const a = await createSimDevice(A_ID);
    try {
      expect(a.schema).toBe('i0');
      expect(SYNC_CATALOGUE.tables.map((t) => t.name)).toContain(SIM_ENTRY_TABLE);
      const tables = (await a.driver.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
      expect(tables).toContain(SIM_ENTRY_TABLE);
      for (const legacy of ['task', 'project', 'space', 'reminder', 'goal', 'checklist']) expect(tables).not.toContain(legacy);
      expect(I0_SCHEMA_VERSION).toBeGreaterThanOrEqual(20);
    } finally {
      await a.close();
    }
  });

  it('création, modification par champ, suppression : même forme qu’une tâche, convergence des deux appareils', async () => {
    const [a, b] = await room();
    try {
      const t = await a.createTask('Petit-déjeuner');
      expect(t).toMatchObject({ title: 'Petit-déjeuner', note: '', status: 'todo', date: '2026-10-05', time: null, deletedAt: null });
      await a.cycle();
      syncFolders([a, b]);
      await b.cycle();
      expect(await b.task(t.id)).toMatchObject({ title: 'Petit-déjeuner', note: '' });
      // Deux champs différents modifiés des deux côtés : fusion par champ, aucun conflit.
      await a.updateTask(t.id, { title: 'Titre du PC' });
      await b.updateTask(t.id, { note: 'note de l’iPhone', status: 'done', time: '09:30' as never });
      await a.cycle();
      await b.cycle();
      syncFolders([a, b]);
      await a.cycle();
      await b.cycle();
      expect(await taskSnapshot(a)).toEqual(await taskSnapshot(b));
      expect(await a.task(t.id)).toMatchObject({ title: 'Titre du PC', note: 'note de l’iPhone', status: 'done', time: '09:30' });
      expect(await a.driver.select('SELECT COUNT(*) AS n FROM conflict_log')).toEqual([{ n: 0 }]);
      await b.deleteTask(t.id);
      await b.cycle();
      syncFolders([a, b]);
      await a.cycle();
      expect((await a.task(t.id))?.deletedAt).not.toBeNull();
      expect(await liveTitles(a)).toEqual([]);
    } finally {
      await a.close();
      await b.close();
    }
  });

  it('un champ de tâche sans équivalent est refusé, jamais ignoré en silence', async () => {
    const a = await createSimDevice(A_ID);
    try {
      await expect(a.createTask('X', { sortOrder: 4 })).rejects.toThrow(/sortOrder/);
      const t = await a.createTask('Y');
      await expect(a.updateTask(t.id as TaskId, { carriedOver: true })).rejects.toThrow(/carriedOver/);
    } finally {
      await a.close();
    }
  });
});
