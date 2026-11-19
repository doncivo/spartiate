/* eslint-disable -- Preuve d'audit, aucun correctif de l'application. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
test('A-007 : les imports Tauri restent derrière la façade platform', () => {
  assert.deepEqual(read('architecture.json').suspects.filter(e => e.cible.startsWith('@tauri-apps/')), []);
});
test('A-007 : la garde refuse aussi la forme dynamique', () => {
  assert.ok(read('partie1.json').probes.dynamique.some(m => m.ruleId === 'no-restricted-imports'));
});
