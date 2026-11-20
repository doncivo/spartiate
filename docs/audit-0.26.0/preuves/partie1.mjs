/* eslint-disable -- Outillage de lecture isolé de l'audit. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { ESLint } from 'eslint';
const base = 'docs/audit-0.26.0/preuves/';
const sha = '8686a8fc2860f7a94eb193426cbcc640a33bac80';
const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', sha], { encoding: 'utf8' }).trim().split('\n');
const changed = execFileSync('git', ['diff', '--name-only', sha, '--', '.', ':!docs/audit-0.26.0'], { encoding: 'utf8' }).trim();
if (changed) throw new Error('Source différente du tag');
const files = tracked.filter(f => /^src\/.*\.tsx?$/.test(f) && !/\.test\.|\/testing\//.test(f));
const edges = [], globals = [], mutable = [], external = [];
for (const file of files) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const loc = n => ({ fichier: file, ligne: tree.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
  const resolve = spec => {
    const stem = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    return [stem, stem + '.ts', stem + '.tsx', stem + '/index.ts', stem + '/index.tsx'].find(f => files.includes(f));
  };
  for (const s of tree.statements) {
    if (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) {
      const spec = s.moduleSpecifier?.text;
      const typeOnly = s.isTypeOnly || s.importClause?.isTypeOnly || (s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings) && !s.importClause.name && s.importClause.namedBindings.elements.every(e => e.isTypeOnly));
      if (spec?.startsWith('.') && !typeOnly) {
        const target = resolve(spec);
        if (target) edges.push({ ...loc(s), cible: target });
      } else if (spec && !spec.startsWith('.') && file.startsWith('src/domain/')) external.push({ ...loc(s), cible: spec, typeOnly: !!typeOnly });
    }
    if (file.startsWith('src/domain/') && ts.isVariableStatement(s) && !(s.declarationList.flags & ts.NodeFlags.Const)) mutable.push({ ...loc(s), texte: s.getText(tree) });
  }
  if (file.startsWith('src/domain/')) {
    const visit = n => {
      if (ts.isIdentifier(n) && /^(window|document|navigator|localStorage|sessionStorage|fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|systemClock|uuidGenerator)$/.test(n.text)) globals.push({ ...loc(n), nom: n.text });
      ts.forEachChild(n, visit);
    };
    visit(tree);
  }
}
// Composantes fortement connexes, imports statiques de valeurs uniquement.
const adjacency = new Map(files.map(f => [f, []]));
for (const e of edges) adjacency.get(e.fichier).push(e.cible);
let counter = 0;
const indices = new Map(), low = new Map(), stack = [], active = new Set(), cycles = [];
function visit(v) {
  indices.set(v, counter); low.set(v, counter++); stack.push(v); active.add(v);
  for (const w of adjacency.get(v)) {
    if (!indices.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (active.has(w)) low.set(v, Math.min(low.get(v), indices.get(w)));
  }
  if (low.get(v) === indices.get(v)) {
    const group = []; let w;
    do { w = stack.pop(); active.delete(w); group.push(w); } while (w !== v);
    if (group.length > 1) cycles.push(group.sort());
  }
}
for (const f of files) if (!indices.has(f)) visit(f);
const lint = new ESLint({ cache: false });
const probes = {};
for (const [name, code] of Object.entries({ statique: "import { getCurrentWindow } from '@tauri-apps/api/window'; export const probe = getCurrentWindow;", dynamique: "export const probe = () => import('@tauri-apps/api/window');" })) {
  const [result] = await lint.lintText(code, { filePath: 'src/features/settings/auditBoundaryProbe.ts' });
  probes[name] = result.messages.map(m => ({ ruleId: m.ruleId, message: m.message }));
}
const actual = (await lint.lintFiles(['src/features/settings/theme.ts'])).map(r => ({ errors: r.errorCount, warnings: r.warningCount }));
const result = { sha, sourceIdentiqueAuTag: true, files: files.length, edges: edges.length, cycles, globals, mutable, external, probes, themeLint: actual, limites: 'Scan syntaxique, pas une lecture. Types exclus du graphe cyclique, réexports mixtes conservateurs. Globaux par nom : candidats, pas résolution de symboles. Aucun constat de pureté globale déduit du scan.' };
fs.writeFileSync(base + 'partie1.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, globals: globals.length }, null, 2));
