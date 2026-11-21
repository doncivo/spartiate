#!/usr/bin/env node
/* global process, console */
// MEDIA-03 : génère les pictogrammes SVG des exercices sans photo (D-51 : mécanique par script).
// Usage : node scripts/content/build-pictograms.mjs [--out dossier] [--only id,id] [--planche fichier.html]
//   défaut : content/exercises/pictograms/<id>.svg pour toutes les entrées de pictograms/specs.mjs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPictogram } from './pictograms/skeleton.mjs';
import { SPECS } from './pictograms/specs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Pictogramme d'un exercice : muscles primaires du JSON, poses des specs. */
export function pictogramFor(exercise) {
  const spec = SPECS[exercise.id];
  if (!spec) return null;
  const muscles = exercise.muscles.filter((m) => m.role === 'primary').map((m) => m.id);
  return renderPictogram({ ...spec, muscles });
}

/** Planche de comparaison (HTML) : clair et sombre, jetons de la charte recopiés en variables CSS locales. */
export function plancheHtml(items) {
  const cell = (it) => `<figure><div class="svg" role="img" aria-label="${it.nameFr}">${it.svg}</div><figcaption>${it.nameFr}</figcaption></figure>`;
  const cells = items.map(cell).join('\n');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Pictogrammes MEDIA-03 : planche de comparaison</title>
<style>
body{margin:0;font-family:system-ui,sans-serif}
.theme{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px}
.light{--ct-color-bronze:#8e6530;background:#ffffff;color:#15171c}
.dark{--ct-color-bronze:#c28e4c;background:#15171c;color:#ede7dc}
figure{margin:0;padding:8px;border:1px solid #8884;border-radius:8px}
.svg svg{width:100%;height:auto;display:block}
figcaption{font-size:13px;margin-top:4px}
</style></head><body>
<div class="theme light">
${cells}
</div>
<div class="theme dark">
${cells}
</div>
</body></html>
`;
}

function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const out = resolve(arg('--out') ?? join(ROOT, 'content', 'exercises', 'pictograms'));
  const only = arg('--only')?.split(',') ?? null;
  const exercises = JSON.parse(readFileSync(join(ROOT, 'content', 'exercises', 'exercises.json'), 'utf8')).exercises;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  mkdirSync(out, { recursive: true });
  const items = [];
  for (const id of only ?? Object.keys(SPECS)) {
    const ex = byId.get(id);
    if (!ex) throw new Error(`exercice inconnu : ${id}`);
    const svg = pictogramFor(ex);
    if (svg === null) throw new Error(`aucune description de pictogramme : ${id}`);
    writeFileSync(join(out, `${id}.svg`), svg);
    items.push({ nameFr: ex.nameFr, svg });
  }
  const planche = arg('--planche');
  if (planche) writeFileSync(resolve(planche), plancheHtml(items));
  console.log(`${items.length} pictogramme(s) écrits dans ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
