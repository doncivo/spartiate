import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import fs from 'node:fs';
import { load } from './load-ts.mjs';

test('19 migrations : catalogue, colonnes et captures presentes en SQLite synthetique', () => {
  const { migrations } = load('src/db/migrations/index.ts');
  const { SYNC_CATALOGUE } = load('src/domain/sync/syncTables.ts');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  try {
    for (const m of migrations) {
      db.exec('BEGIN');
      for (const sql of m.statements) db.exec(sql);
      db.exec('COMMIT');
    }
    const triggers = db.prepare("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='trigger'").all();
    const checked = [];
    for (const t of SYNC_CATALOGUE.tables) {
      const columns = db.prepare(`PRAGMA table_info(${t.name})`).all().map(c => c.name);
      for (const c of [t.key, ...t.columns.map(c => c.name), ...t.local]) assert.ok(columns.includes(c), `${t.name}.${c}`);
      const own = triggers.filter(x => x.tbl_name === t.name);
      assert.ok(own.some(x => /AFTER INSERT/i.test(x.sql)), `${t.name}: insertion`);
      const updates = own.filter(x => /AFTER UPDATE/i.test(x.sql)).map(x => x.sql).join('\n');
      for (const c of t.columns) {
        if (t.name === 'workout_set' && ['circuit_id', 'circuit_rest_sec'].includes(c.name)) {
          // Migration 0013 : groupes modifiables seulement avant cloture, puis publication '*'.
          assert.equal(c.conflictVisible, false);
          assert.ok(triggers.some(x => x.tbl_name === 'workout' && x.sql.includes('workout_set') && x.sql.includes("'*'")));
        } else assert.ok(updates.includes(c.name), `${t.name}.${c.name}: capture absente`);
      }
      for (const p of t.parents) assert.ok(SYNC_CATALOGUE.tables.indexOf(SYNC_CATALOGUE.table(p.table)) < SYNC_CATALOGUE.tables.indexOf(t), `${t.name}: parent avant enfant`);
      checked.push({table:t.name, columns:t.columns.length, triggers:own.map(x=>x.name)});
    }
    assert.equal(migrations.length, 19);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    fs.writeFileSync('docs/audit-0.26.0/preuves/partie2-schema.json', JSON.stringify({migrations:migrations.length,checked,limite:'Presence structurelle et references SQL, pas une preuve de capture de toutes les valeurs ni execution native.'},null,2)+'\n');
  } finally { db.close(); }
});
