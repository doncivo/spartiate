// CLEAN-01 : jetons CSS déclarés dans src/ui/theme/tokens.css et jamais lus (var(--x)) ailleurs que dans leur déclaration.
// Usage : node scripts/cleanup/cssTokens.mjs [--apply]   (--apply retire les lignes de déclaration, jusqu'au point fixe)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const TOKENS = join(ROOT, 'src/ui/theme/tokens.css');
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const others = walk(join(ROOT, 'src')).filter((f) => /\.(css|tsx?)$/.test(f) && f !== TOKENS && !/\.test\./.test(f));
const othersText = others.map((f) => readFileSync(f, 'utf8')).join('\n');
const apply = process.argv.includes('--apply');
let css = readFileSync(TOKENS, 'utf8');
const removed = new Set();
for (let pass = 0; pass < 10; pass++) {
  const names = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  let changed = false;
  for (const name of names) {
    const re = new RegExp(`${name}(?![\\w-])`, 'g');
    const inTokens = (css.match(re) ?? []).length;
    const declCount = (css.match(new RegExp(`^\\s*${name}\\s*:`, 'gm')) ?? []).length;
    const usedElsewhere = new RegExp(`${name}(?![\\w-])`).test(othersText);
    if (!usedElsewhere && inTokens === declCount) {
      removed.add(name);
      css = css.replace(new RegExp(`^[ \\t]*${name}\\s*:[^;\\n]*;[ \\t]*\\r?\\n`, 'gm'), '');
      changed = true;
    }
  }
  if (!changed) break;
}
console.log(`jetons inutilisés : ${removed.size}`);
console.log([...removed].join('\n'));
if (apply) writeFileSync(TOKENS, css);
