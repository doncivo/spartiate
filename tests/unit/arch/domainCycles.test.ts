import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DATA-0295 (BL-035) : aucun cycle d'imports statiques de valeurs dans `src/domain` (fichiers livrés, tests exclus). Le cycle hérité
 * `goalRules → week → todayList → goalRules` (audit Codex 0.26.0) est le cas d'origine. Les imports de types seuls (`import type`, ou
 * accolades dont tous les noms sont `type …`) et les imports dynamiques ne créent pas d'arête : ils ne lient rien à l'exécution.
 */
const root = resolve(__dirname, '..', '..', '..');
const domain = join(root, 'src', 'domain');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

/** Imports et réexportations statiques de valeurs, relatifs, d'un fichier (chemins absolus résolus). */
function valueImports(file: string, source: string): string[] {
  const out: string[] = [];
  const pattern = /^\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"](\.[^'"]+)['"]/gms;
  for (const match of source.matchAll(pattern)) {
    const [, , typeOnly, clause = '', target = ''] = match;
    if (typeOnly) continue;
    const braces = /^\{([\s\S]*)\}$/.exec(clause.trim());
    if (braces) {
      const names = (braces[1] ?? '').split(',').map((n) => n.trim()).filter(Boolean);
      if (names.length > 0 && names.every((n) => n.startsWith('type '))) continue;
    }
    const base = resolve(dirname(file), target);
    const candidates = [`${base}.ts`, join(base, 'index.ts')];
    const hit = candidates.find((c) => {
      try {
        return statSync(c).isFile();
      } catch {
        return false;
      }
    });
    if (hit) out.push(hit);
  }
  return out;
}

function cycles(graph: Map<string, string[]>): string[][] {
  const found: string[][] = [];
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (node: string): void => {
    state.set(node, 'open');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      const s = state.get(next);
      if (s === 'open') found.push([...stack.slice(stack.indexOf(next)), next]);
      else if (s === undefined) visit(next);
    }
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of [...graph.keys()].sort()) if (!state.has(node)) visit(node);
  return found;
}

describe('BL-035 : imports statiques de src/domain sans cycle', () => {
  it('le relevé reconnaît un import de valeur, ignore un import de types seuls', () => {
    const here = join(domain, 'x.ts');
    const src = "import type { A } from './week';\nimport { type B, type C } from './todayList';\nimport { buildTodayList } from './todayList';\n";
    expect(valueImports(here, src).map((p) => relative(domain, p))).toEqual(['todayList.ts']);
  });

  it('aucun cycle (goalRules → week → todayList compris)', () => {
    const graph = new Map<string, string[]>();
    for (const file of files(domain)) graph.set(file, valueImports(file, readFileSync(file, 'utf8')));
    const named = cycles(graph).map((c) => c.map((p) => relative(domain, p).replace(/\\/g, '/')).join(' → '));
    expect(named).toEqual([]);
  });
});
