#!/usr/bin/env node
/* global process, console */
// STR-01 (D-311) : renseigne `strengthStandardKey` des exercices embarqués qui sont un mouvement de référence des normes
// (content/strength/standards.json) ; tous les autres restent à null. Mécanique par script (D-51), idempotent.
// Les exercices aux haltères n'ont pas de clé : la source ne publie aucune norme d'haltères (D-311).
// Usage : node scripts/content/set-strength-keys.mjs [fichier exercises.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STRENGTH_KEYS = {
  'bench-press-barbell': 'bench',
  'incline-press-barbell': 'incline-bench',
  'row-barbell': 'barbell-row',
  'pull-up': 'pull-up',
  'pull-up-weighted': 'pull-up',
  'chin-up': 'chin-up',
  'overhead-press-barbell': 'overhead-press',
  dips: 'dip',
  'squat-barbell': 'back-squat',
  'front-squat-barbell': 'front-squat',
  'deadlift-barbell': 'deadlift',
  'sumo-deadlift': 'sumo-deadlift',
};

function main() {
  const file = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'exercises', 'exercises.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const ids = new Set(json.exercises.map((x) => x.id));
  for (const id of Object.keys(STRENGTH_KEYS)) if (!ids.has(id)) throw new Error(`exercice absent du catalogue : ${id}`);
  for (const x of json.exercises) x.strengthStandardKey = STRENGTH_KEYS[x.id] ?? null;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`set-strength-keys : ${Object.keys(STRENGTH_KEYS).length} exercices avec une clé.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
