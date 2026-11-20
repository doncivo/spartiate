// AUDIT-CLAUDE-0.27.0 : décompte des constats par gravité depuis constats.md (première gravité citée après l'identifiant).
import { readFileSync } from 'node:fs';
const t = readFileSync('docs/audit-claude-0.27.0/constats.md', 'utf8');
const G = ['bloquant', 'important', 'mineur', 'amélioration', 'à vérifier', 'à trancher'];
const seen = new Map();
for (const line of t.split('\n')) {
  const m = line.match(/^(?:###|-)\s+\**(C-\d{3})\**\s+(.*)$/);
  if (!m || seen.has(m[1])) continue;
  const rest = m[2].toLowerCase().slice(0, 120);
  const g = G.map((x) => [x, rest.indexOf(x)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'groupé';
  seen.set(m[1], g);
}
const counts = {};
for (const g of seen.values()) counts[g] = (counts[g] ?? 0) + 1;
console.log(JSON.stringify({ total: seen.size, counts, bloquants: [...seen].filter(([, g]) => g === 'bloquant').map(([id]) => id) }));
