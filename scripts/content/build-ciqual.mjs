#!/usr/bin/env node
/* global process, console */
// Génère content/food/ciqual.json depuis les fichiers XML officiels de l'Anses (I4-02), ou valide le fichier existant.
//   node scripts/content/build-ciqual.mjs <dossier-des-xml> [sortie]   génère (somme MD5 vérifiée avant toute lecture)
//   node scripts/content/build-ciqual.mjs --check [fichier]            valide content/food/ciqual.json (aucun fichier brut requis)
// Les XML (≈ 70 Mo) ne sont pas versionnés : voir docs/licences.md pour leur origine, leurs sommes et la commande de téléchargement.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFromDir, validateCiqual } from './ciqual.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = join(ROOT, 'content', 'food', 'ciqual.json');

/** Sérialisation stable : en-tête puis un aliment par ligne (diff lisible), fin de ligne LF, sans espace superflu. */
export function serializeCiqual(data) {
  const head = { schemaVersion: data.schemaVersion, source: data.source, groups: data.groups };
  const lines = data.foods.map((food) => `    ${JSON.stringify(food)}`);
  const headText = JSON.stringify(head, null, 2);
  return `${headText.slice(0, -2)},\n  "foods": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const path = resolve(args[1] ?? DEFAULT_OUT);
    const errors = validateCiqual(JSON.parse(readFileSync(path, 'utf8')));
    if (errors.length > 0) {
      for (const e of errors.slice(0, 50)) console.log(`::error::${e}`);
      console.log(`build-ciqual --check : ${errors.length} erreur(s).`);
      process.exit(1);
    }
    console.log('build-ciqual --check : OK.');
    return;
  }
  if (!args[0]) {
    console.log('usage : node scripts/content/build-ciqual.mjs <dossier-des-xml> [sortie] | --check [fichier]');
    process.exit(2);
  }
  const { data, stats } = buildFromDir(resolve(args[0]));
  const errors = validateCiqual(data);
  if (errors.length > 0) {
    for (const e of errors.slice(0, 50)) console.log(`::error::${e}`);
    console.log(`build-ciqual : ${errors.length} erreur(s), rien n'est écrit.`);
    process.exit(1);
  }
  const out = resolve(args[1] ?? DEFAULT_OUT);
  writeFileSync(out, serializeCiqual(data));
  console.log(`build-ciqual : ${stats.foods} aliments, ${stats.groups} groupes -> ${out}`);
  console.log(`  absentes (null)  : ${JSON.stringify(stats.missing)}`);
  console.log(`  « traces » (null) : ${JSON.stringify(stats.traces)}`);
  console.log(`  « < x » (null)    : ${JSON.stringify(stats.below)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
