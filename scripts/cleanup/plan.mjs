/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : plan de suppression à partir de .codex-tmp/sym.json (sortie de symbols.mjs).
// Un fichier mort est supprimable si aucun test « mixte » (test qui importe aussi du code vivant) ne l'importe, directement ou par un
// autre fichier conservé. Sinon il est conservé comme « support de test d'un test vivant ».
// Usage : node scripts/cleanup/plan.mjs sym.json [--list famille-prefixe]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const sym = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const dead = new Set(sym.deadFiles);
const deadTests = new Set(sym.deadTests.map((t) => t.test));
const keep = new Map(); // fichier -> raison
const importsOf = (f) => {
  // imports directs vers d'autres fichiers morts
  const text = existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8') : '';
  const out = [];
  for (const m of text.matchAll(/(?:from|import\(?)\s*['"](\.[^'"]+)['"]|@import\s+['"](\.[^'"]+)['"]/g)) {
    const spec = m[1] ?? m[2];
    const base = resolve(dirname(join(ROOT, f)), spec);
    for (const c of [base, base + '.ts', base + '.tsx', base + '.css', base + '/index.ts', base + '/index.tsx']) {
      const r = relative(ROOT, c).split(sep).join('/');
      if (dead.has(r)) out.push(r);
    }
  }
  return out;
};
const queue = [];
// Un test « mixte » dont le nom commence comme un fichier mort qu'il importe (X.qa.test.ts pour X.ts) teste ce fichier : mort avec lui.
const stem = (p) => p.split('/').pop().split('.')[0];
const ownTests = [];
const trueMixed = [];
for (const m of sym.mixedTests) {
  if (m.dead.some((d) => stem(d) === stem(m.test))) ownTests.push(m.test);
  else trueMixed.push(m);
}
for (const m of trueMixed) for (const d of m.dead) if (!keep.has(d)) (keep.set(d, `importé par le test vivant ${m.test}`), queue.push(d));
while (queue.length) {
  const f = queue.pop();
  for (const d of importsOf(f)) if (!keep.has(d)) (keep.set(d, `requis par ${f} (conservé)`), queue.push(d));
}
const removable = [...dead].filter((f) => !keep.has(f)).sort();
// tests morts à retirer : morts purs, plus tout test dont tous les imports du dépôt sont supprimables
const testsToRemove = [...deadTests, ...ownTests].filter((t) => !keep.has(t));
console.log(JSON.stringify({ removable, kept: Object.fromEntries(keep), deadTests: testsToRemove, trueMixed }, null, 1));
