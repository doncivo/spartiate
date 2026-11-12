/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : après une suppression par lot, restaure depuis HEAD tout fichier supprimé qu'un fichier conservé importe encore
// (erreurs TS2307 de tsc). Boucle jusqu'à ce que plus rien ne manque. Les fichiers restaurés sont consignés dans la fiche comme
// « conservés : importés par du code vivant ».
// Usage : node scripts/cleanup/restore-missing.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve, relative, sep } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const restored = [];
for (let round = 0; round < 15; round++) {
  const r = spawnSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout + r.stderr;
  const missing = new Set();
  for (const m of out.matchAll(/^([^\s(]+)\(\d+,\d+\): error TS2307: Cannot find module '(\.[^']+)'/gm)) {
    const base = resolve(dirname(resolve(ROOT, m[1])), m[2]);
    for (const c of [base, base + '.ts', base + '.tsx', base + '.css', base + '/index.ts']) {
      const rel = relative(ROOT, c).split(sep).join('/');
      if (existsSync(resolve(ROOT, rel))) continue;
      const tracked = spawnSync('git', ['cat-file', '-e', `HEAD:${rel}`], { cwd: ROOT });
      if (tracked.status === 0) missing.add(rel);
    }
  }
  if (!missing.size) {
    console.log(`restaurés (${restored.length}) :\n${restored.join('\n')}`);
    console.log(`erreurs tsc restantes : ${out.split('\n').filter((l) => /error TS/.test(l)).length}`);
    console.log(out.split('\n').filter((l) => /error TS/.test(l)).slice(0, 20).join('\n'));
    process.exit(0);
  }
  for (const f of missing) {
    execFileSync('git', ['checkout', 'HEAD', '--', f], { cwd: ROOT });
    restored.push(f);
  }
}
