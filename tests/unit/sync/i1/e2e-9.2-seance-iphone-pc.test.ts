import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { hlcDevice } from '../../../../src/domain/sync/parse';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { Hlc } from '../../../../src/domain/types';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * SYNC-0281b, e2e § 9.2 (PRD chapitre 09, I1) : « séance iPhone → PC → édition PC → iPhone ». Deux appareils simulés (deux bases SQLite
 * migrées, dossier iCloud simulé recopié par `syncFolders`, horloges manuelles), vrai service de synchro, catalogue de production. Le test
 * compare les colonnes publiées et les horloges par champ sur les deux bases : il est en Vitest node, pas en Playwright (voir docs/SYNC-0281.md).
 * Données synthétiques.
 */

const PC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IPHONE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const W1 = '9e2d0c4b-0000-4000-8000-000000000001';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pcAndIphone(): Promise<{ pc: SimDevice; iphone: SimDevice }> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: 'i0' });
  const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
  devices = [pc, iphone];
  await setupFirst(pc);
  await pc.cycle();
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  return { pc, iphone };
}

/** Un échange complet : chaque appareil fait un cycle (une seconde plus tard), puis iCloud recopie les dossiers ; deux fois. */
async function exchange(): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

const published = (table: string): string => {
  const t = SYNC_CATALOGUE.table(table);
  if (!t) throw new Error(table);
  return [...t.columns.map((c) => c.name), 'hlc'].join(', ');
};
/** Séance et séries telles que publiées (colonnes du catalogue et hlc de ligne), triées. */
const aggregate = async (d: SimDevice) => ({
  workout: await d.driver.select(`SELECT id, ${published('workout')} FROM workout WHERE id = ?`, [W1]),
  sets: await d.driver.select(`SELECT id, ${published('workout_set')} FROM workout_set WHERE workout_id = ? ORDER BY position, id`, [W1]),
});
/**
 * Horloge effective de chaque champ publié (`sync_field_clock` du champ, sinon repli `'*'`, sinon hlc de la ligne) : l'écrivain n'a pas
 * d'entrée pour une ligne qu'il a seul écrite, le lecteur pose le repli `'*'` ; la fusion ne voit que l'horloge effective.
 */
async function fieldClocks(d: SimDevice): Promise<{ table_name: string; row_id: string; field: string; hlc: Hlc }[]> {
  const out: { table_name: string; row_id: string; field: string; hlc: Hlc }[] = [];
  for (const table of ['workout', 'workout_set']) {
    const t = SYNC_CATALOGUE.table(table);
    if (!t) throw new Error(table);
    const rows = await d.driver.select<{ id: string; hlc: Hlc }>(`SELECT id, hlc FROM ${table} WHERE ${table === 'workout' ? 'id' : 'workout_id'} = ? ORDER BY id`, [W1]);
    for (const row of rows) {
      const entries = new Map((await d.driver.select<{ field: string; hlc: Hlc }>('SELECT field, hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ?', [table, row.id])).map((e) => [e.field, e.hlc]));
      for (const c of t.columns) out.push({ table_name: table, row_id: row.id, field: c.name, hlc: entries.get(c.name) ?? entries.get('*') ?? row.hlc });
    }
  }
  return out;
}
const count = async (d: SimDevice, sql: string): Promise<number> => (await d.driver.select<{ n: number }>(sql))[0]?.n ?? -1;

describe('e2e § 9.2 : séance iPhone → PC → édition PC → iPhone', () => {
  it('séance close sur l’iPhone, reçue par le PC, charge corrigée sur le PC, vue sur l’iPhone : aucun conflit, aucun doublon, hlc cohérents', async () => {
    const { pc, iphone } = await pcAndIphone();

    // 1. iPhone : séance de trois séries (60 kg × 8), close.
    const workouts = await iphone.data.repos.workouts();
    await workouts.start({ source: 'empty', id: W1, name: 'Haut A' });
    const added = await workouts.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3 });
    for (const s of added.sets) {
      iphone.clock.advance(120_000);
      await workouts.validateSet(s.id, { reps: 8, loadKg: 60 });
    }
    const setIds = added.sets.map((s) => s.id);
    iphone.clock.advance(60_000);
    await iphone.data.transaction(async (repos) => (await repos.workouts()).close(W1));
    const closed = await aggregate(iphone);
    const closureHlc = (closed.workout[0] as { hlc: Hlc }).hlc;
    expect(hlcDevice(closureHlc)).toBe(iphone.id);

    // 2. PC : séance reçue entière, mêmes valeurs et mêmes hlc, une fois, rien de côté.
    await exchange();
    expect(await aggregate(pc)).toEqual(closed);
    expect(await fieldClocks(pc)).toEqual(await fieldClocks(iphone));
    expect((await (await pc.data.repos.workouts()).getClosed(W1))?.sets.map((s) => s.id)).toEqual(setIds);
    expect(await pc.driver.select('SELECT * FROM sync_parked')).toEqual([]);
    // Valeurs reçues : rien n'est republié par le PC.
    expect(await pc.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);

    // 3. PC : correction de la charge de la deuxième série.
    const edited = setIds[1] as string;
    pc.clock.advance(5 * 60_000);
    await (await pc.data.repos.workouts()).correctSet(edited, { loadKg: 62.5 });
    const queued = await pc.driver.select<{ table_name: string; row_id: string }>("SELECT DISTINCT table_name, row_id FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')");
    expect(queued).toEqual([{ table_name: 'workout_set', row_id: edited }]);

    // 4. iPhone : correction vue ; autres séries inchangées.
    await exchange();
    const onIphone = await (await iphone.data.repos.workouts()).getClosed(W1);
    expect(onIphone?.sets.map((s) => [s.id, s.loadKg, s.reps])).toEqual([
      [setIds[0], 60, 8],
      [edited, 62.5, 8],
      [setIds[2], 60, 8],
    ]);
    expect(onIphone?.sets[1]?.correctedAt).not.toBeNull();
    expect(await aggregate(iphone)).toEqual(await aggregate(pc));

    // hlc : l'horloge de load_kg de la série corrigée vient du PC, plus récente que la clôture, identique des deux côtés ; les autres champs
    // gardent l'horloge de la clôture.
    const clocks = await fieldClocks(iphone);
    expect(clocks).toEqual(await fieldClocks(pc));
    const loadClock = clocks.find((c) => c.row_id === edited && c.field === 'load_kg');
    expect(loadClock && hlcDevice(loadClock.hlc)).toBe(pc.id);
    expect((loadClock?.hlc ?? '') > closureHlc).toBe(true);
    for (const c of clocks.filter((c) => c.row_id !== edited)) expect(c.hlc <= closureHlc, `${c.row_id}.${c.field}`).toBe(true);

    // Aucun conflit faux, aucun doublon, rien en attente, des deux côtés.
    for (const d of [pc, iphone]) {
      expect(await count(d, 'SELECT COUNT(*) AS n FROM conflict_log'), d.name).toBe(0);
      expect(await count(d, `SELECT COUNT(*) AS n FROM workout WHERE id = '${W1}'`), d.name).toBe(1);
      expect(await count(d, `SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = '${W1}'`), d.name).toBe(3);
      expect(await count(d, 'SELECT COUNT(*) AS n FROM sync_parked'), d.name).toBe(0);
      expect(await d.data.repos.sync.outboxCount(), d.name).toBe(0);
    }

    // Un échange de plus ne change rien (idempotence).
    const before = { pc: await aggregate(pc), iphone: await aggregate(iphone), clocks: await fieldClocks(pc) };
    await exchange();
    expect({ pc: await aggregate(pc), iphone: await aggregate(iphone), clocks: await fieldClocks(pc) }).toEqual(before);
    expect(await count(iphone, 'SELECT COUNT(*) AS n FROM conflict_log')).toBe(0);
  });

  // qa-test : cas limites du même parcours.
  it('qa : charge corrigée sur le PC et répétitions corrigées sur l’iPhone hors ligne, même série : les deux gardées, aucun conflit', async () => {
    const { pc, iphone } = await pcAndIphone();
    const workouts = await iphone.data.repos.workouts();
    await workouts.start({ source: 'empty', id: W1, name: 'Haut A' });
    const added = await workouts.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
    for (const s of added.sets) await workouts.validateSet(s.id, { reps: 8, loadKg: 60 });
    await iphone.data.transaction(async (repos) => (await repos.workouts()).close(W1));
    await exchange();
    const target = added.sets[0]?.id as string;
    pc.clock.advance(60_000);
    await (await pc.data.repos.workouts()).correctSet(target, { loadKg: 62.5 });
    iphone.clock.advance(90_000);
    await (await iphone.data.repos.workouts()).correctSet(target, { reps: 7 });
    await exchange();
    for (const d of [pc, iphone]) {
      const set = (await (await d.data.repos.workouts()).getClosed(W1))?.sets.find((s) => s.id === target);
      expect(set && [set.loadKg, set.reps], d.name).toEqual([62.5, 7]);
      expect(await count(d, 'SELECT COUNT(*) AS n FROM conflict_log'), d.name).toBe(0);
      expect(await count(d, `SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = '${W1}'`), d.name).toBe(2);
    }
    expect(await aggregate(pc)).toEqual(await aggregate(iphone));
    expect(await fieldClocks(pc)).toEqual(await fieldClocks(iphone));
  });

  it('qa : séance reçue par le PC après un redémarrage de chacun, correction faite avant que l’iPhone ne relise : même résultat, une seule séance', async () => {
    const { pc, iphone } = await pcAndIphone();
    const workouts = await iphone.data.repos.workouts();
    await workouts.start({ source: 'empty', id: W1, name: 'Haut A' });
    const added = await workouts.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1 });
    await workouts.validateSet(added.sets[0]?.id as string, { reps: 8, loadKg: 60 });
    await iphone.data.transaction(async (repos) => (await repos.workouts()).close(W1));
    await exchange();
    await pc.restart();
    pc.clock.advance(60_000);
    await (await pc.data.repos.workouts()).correctSet(added.sets[0]?.id as string, { loadKg: 55 });
    await iphone.restart();
    await exchange();
    expect((await (await iphone.data.repos.workouts()).getClosed(W1))?.sets.map((s) => s.loadKg)).toEqual([55]);
    expect(await aggregate(iphone)).toEqual(await aggregate(pc));
    for (const d of [pc, iphone]) {
      expect(await count(d, 'SELECT COUNT(*) AS n FROM conflict_log'), d.name).toBe(0);
      expect(await count(d, 'SELECT COUNT(*) AS n FROM workout'), d.name).toBe(1);
    }
  });
});
