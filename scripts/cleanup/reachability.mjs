/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : graphe d'imports de Spartiate et inventaire des fichiers non atteignables depuis les racines vivantes.
// Usage : node scripts/cleanup/reachability.mjs [--json sortie.json]
// Racines vivantes : points d'entrée des deux pages Vite, plugin Vite, fichiers référencés par new URL(..., import.meta.url).
// Les tests ne sont jamais des racines : un test est « mort » si tous ses imports du dépôt sont morts ; « mixte » s'il
// en importe des vivants et des morts (revue manuelle).
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SCAN_DIRS = ['src', 'tests', 'scripts'];
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'target']);
const EXT = ['.ts', '.tsx', '.mjs', '.js', '.json', '.css', '.d.ts'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const files = SCAN_DIRS.flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : [])).filter((f) => /\.(tsx?|mjs|js|css)$/.test(f));
const fileSet = new Set(files.map(rel));
for (const extra of ['vite.config.ts', 'vitest.config.ts', 'vitest.bundle.config.ts', 'vitest.perf.config.ts', 'vitest.nsis.config.ts', 'playwright.config.ts', 'playwright.smoke.config.ts', 'playwright.visual.config.ts']) {
  if (existsSync(join(ROOT, extra))) fileSet.add(extra);
}

function resolveSpec(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(join(ROOT, from)), spec.split('?')[0]);
  const cands = [base, ...EXT.map((e) => base + e), ...EXT.map((e) => join(base, 'index' + e)), base.replace(/\.js$/, '.ts')];
  for (const c of cands) {
    const r = rel(c);
    if (fileSet.has(r)) return r;
  }
  return null;
}

const RE = [
  /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  /new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g,
  /@import\s+(?:url\()?['"]([^'"]+)['"]/g,
  /vi\.(?:mock|doMock|importActual)\(\s*['"]([^'"]+)['"]/g,
];
const edges = new Map();
for (const f of fileSet) {
  const text = readFileSync(join(ROOT, f), 'utf8');
  const out = new Set();
  for (const re of RE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const r = resolveSpec(f, m[1]);
      if (r) out.add(r);
    }
  }
  for (const m of text.matchAll(/import\.meta\.glob\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g)) {
    for (const g of m[1].matchAll(/['"]([^'"]+)['"]/g)) {
      if (!g[1].startsWith('.')) continue;
      const dir = rel(resolve(dirname(join(ROOT, f)), g[1].replace(/\*.*$/, '')));
      for (const c of fileSet) if (c.startsWith(dir)) out.add(c);
    }
  }
  edges.set(f, out);
}

const isTest = (f) => /\.test\.(tsx?|mjs)$/.test(f) || f.startsWith('tests/');
const roots = ['src/main.tsx', 'src/features/sync/pairing-window/main.tsx'].filter((r) => fileSet.has(r));
const live = new Set();
const stack = [...roots];
while (stack.length) {
  const f = stack.pop();
  if (live.has(f)) continue;
  live.add(f);
  for (const t of edges.get(f) ?? []) if (!live.has(t)) stack.push(t);
}

const srcFiles = [...fileSet].filter((f) => f.startsWith('src/') && !f.endsWith('.d.ts'));
const deadSrc = srcFiles.filter((f) => !isTest(f) && !live.has(f)).sort();
const deadSet = new Set(deadSrc);
const tests = [...fileSet].filter((f) => isTest(f));
const deadTests = [];
const mixedTests = [];
for (const t of tests) {
  const deps = [...(edges.get(t) ?? [])].filter((d) => d !== t);
  const dead = deps.filter((d) => deadSet.has(d));
  if (dead.length === 0) continue;
  const liveDeps = deps.filter((d) => !deadSet.has(d) && !isTest(d) && !/^tests\/(setup|fixtures)\//.test(d));
  (liveDeps.length === 0 ? deadTests : mixedTests).push({ test: t, dead, live: liveDeps });
}
const result = { roots, nbFichiers: fileSet.size, vivants: live.size, deadSrc, deadTests, mixedTests };
const whoIdx = process.argv.indexOf('--importers');
if (whoIdx > 0) {
  for (const target of process.argv.slice(whoIdx + 1)) {
    const by = [...edges].filter(([, deps]) => deps.has(target)).map(([f]) => `${f}${live.has(f) ? '' : isTest(f) ? ' [test]' : ' [mort]'}`);
    console.log(`${target} <- ${by.join(', ') || '(aucun)'}`);
  }
  process.exit(0);
}
const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx > 0) writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(result, null, 2));
console.log(`fichiers scannés ${fileSet.size}, atteints ${live.size}, src morts ${deadSrc.length}, tests morts ${deadTests.length}, tests mixtes ${mixedTests.length}`);
