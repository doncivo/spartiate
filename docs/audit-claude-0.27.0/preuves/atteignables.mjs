// AUDIT-CLAUDE-0.27.0 : graphe d'imports statiques et dynamiques depuis les points d'entrée de l'app (D-50).
// Sortie : fichiers de production de src/ jamais atteints. Usage : node docs/audit-claude-0.27.0/preuves/atteignables.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';

const all = execSync('git ls-tree -r --name-only v0.27.0 -- src', { encoding: 'utf8' }).split('\n').filter((f) => f && /\.(ts|tsx)$/.test(f) && !/\.(test|spec)\./.test(f) && !f.endsWith('.d.ts'));
const entries = ['src/main.tsx', ...all.filter((f) => /pairing-window\/main\.tsx$/.test(f))];
const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const resolve = (from, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = normalize(join(dirname(from), spec)).replace(/\\/g, '/');
  for (const e of exts) { const p = base + e; if (existsSync(p) && statSync(p).isFile()) return p; }
  return null;
};
const seen = new Set();
const stack = [...entries];
while (stack.length) {
  const f = stack.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g)) {
    const r = resolve(f, m[1] ?? m[2] ?? m[3]);
    if (r && /\.(ts|tsx)$/.test(r)) stack.push(r);
  }
}
const dead = all.filter((f) => !seen.has(f));
console.log(JSON.stringify({ points: entries, atteints: seen.size, total: all.length, inaccessibles: dead.length, fichiers: dead }, null, 1));
