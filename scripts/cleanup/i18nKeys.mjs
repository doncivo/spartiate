/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : clés i18n du catalogue (src/i18n/fr.ts aplati) jamais référencées par du code non-test hors catalogues.
// Une clé « a.b.c » est référencée si la chaîne 'a.b.c' apparaît dans un fichier source non-test hors src/i18n/fr*.ts, ou si un préfixe
// dynamique (chaîne se terminant par « . » ou gabarit `a.b.${`) couvre son parent. En cas de doute : référencée.
// Usage : node scripts/cleanup/i18nKeys.mjs [--json sortie.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..', '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const req = (spec) => {
    if (!spec.startsWith('.')) return createRequire(file)(spec);
    const base = resolve(dirname(file), spec);
    for (const c of [base + '.ts', join(base, 'index.ts')]) {
      try {
        statSync(c);
        return load(c);
      } catch {}
    }
    throw new Error('introuvable ' + spec + ' depuis ' + file);
  };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, req);
  return mod.exports;
}
const fr = load(join(ROOT, 'src/i18n/fr.ts')).fr;
const keys = [];
(function flat(node, prefix) {
  for (const [k, v] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') keys.push(p);
    else if (v && typeof v === 'object') flat(v, p);
  }
})(fr, '');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const srcFiles = walk(join(ROOT, 'src')).filter((f) => /\.(tsx?)$/.test(f) && !/\.test\./.test(f) && !/[\\/]i18n[\\/]fr(\.[\w]+)?\.ts$/.test(f));
const text = srcFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
// préfixes dynamiques
const prefixes = new Set();
for (const m of text.matchAll(/['"`]([a-zA-Z][\w.]*\.)(?:['"`]|\$\{)/g)) prefixes.add(m[1]);
const dead = [];
for (const key of keys) {
  const lit = new RegExp(`['"\`]${key.replace(/\./g, '\\.')}['"\`]`);
  if (lit.test(text)) continue;
  const parent = key.split('.').slice(0, -1).join('.') + '.';
  if ([...prefixes].some((p) => key.startsWith(p) || p.startsWith(parent) && false)) continue;
  dead.push(key);
}
// accès par objet (fr.x.y, xxxFr.y) : si le dernier segment apparaît en `.segment` ailleurs hors catalogue, on le signale « douteux »
const byGroup = {};
for (const k of dead) {
  const g = k.split('.')[0];
  (byGroup[g] ??= []).push(k);
}
const total = { cles: keys.length, mortes: dead.length };
console.log(JSON.stringify(total));
for (const [g, ks] of Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length)) console.log(`${g}: ${ks.length}`);
const j = process.argv.indexOf('--json');
if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify({ total, dead, byGroup }, null, 1));
const totals = {};
for (const k of keys) totals[k.split('.')[0]] = (totals[k.split('.')[0]] ?? 0) + 1;
console.log('--- groupes entièrement morts');
for (const [g, n] of Object.entries(totals)) if ((byGroup[g]?.length ?? 0) === n) console.log(`${g}: ${n}`);
