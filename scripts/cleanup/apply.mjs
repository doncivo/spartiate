// CLEAN-01 : applique un lot de suppression du plan (plan.mjs) : supprime les fichiers morts et les tests morts dont le chemin
// commence par un des préfixes donnés, retire des barrels (export ... from) les lignes qui visent un fichier supprimé, et retire
// les fichiers supprimés de tests/bundle/start-modules.json (la liste ne peut que se réduire).
// Usage : node scripts/cleanup/apply.mjs plan.json prefixe [prefixe...]
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..', '..');
const [planFile, ...prefixes] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const match = (f) => prefixes.some((p) => f.startsWith(p));
const toDelete = [...plan.removable, ...plan.deadTests].filter(match);
const gone = new Set(toDelete);
for (const f of toDelete) if (existsSync(join(ROOT, f))) unlinkSync(join(ROOT, f));

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const EXT = ['', '.ts', '.tsx', '.css', '/index.ts', '/index.tsx'];
let edited = 0;
for (const full of walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const f = rel(full);
  if (gone.has(f)) continue;
  const text = readFileSync(full, 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.ES2022, true);
  const cuts = [];
  for (const st of sf.statements) {
    if (!(ts.isExportDeclaration(st) || ts.isImportDeclaration(st)) || !st.moduleSpecifier) continue;
    const spec = st.moduleSpecifier.text;
    if (!spec.startsWith('.')) continue;
    const base = resolve(dirname(full), spec);
    if (!EXT.some((e) => gone.has(rel(base + e)))) continue;
    // Seuls les exports (barrels) sont retirés automatiquement ; un import vers un fichier supprimé est une erreur à traiter à la main.
    if (ts.isExportDeclaration(st)) cuts.push([st.getFullStart(), st.getEnd()]);
    else console.log(`IMPORT RESTANT : ${f} -> ${spec}`);
  }
  if (cuts.length) {
    let out = text;
    for (const [a, b] of cuts.reverse()) out = out.slice(0, a) + out.slice(b);
    writeFileSync(full, out.replace(/^\n+/, ''));
    edited++;
  }
}
const sm = join(ROOT, 'tests/bundle/start-modules.json');
if (existsSync(sm)) {
  const raw = readFileSync(sm, 'utf8');
  const json = JSON.parse(raw);
  let removed = 0;
  for (const g of json.groupes ?? []) {
    if (!g.fichiers) continue;
    const before = g.fichiers.length;
    g.fichiers = g.fichiers.filter((x) => !gone.has(x));
    removed += before - g.fichiers.length;
  }
  if (json.ajouts) {
    const before = json.ajouts.length;
    json.ajouts = json.ajouts.filter((a) => !gone.has(a.fichier));
    removed += before - json.ajouts.length;
  }
  if (removed) {
    writeFileSync(sm, JSON.stringify(json, null, 2) + '\n');
    console.log(`start-modules.json : ${removed} entrée(s) retirée(s)`);
  }
}
console.log(`supprimés : ${toDelete.length} fichiers ; barrels modifiés : ${edited}`);
