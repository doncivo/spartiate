/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : atteignabilité au niveau des symboles (complète reachability.mjs).
// Un fichier est vivant s'il est atteint par un nom effectivement utilisé par du code vivant ; les déclarations de premier niveau
// non exportées vers du code vivant et non référencées par du code vivant sont mortes. Analyse par noms d'identifiants
// (sur-approximation : en cas de doute, vivant). Les tests ne sont jamais des racines.
// Usage : node scripts/cleanup/symbols.mjs [--json sortie.json]
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'target']);
const EXT = ['.ts', '.tsx', '.mjs', '.js', '.json', '.css', '.d.ts'];
const rel = (p) => relative(ROOT, p).split(sep).join('/');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const all = ['src', 'tests', 'scripts'].flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : [])).filter((f) => /\.(tsx?|mjs|js|css)$/.test(f)).map(rel);
for (const e of ['vite.config.ts']) all.push(e);
const fileSet = new Set(all);
const isTest = (f) => /\.test\.(tsx?|mjs)$/.test(f) || f.startsWith('tests/') || f.startsWith('scripts/');

function resolveSpec(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(join(ROOT, from)), spec.split('?')[0]);
  for (const c of [base, ...EXT.map((e) => base + e), ...EXT.map((e) => join(base, 'index' + e)), base.replace(/\.js$/, '.ts')]) {
    if (fileSet.has(rel(c))) return rel(c);
  }
  return null;
}

/** @typedef {{target:string, names:Set<string>|'all', locals:Map<string,string>, ns:Map<string,string>, side:boolean}} Imp */
const info = new Map();
for (const f of fileSet) {
  if (!/\.(tsx?|mjs|js)$/.test(f)) {
    // CSS : @import
    const text = readFileSync(join(ROOT, f), 'utf8');
    const imps = [];
    for (const m of text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) {
      const t = resolveSpec(f, m[1]);
      if (t) imps.push({ target: t, kind: 'side' });
    }
    info.set(f, { css: true, imps });
    continue;
  }
  const text = readFileSync(join(ROOT, f), 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.ES2022, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = []; // {target, kind:'names'|'ns'|'side'|'all', local, imported}
  const reexports = []; // {target, star:boolean, pairs:[{orig, alias}], nsAlias?}
  const exports = new Map(); // name -> {node, kind}
  const decls = []; // {names:Set<string>, node, exportedNames:string[]}
  const sideNodes = []; // statements always executed
  const dynamicAll = new Set();
  function addDyn(node) {
    ts.forEachChild(node, function visit(n) {
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
        const t = resolveSpec(f, n.arguments[0].text);
        if (t) dynamicAll.add(t);
      }
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL') {}
      ts.forEachChild(n, visit);
    });
  }
  addDyn(sf);
  for (const m of text.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g)) {
    const t = resolveSpec(f, m[1]);
    if (t) dynamicAll.add(t);
  }
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const t = resolveSpec(f, st.moduleSpecifier.text);
      if (!t) continue;
      const c = st.importClause;
      if (!c) imports.push({ target: t, kind: 'side' });
      else {
        if (c.name) imports.push({ target: t, kind: 'names', local: c.name.text, imported: 'default' });
        if (c.namedBindings) {
          if (ts.isNamespaceImport(c.namedBindings)) imports.push({ target: t, kind: 'ns', local: c.namedBindings.name.text });
          else for (const el of c.namedBindings.elements) imports.push({ target: t, kind: 'names', local: el.name.text, imported: (el.propertyName ?? el.name).text });
        }
        if (!c.name && !c.namedBindings) imports.push({ target: t, kind: 'side' });
      }
      continue;
    }
    if (ts.isExportDeclaration(st)) {
      if (st.moduleSpecifier) {
        const t = resolveSpec(f, st.moduleSpecifier.text);
        if (!t) continue;
        if (!st.exportClause) reexports.push({ target: t, star: true, pairs: [] });
        else if (ts.isNamespaceExport(st.exportClause)) reexports.push({ target: t, star: false, pairs: [], nsAlias: st.exportClause.name.text });
        else reexports.push({ target: t, star: false, pairs: st.exportClause.elements.map((el) => ({ orig: (el.propertyName ?? el.name).text, alias: el.name.text })) });
      } else if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) exports.set(el.name.text, { local: (el.propertyName ?? el.name).text, node: st });
      }
      continue;
    }
    if (ts.isExportAssignment(st)) {
      exports.set('default', { node: st, localExpr: true });
      decls.push({ names: new Set(), node: st, exported: ['default'] });
      continue;
    }
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
    const exp = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDef = mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    let names = [];
    if (ts.isVariableStatement(st)) names = st.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : d.name.elements.filter((e) => ts.isIdentifier(e.name)).map((e) => e.name.text)));
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st) || ts.isModuleDeclaration(st)) && st.name) names = [st.name.text];
    if (names.length === 0) {
      sideNodes.push(st);
      continue;
    }
    const exported = exp ? (isDef ? ['default'] : names) : [];
    for (const n of exported) exports.set(n, { node: st });
    decls.push({ names: new Set(names), node: st, exported });
  }
  // Pour chaque déclaration : identifiants référencés (hors son propre nom de déclaration), et accès d'espace de noms.
  const idsOf = (node) => {
    const ids = new Set();
    const nsProps = new Map(); // ns -> Set(prop) | 'all'
    (function visit(n) {
      if (ts.isIdentifier(n)) ids.add(n.text);
      if (ts.isShorthandPropertyAssignment(n)) ids.add(n.name.text);
      ts.forEachChild(n, visit);
    })(node);
    return { ids, node };
  };
  for (const d of decls) d.refs = idsOf(d.node).ids;
  const sideRefs = new Set();
  for (const s of sideNodes) for (const i of idsOf(s).ids) sideRefs.add(i);
  // `export { a as b }` local : l'exporté b dépend de a
  info.set(f, { sf, imports, reexports, exports, decls, sideRefs, dynamicAll, text });
}

// Fixpoint
const used = new Map(); // file -> Set(names) | 'all'
const live = new Set();
const work = [];
function mark(file, names) {
  if (!fileSet.has(file)) return;
  let u = used.get(file);
  let changed = false;
  if (!u) {
    u = new Set();
    used.set(file, u);
    live.add(file);
    changed = true;
  }
  if (u === 'all') return;
  if (names === 'all') {
    used.set(file, 'all');
    changed = true;
  } else for (const n of names) if (!u.has(n)) (u.add(n), (changed = true));
  if (changed) work.push(file);
}
for (const r of ['src/main.tsx', 'src/features/sync/pairing-window/main.tsx']) mark(r, 'all');

// nsUsage : pour un fichier, pour un alias d'espace de noms, les propriétés lues ou 'all'.
function nsUse(sf, local, root) {
  const props = new Set();
  let whole = false;
  (function visit(n) {
    if (ts.isIdentifier(n) && n.text === local) {
      const p = n.parent;
      if (ts.isPropertyAccessExpression(p) && p.expression === n) props.add(p.name.text);
      else if (ts.isQualifiedName(p) && p.left === n) props.add(p.right.text);
      else if (!(ts.isNamespaceImport(p))) whole = true;
    }
    ts.forEachChild(n, visit);
  })(root);
  return whole ? 'all' : props;
}

while (work.length) {
  const f = work.pop();
  const i = info.get(f);
  if (!i) continue;
  if (i.css) {
    for (const imp of i.imps) mark(imp.target, []);
    continue;
  }
  const u = used.get(f);
  const isAll = u === 'all';
  // déclarations nécessaires
  const needed = new Set();
  const neededRefs = new Set(i.sideRefs);
  const local2decl = new Map();
  for (const d of i.decls) for (const n of d.names) local2decl.set(n, d);
  const exportedNeeded = (d) => isAll || d.exported.some((n) => u.has(n));
  const queue = [];
  for (const d of i.decls) if (exportedNeeded(d) || d.names.size === 0) (needed.add(d), queue.push(d));
  // export { a as b } : b utilisé => a nécessaire
  for (const [name, e] of i.exports) if (e.local && (isAll || u.has(name))) neededRefs.add(e.local);
  for (const r of neededRefs) {
    const d = local2decl.get(r);
    if (d && !needed.has(d)) (needed.add(d), queue.push(d));
  }
  while (queue.length) {
    const d = queue.pop();
    for (const r of d.refs) {
      neededRefs.add(r);
      const t = local2decl.get(r);
      if (t && !needed.has(t)) (needed.add(t), queue.push(t));
    }
  }
  // roots d'identifiants utilisés par le code nécessaire
  const usedIds = new Set(neededRefs);
  for (const d of needed) for (const r of d.refs) usedIds.add(r);
  // imports
  for (const imp of i.imports) {
    if (imp.kind === 'side') mark(imp.target, []);
    else if (imp.kind === 'names') {
      if (usedIds.has(imp.local)) mark(imp.target, [imp.imported]);
    } else if (imp.kind === 'ns') {
      if (usedIds.has(imp.local)) {
        // propriétés lues dans le code nécessaire seulement
        const props = new Set();
        let whole = false;
        const roots = [...needed].map((d) => d.node).concat(i.sideRefs.size ? i.sf.statements.filter((s) => !i.decls.some((d) => d.node === s) && !ts.isImportDeclaration(s)) : []);
        for (const r of roots) {
          const p = nsUse(i.sf, imp.local, r);
          if (p === 'all') whole = true;
          else for (const x of p) props.add(x);
        }
        mark(imp.target, whole ? 'all' : props);
      }
    }
  }
  for (const t of i.dynamicAll) mark(t, 'all');
  for (const re of i.reexports) {
    if (re.star) {
      if (isAll) mark(re.target, 'all');
      else mark(re.target, u);
    } else if (re.nsAlias) {
      if (isAll || u.has(re.nsAlias)) mark(re.target, 'all');
    } else {
      const names = re.pairs.filter((p) => isAll || u.has(p.alias)).map((p) => p.orig);
      if (names.length) mark(re.target, names);
    }
  }
}

const srcAll = [...fileSet].filter((f) => f.startsWith('src/') && !f.endsWith('.d.ts'));
const deadFiles = srcAll.filter((f) => !isTest(f) && !live.has(f)).sort();
const deadSet = new Set(deadFiles);
// Exports inutilisés dans les fichiers vivants (hors racines)
const unusedExports = [];
for (const f of srcAll) {
  if (isTest(f) || !live.has(f)) continue;
  const u = used.get(f);
  if (u === 'all') continue;
  const i = info.get(f);
  if (i.css) continue;
  const names = [...i.exports.keys()].filter((n) => !u.has(n));
  if (names.length) unusedExports.push({ file: f, names });
}
// Tests
const testFiles = [...fileSet].filter((f) => isTest(f) && /\.test\./.test(f));
const deadTests = [];
const mixedTests = [];
for (const t of testFiles) {
  const i = info.get(t);
  if (!i || i.css) continue;
  const deps = new Set([...i.imports.map((x) => x.target), ...i.reexports.map((x) => x.target), ...i.dynamicAll]);
  const dead = [...deps].filter((d) => deadSet.has(d));
  if (!dead.length) continue;
  const liveDeps = [...deps].filter((d) => !deadSet.has(d) && !isTest(d) && !/^tests\//.test(d));
  (liveDeps.length === 0 ? deadTests : mixedTests).push({ test: t, dead, live: liveDeps });
}
const result = { vivants: live.size, deadFiles, deadTests, mixedTests, unusedExports };
const j = process.argv.indexOf('--json');
if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify(result, null, 2));
console.log(`vivants ${live.size}, fichiers src morts ${deadFiles.length}, tests morts ${deadTests.length}, mixtes ${mixedTests.length}, fichiers vivants avec exports inutilisés ${unusedExports.length} (${unusedExports.reduce((a, x) => a + x.names.length, 0)} noms)`);
