/* eslint-disable -- Preuve ciblée sur SQLite synthétique ; ne touche aucun conteneur réel. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import ts from 'typescript';

// Les deux vrais modules du tag, transpilés en mémoire sans modifier leur logique.
const esm = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const contract = uri(esm(fs.readFileSync('src/db/driver.ts', 'utf8')));
const driverCode = esm(fs.readFileSync('src/db/serializedDriver.ts', 'utf8')).replace(/from ['"]\.\/driver['"]/, 'from ' + JSON.stringify(contract));
const { createSerializedDriver } = await import(uri(driverCode));
const base = 'docs/audit-0.26.0/preuves/';
fs.mkdirSync(base + '.runtime', { recursive: true });
const observations = [];

for (const failRollback of [false, true]) test(`A-008 : écriture suivante durable, ROLLBACK ${failRollback ? 'en échec injecté' : 'réussi (témoin)'}`, async () => {
  const dir = fs.mkdtempSync(path.resolve(base, '.runtime/rollback-synthetique-'));
  const filename = path.join(dir, 'fixture.db');
  const raw = new DatabaseSync(filename);
  raw.exec('CREATE TABLE item (id TEXT PRIMARY KEY); INSERT INTO item VALUES (\'avant\')');
  const driver = createSerializedDriver('tauri-sqlite', {
    execute: async (sql, params = []) => {
      if (failRollback && sql === 'ROLLBACK') throw new Error('synthetic-ipc-rejection-before-rollback');
      const result = raw.prepare(sql).run(...params);
      return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
    },
    select: async (sql, params = []) => raw.prepare(sql).all(...params),
    close: async () => raw.close(),
  });
  await assert.rejects(driver.transaction(async tx => {
    await tx.execute('INSERT INTO item VALUES (?)', ['transaction-refusee']);
    throw new Error('work-failed');
  }), /work-failed/);
  const acknowledged = await driver.execute('INSERT INTO item VALUES (?)', ['suivante-acquittee']);
  const beforeClose = (await driver.select('SELECT id FROM item ORDER BY id')).map(r => r.id);
  await driver.close();
  const reopened = new DatabaseSync(filename);
  const afterReopen = reopened.prepare('SELECT id FROM item ORDER BY id').all().map(r => r.id);
  reopened.close();
  observations.push({ failRollback, acknowledged: acknowledged.rowsAffected, beforeClose, afterReopen });
  fs.writeFileSync(base + 'partie2-rollback.json', JSON.stringify({ sha: '8686a8fc2860f7a94eb193426cbcc640a33bac80', limite: 'SQLite Node, vraie enveloppe TypeScript ; rejet de transport injecté avant ROLLBACK, aucune panne native ni donnée réelle utilisée.', observations }, null, 2) + '\n');
  assert.equal(acknowledged.rowsAffected, 1);
  assert.ok(afterReopen.includes('suivante-acquittee'), 'Une écriture acquittée après la transaction refusée disparaît à la réouverture');
});
