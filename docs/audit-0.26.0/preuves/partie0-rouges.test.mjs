/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Contrats attendus, exécutés sur le code figé sans le modifier.
test('A-002 : la feuille utilise les tokens de couleur', () => {
  const css = fs.readFileSync('src/ui/Sheet.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /background:\s*#[0-9a-f]+/i);
});

test('A-003 : les dépendances directes React et Zustand figurent dans les licences', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const licences = fs.readFileSync('docs/licences.md', 'utf8');
  for (const name of ['react-dom', 'zustand']) {
    assert.ok(manifest.dependencies[name], `${name} est une dépendance de production`);
    assert.ok(licences.toLowerCase().includes(name), `${name} absent de docs/licences.md`);
  }
});
