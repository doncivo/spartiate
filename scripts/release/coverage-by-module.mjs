#!/usr/bin/env node
// SHELL-0295 (BL-044, D-641) : couverture par module tirée du rapport fusionné (coverage/coverage-summary.json, reporter json-summary).
// `node scripts/release/coverage-by-module.mjs coverage/coverage-summary.json` imprime un tableau Markdown (résumé du job de la CI).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Module d'un fichier : au plus trois niveaux de dossiers (`src/domain/training`, `src/features/nutrition`, `src/domain`, `src`). */
export function moduleOf(file) {
  return file.split('/').slice(0, -1).slice(0, 3).join('/');
}

const pct = (covered, total) => (total === 0 ? 100 : Math.round((covered / total) * 1000) / 10);

export function coverageByModule(summary, root) {
  const prefix = `${root.split(String.fromCharCode(92)).join('/').replace(/\/$/, '')}/`;
  const acc = new Map();
  for (const [path, entry] of Object.entries(summary)) {
    if (path === 'total') continue;
    const rel = path.split(String.fromCharCode(92)).join('/').replace(prefix, '');
    const key = moduleOf(rel);
    const m = acc.get(key) ?? { files: 0, lt: 0, lc: 0, bt: 0, bc: 0 };
    m.files += 1;
    m.lt += entry.lines.total;
    m.lc += entry.lines.covered;
    m.bt += entry.branches.total;
    m.bc += entry.branches.covered;
    acc.set(key, m);
  }
  return [...acc.keys()].sort().map((module) => {
    const m = acc.get(module);
    return { module, files: m.files, lines: pct(m.lc, m.lt), branches: pct(m.bc, m.bt) };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? 'coverage/coverage-summary.json';
  const rows = coverageByModule(JSON.parse(readFileSync(file, 'utf8')), process.cwd());
  console.log('### Couverture par module (BL-044)\n\n| Module | Fichiers | Lignes % | Branches % |\n|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.module} | ${String(r.files)} | ${String(r.lines).replace('.', ',')} | ${String(r.branches).replace('.', ',')} |`);
}
