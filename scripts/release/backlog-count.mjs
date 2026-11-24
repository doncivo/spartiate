#!/usr/bin/env node
/* global console, process */
// BL-147 (audit du projet du 24/11, N-10) : compteur unique des lignes ouvertes de docs/backlog.md.
// `node scripts/release/backlog-count.mjs` écrit la ligne à citer telle quelle dans docs/reprise.md
// (scripts/release/backlogCount.test.ts vérifie que la reprise cite le compte exact).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODULES = ['CI', 'séance et moteur', 'nutrition et récupération', 'données et synchro', 'import et contenu', 'coquille, iOS et qualité'];

function statusOf(line) {
  if (!line.startsWith('| ') || line.startsWith('| ID ') || line.startsWith('|---')) return null;
  const cells = line.split(' | ');
  return cells[cells.length - 1].replace(/\s*\|\s*$/, '').trim();
}

export function countBacklog(text) {
  const byModule = {};
  let todo = 0;
  let partial = 0;
  let decide = 0;
  let constat = 0;
  for (const line of text.split('\n')) {
    const status = statusOf(line);
    if (status === null) continue;
    const todoMatch = status.match(/^à faire \(0\.\d+\.[x\d]+, (.+?), [SML]\)/);
    if (todoMatch) {
      todo += 1;
      const module = MODULES.find((m) => todoMatch[1] === m) ?? todoMatch[1];
      byModule[module] = (byModule[module] ?? 0) + 1;
    } else if (status.startsWith('fait en partie')) partial += 1;
    else if (status.startsWith('à trancher par Ali')) decide += 1;
    else if (status.startsWith("constat d'Ali à faire")) constat += 1;
  }
  return { todo, byModule, partial, decide, constat };
}

export function formatCount(c) {
  const modules = MODULES.filter((m) => c.byModule[m]).map((m) => `${m} ${c.byModule[m]}`);
  for (const m of Object.keys(c.byModule)) if (!MODULES.includes(m)) modules.push(`${m} ${c.byModule[m]}`);
  return `Registre : ${c.todo} lignes « à faire » (${modules.join(', ')}), ${c.partial} « fait en partie », ${c.decide} « à trancher par Ali », ${c.constat} constats d'Ali.`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(formatCount(countBacklog(readFileSync(process.argv[2] ?? 'docs/backlog.md', 'utf8'))));
}
