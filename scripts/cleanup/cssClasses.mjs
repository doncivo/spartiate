/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : classes CSS (.ct-*, .xxx) définies dans src/**/*.css et jamais citées dans du code ou HTML non-test.
// Une classe est citée si son nom apparaît comme sous-chaîne dans un .ts/.tsx non-test, index.html, pairing.html ou un autre .css (composition).
// Inventaire seulement (sur-approximation : nom en sous-chaîne = cité). Usage : node scripts/cleanup/cssClasses.mjs [--json sortie.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const all = walk(join(ROOT, 'src'));
const css = all.filter((f) => f.endsWith('.css'));
const code = all.filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
const codeText = code.map((f) => readFileSync(f, 'utf8')).join('\n') + readFileSync(join(ROOT, 'index.html'), 'utf8') + readFileSync(join(ROOT, 'pairing.html'), 'utf8');
const dead = {};
let n = 0;
for (const f of css) {
  const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const names = new Set([...text.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c)));
  const d = [...names].filter((c) => !codeText.includes(c));
  if (d.length) {
    dead[relative(ROOT, f).split(sep).join('/')] = d;
    n += d.length;
  }
}
console.log(`classes jamais citées : ${n} dans ${Object.keys(dead).length} fichiers CSS`);
for (const [f, d] of Object.entries(dead)) console.log(`${f}: ${d.length}`);
const j = process.argv.indexOf('--json');
if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify(dead, null, 1));
