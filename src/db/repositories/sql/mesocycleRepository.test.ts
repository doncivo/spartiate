import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from '../../../domain/training/config';
import { anticipateDeload, closeMesocycle, createMesocycleSpec, mesocycleState, type MesocycleSpec } from '../../../domain/training/mesocycle';
import { pauseProgram, resumeProgram } from '../../../domain/training/programPause';
import { emptyInventory } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { day, OTHER_ROUTINE_ID, ROUTINE_ID, START } from '../../../../tests/fixtures/training/mesocycle';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I3-02 : `MesocycleRepository` (table `mesocycle`, migration 0007) : un cycle suivi, création qui clôt l'actif, valeurs validées par le
 * domaine, pauses relues telles quelles, capture de synchro, profil de matériel actif sans effet sur le cycle (critère 9).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f7' as DeviceId;
const M1 = '6d3c2b1a-0000-4000-8000-000000000001';
const M2 = '6d3c2b1a-0000-4000-8000-000000000002';
let db: TestDb;
afterEach(async () => db.close());

const spec = (routineId = ROUTINE_ID, startDate = START): MesocycleSpec => {
  const s = createMesocycleSpec({ routineId, startDate, weeks: 5 }, CONFIG);
  if (s === null) throw new Error('spec');
  return s;
};
const repo = () => db.data.repos.mesocycles();
const outbox = () => db.driver.select<{ table_name: string; row_id: string; field: string }>("SELECT table_name, row_id, field FROM sync_outbox WHERE table_name = 'mesocycle' ORDER BY seq");

describe('MesocycleRepository (I3-02)', () => {
  it('start : cycle actif relu tel quel, mis en file en ligne entière ; current et activeCount', async () => {
    db = await openBaseDb(DEVICE);
    expect(await (await repo()).current()).toBeNull();
    const created = await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
    expect(created).toMatchObject({ id: M1, ...spec(), deletedAt: null, deviceId: DEVICE });
    expect(await (await repo()).current()).toEqual(created);
    expect(await (await repo()).activeCount()).toBe(1);
    expect(await outbox()).toEqual([{ table_name: 'mesocycle', row_id: M1, field: '*' }]);
  });

  it('un seul cycle actif : en démarrer un autre clôt le premier (« stopped », date du nouveau début) dans la même transaction', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
    const second = await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(OTHER_ROUTINE_ID, day(10)), { id: M2 }));
    expect((await (await repo()).current())?.id).toBe(second.id);
    expect(await (await repo()).get(M1)).toMatchObject({ status: 'completed', outcome: 'stopped', endedOn: day(10) });
    expect(await (await repo()).activeCount()).toBe(1);
    expect((await (await repo()).list()).map((m) => m.id)).toEqual([M2, M1]);
  });

  it('save : pause, reprise avec semaine allégée, deload anticipé, clôture ; valeurs invalides refusées sans rien écrire', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
    const paused = pauseProgram(spec(), day(9));
    if (paused === null) throw new Error('pause');
    await (await repo()).save(M1, paused);
    expect((await (await repo()).get(M1))?.pauses).toEqual([{ from: day(9), to: null, lightWeek: false }]);
    const back = resumeProgram(paused, day(40), true, CONFIG);
    if (back === null) throw new Error('resume');
    const saved = await (await repo()).save(M1, back);
    expect(mesocycleState(saved, day(40), CONFIG)).toMatchObject({ kind: 'light', week: 2 });
    const early = anticipateDeload(back, day(60), CONFIG);
    if (early === null) throw new Error('early');
    expect((await (await repo()).save(M1, early)).deloadWeek).toBe(early.deloadWeek);
    await (await repo()).save(M1, closeMesocycle(early, 'repeat', day(70)));
    expect(await (await repo()).current()).toBeNull();
    const before = await db.driver.select('SELECT * FROM mesocycle');
    await expect((await repo()).save(M1, { ...early, weeks: 9 })).rejects.toMatchObject({ code: 'invalid' });
    await expect((await repo()).save(M2, early)).rejects.toMatchObject({ code: 'not-found' });
    await expect(db.data.transaction(async (repos) => (await repos.mesocycles()).start({ ...spec(), status: 'completed' }, { id: M2 }))).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM mesocycle')).toEqual(before);
  });

  it('deux cycles actifs (créés hors ligne sur deux appareils) : le plus récent est suivi, le nombre est dit', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
    await db.driver.execute(
      `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc)
       SELECT ?, ?, ?, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc FROM mesocycle WHERE id = ?`,
      [M2, OTHER_ROUTINE_ID, day(3), M1],
    );
    expect(await (await repo()).activeCount()).toBe(2);
    expect((await (await repo()).current())?.id).toBe(M2);
  });

  it('ligne illisible (pauses non JSON, reçue d’une autre version) : relue, signalée invalide par le domaine, jamais suivie en silence', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
    await db.driver.execute("UPDATE mesocycle SET pauses = 'illisible' WHERE id = ?", [M1]);
    const read = await (await repo()).current();
    expect(read?.id).toBe(M1);
    if (!read) throw new Error('read');
    expect(mesocycleState(read, day(3), CONFIG).phase).toBe('invalid');
  });

  it('critère 9 : activer le profil Maison ne touche ni au cycle ni à la routine (réglage local, rien mis en file)', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
    const equipment = await db.data.repos.equipmentProfiles();
    const home = await equipment.create({ id: '6d3c2b1a-0000-4000-8000-0000000000e1', name: 'Maison', kind: 'maison', inventory: emptyInventory(), increments: {} });
    await db.driver.execute('DELETE FROM sync_outbox');
    const before = await db.driver.select('SELECT * FROM mesocycle');
    await equipment.setActive(home.id);
    await equipment.setActive(null);
    expect(await db.driver.select('SELECT * FROM mesocycle')).toEqual(before);
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
  });
});
