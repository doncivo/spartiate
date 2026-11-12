/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : restaure depuis origin/main les tests supprimés dont tous les imports relatifs existent encore (le module testé a été
// conservé : le test ne doit pas disparaître). Usage : node scripts/cleanup/restore-tests.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const deleted = execFileSync('git', ['diff', '--name-only', '--diff-filter=D', 'origin/main', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.test\.tsx?$/.test(f));
const exists = (rel) => existsSync(resolve(ROOT, rel));
let n = 0;
for (const f of deleted) {
  const text = execFileSync('git', ['show', `origin/main:${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let ok = true;
  for (const m of text.matchAll(/(?:from|import\(?|mock\()\s*['"](\.[^'"]+)['"]/g)) {
    const base = resolve(dirname(resolve(ROOT, f)), m[1].split('?')[0]);
    const cands = [base, ...['.ts', '.tsx', '.css', '.json', '.js'].map((e) => base + e), base + '/index.ts', base + '/index.tsx'];
    if (!cands.some((c) => exists(relative(ROOT, c).split(sep).join('/')))) ok = false;
  }
  if (ok) {
    mkdirSync(dirname(resolve(ROOT, f)), { recursive: true });
    writeFileSync(resolve(ROOT, f), text);
    console.log('restauré', f);
    n++;
  }
}
console.log(`${n} tests restaurés`);
