/* eslint-disable -- Preuve de conservation, modules du tag exécutés sans modification de logique. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

// Charge les modules TypeScript de production en mémoire ; cache CommonJS pour leurs dépendances.
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const require = spec => {
    if (!spec.startsWith('.')) return createRequire(filename)(spec);
    const stem = path.resolve(path.dirname(filename), spec);
    const found = [stem + '.ts', path.join(stem, 'index.ts'), stem].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!found) throw new Error('Module absent : ' + spec);
    return load(found);
  };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(require, module, module.exports);
  return module.exports;
}
const { mergeSnapshot } = load('src/sync/snapshot.ts');
const { finishResumeTx } = load('src/sync/join.ts');
const { applyOps } = load('src/sync/apply.ts');
const { SYNC_CATALOGUE } = load('src/domain/sync/syncTables.ts');
const now = '2026-11-19T10:00:00.000Z';
const device = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const hlc = String(Date.parse(now)).padStart(15, '0') + '-0000-' + device;
const epoch = 'e0001-' + device;
const catalogue = SYNC_CATALOGUE;
const observations = [];
for (const route of ["journal", "snapshot"]) test("weekday 20 vers lecteur 19 : " + route, async () => {
  const unknown = [];
  const states = new Map([[device, { deviceId: device, epoch, stateEpoch: epoch, cursorSegment: 0, cursorRecord: 0, ackHlc: null, status: 'active' }]]);
  const sync = {
    getMeta: async () => null,
    readRows: async () => new Map([[id, { hlc, values: new Map([['created_at', now]]) }]]),
    readClocks: async () => new Map(), pendingFields: async () => new Map(), tombstones: async () => new Map(),
    setGuard: async () => {}, clearGuard: async () => {}, savepoint: async () => {}, releaseSavepoint: async () => {},
    putUnknown: async value => unknown.push(value),
    getStates: async () => [...states.values()],
    saveState: async (key, value) => states.set(key, { ...states.get(key), ...value }),
    setMeta: async () => {},
  };
  const repos = { sync };
  const logger = { log: () => {} };
  const ctx = { catalogue, localSv: 19, remoteSv: 20, now, knows: () => true, logger };
  const fields = new Map([['created_at', [now, hlc, null]], ['weekday', [4, hlc, null]]]);
  if (route === 'journal') await applyOps(repos, [{ t: 'routine_day', id, at: now, f: fields }], ctx);
  else {
    const deps = { deviceId: id, catalogue, sv: 19, data: { repos, transaction: async work => work(repos) }, clock: { nowMs: () => Date.parse(now) }, hlc: { receive: () => {}, now: () => hlc }, logger };
    const loaded = {
      records: [{ k: 'snap-rows', rows: [['routine_day', new Map([['id', id], ['created_at', now], ['weekday', 4]]), new Map([['*', hlc]])]] }],
      end: { k: 'snap-end', count: 1, covers: new Map([[device, { epoch, segment: 1, record: 17, hlc, stateSeq: 1 }]]), epoch, sv: 20 },
    };
    await mergeSnapshot(deps, loaded, ctx, undefined, tx => finishResumeTx(tx, deps, {
      epoch, from: device, loaded, accepted: new Map([[device, {}]]), coverage: { forgotten: new Set() },
    }));
    assert.equal(states.get(device).cursorRecord, 17, 'La reprise avance au curseur couvert');
  }
  observations.push({ route, curseur: states.get(device).cursorRecord, conserves: unknown.map(f => ({ table: f.table, field: f.field, value: f.value, sv: f.sv })) });
  fs.writeFileSync('docs/audit-0.26.0/preuves/partie3-weekday-main.json', JSON.stringify({
    sha: '8686a8fc2860f7a94eb193426cbcc640a33bac80',
    observations,
  }, null, 2) + '\n');
  assert.equal(unknown.find(f => f.field === 'weekday')?.value, 4, 'La valeur reçue doit rester disponible pour la réintégration après mise à jour');
});
