import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { load } from './load-ts.mjs';
const { migrations } = load('src/db/migrations/index.ts');
const { createSerializedDriver } = load('src/db/serializedDriver.ts');
const { createWorkoutRepository } = load('src/db/repositories/sql/workoutRepository.ts');
const { createExportImportRepository } = load('src/db/repositories/sql/exportImportRepository.ts');
const { planImport } = load('src/domain/exportImport/plan.ts');
const { SYNC_CATALOGUE } = load('src/domain/sync/syncTables.ts');
const device = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now = '2026-11-20T08:00:00.000Z';
function fixture() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON');
  for (const m of migrations) for (const sql of m.statements) raw.exec(sql);
  let reject = () => false, seq = 0;
  const stamper = {next: () => ({at:now,deviceId:device,hlc:String(Date.parse(now)).padStart(15,'0')+'-'+String(++seq).padStart(4,'0')+'-'+device})};
  const driver = createSerializedDriver('tauri-sqlite', {
    execute: async (sql, params=[]) => {
      if(reject(sql)) throw Error('synthetic-write-failed');
      const r=raw.prepare(sql).run(...params);
      return {rowsAffected:Number(r.changes),lastInsertId:Number(r.lastInsertRowid)};
    },
    select: async (sql,params=[]) => raw.prepare(sql).all(...params),
    close: async () => raw.close(),
  });
  return {driver,stamper,fail:fn=>{reject=fn;}};
}
test('cloture : echec final annule series et captures, puis cloture coherente', async () => {
  const f=fixture();
  try {
    const w=await f.driver.transaction(async tx=>{
      const r=createWorkoutRepository(tx,f.stamper);
      const w=await r.start({source:'empty',name:'Synthese'});
      const withSet=await r.addExercise(w.id,{exerciseId:'bench-press-barbell',exerciseName:'Synthese',sets:1});
      await r.validateSet(withSet.sets[0].id,{reps:8,loadKg:40});
      return r.get(w.id);
    });
    const before=await f.driver.select('SELECT * FROM workout_set');
    assert.equal((await f.driver.select('SELECT * FROM sync_outbox')).length,0);
    f.fail(sql=>sql.startsWith('UPDATE workout SET ended_at'));
    await assert.rejects(createWorkoutRepository(f.driver,f.stamper).close(w.id),/synthetic-write-failed/);
    assert.deepEqual(await f.driver.select('SELECT * FROM workout_set'),before);
    assert.equal((await f.driver.select('SELECT ended_at FROM workout'))[0].ended_at,null);
    assert.equal((await f.driver.select('SELECT * FROM sync_outbox')).length,0);
    f.fail(()=>false);
    await createWorkoutRepository(f.driver,f.stamper).close(w.id);
    const q=await f.driver.select('SELECT table_name,field FROM sync_outbox');
    assert.ok(q.some(x=>x.table_name==='workout' && x.field==='*'));
    assert.ok(q.some(x=>x.table_name==='workout_set' && x.field==='*'));
    const clocks=await f.driver.select('SELECT hlc FROM workout UNION SELECT hlc FROM workout_set');
    assert.equal(clocks.length,1);
  } finally { await f.driver.close(); }
});
test('import : echec de seconde pesee annule premiere pesee, horloges, file et garde',async()=>{
  const f=fixture();
  try {
    const data={profile:null,settings:{},weights:['2026-11-18','2026-11-19'].map(date=>({id:`weight|${date}|manual`,date,kg:80,source:'manual',timezone:'Europe/Paris',healthUuid:null,measuredAt:null}))};
    let writes=0;
    f.fail(sql=>sql.startsWith('INSERT INTO body_weight') && ++writes===2);
    await assert.rejects(f.driver.transaction(async tx=>{
      const r=createExportImportRepository(tx,f.stamper,SYNC_CATALOGUE);
      await r.applyImport(planImport(await r.readExportData(),data,'merge'),2026);
    }),/synthetic-write-failed/);
    for(const t of ['body_weight','sync_outbox','sync_field_clock','sync_guard']) assert.equal((await f.driver.select(`SELECT * FROM ${t}`)).length,0,t);
  } finally { await f.driver.close(); }
});
