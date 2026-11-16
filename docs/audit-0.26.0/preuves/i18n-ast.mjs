/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
// Analyse syntaxique indépendante ; aucune exécution de module applicatif.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
const out = path.join(root, 'docs/audit-0.26.0/preuves');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(path.join(root, 'src')).filter(f => /\.tsx?$/.test(f) && !/\.(test|spec)\.|[\\/]testing[\\/]/.test(f));
const trees = new Map(files.map(f => [f, ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)]));
const visit = (n, fn) => { fn(n); ts.forEachChild(n, c => visit(c, fn)); };
const unwrap = n => n && (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) ? unwrap(n.expression) : n;
const catalogues = new Map();
const bindings = new Map();
const unresolved = [];
function fields(n, prefix = '') {
  n = unwrap(n);
  if (!n || !ts.isObjectLiteralExpression(n)) return [];
  return n.properties.flatMap(p => {
    if (!ts.isPropertyAssignment(p)) { unresolved.push(p.getText()); return []; }
    const key = prefix + p.name.getText().replace(/^['"]|['"]$/g, '');
    const value = unwrap(p.initializer);
    if (ts.isStringLiteralLike(value)) return [key];
    if (ts.isObjectLiteralExpression(value)) return fields(value, key + '.');
    unresolved.push(key + ':' + value.getText());
    return [];
  });
}
for (const [f, tree] of trees) {
  if (!f.includes(path.sep + 'i18n' + path.sep)) continue;
  const local = new Map();
  bindings.set(f, local);
  visit(tree, n => {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      const keys = fields(n.initializer);
      if (keys.length) {
        const id = path.relative(root, f).replaceAll('\\', '/') + ':' + n.name.getText();
        catalogues.set(id, { fichier: path.relative(root, f).replaceAll('\\', '/'), keys });
        local.set(n.name.getText(), id);
      }
    }
  });
}
for (const [f, tree] of trees) {
  const local = bindings.get(f) ?? new Map();
  bindings.set(f, local);
  for (const n of tree.statements) {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteral(n.moduleSpecifier)) continue;
    const target = path.resolve(path.dirname(f), n.moduleSpecifier.text) + '.ts';
    const named = n.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const b of named.elements) {
      const id = bindings.get(target)?.get((b.propertyName ?? b.name).text);
      if (id) local.set(b.name.text, id);
    }
  }
}
const wrappers = new Map();
for (const [f, tree] of trees) {
  if (!f.includes(path.sep + 'i18n' + path.sep)) continue;
  visit(tree, n => {
    if (!ts.isFunctionDeclaration(n) || !n.name || !n.body) return;
    const cats = new Set();
    visit(n.body, c => {
      if (ts.isElementAccessExpression(c) && ts.isIdentifier(c.expression) && bindings.get(f)?.has(c.expression.text)) cats.add(bindings.get(f).get(c.expression.text));
    });
    if (cats.size === 1) wrappers.set(n.name.text, [...cats][0]);
  });
}
const uses = new Map([...catalogues].map(([name]) => [name, new Set()]));
const missing = [], dynamic = [], jsx = [];
for (const [f, tree] of trees) {
  if (/[\\/]i18n[\\/]fr(?:\.[^.]+)?\.ts$/.test(f)) continue;
  const loc = n => ({ fichier: path.relative(root, f).replaceAll('\\', '/'), ligne: tree.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
  visit(tree, n => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && wrappers.has(n.expression.text)) {
      const cat = wrappers.get(n.expression.text), arg = n.arguments[0];
      if (arg && ts.isStringLiteralLike(arg)) {
        uses.get(cat).add(arg.text);
        if (!catalogues.get(cat).keys.includes(arg.text)) missing.push({ ...loc(n), fonction: n.expression.text, cle: arg.text, catalogue: cat });
      } else dynamic.push({ ...loc(n), fonction: n.expression.text, argument: arg?.getText() });
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && bindings.get(f)?.has(n.expression.text)) uses.get(bindings.get(f).get(n.expression.text)).add(n.name.text);
    if (ts.isJsxText(n) && /[A-Za-zÀ-ÿ]{2}/.test(n.text.trim())) jsx.push({ ...loc(n), texte: n.text.trim() });
    if (ts.isJsxAttribute(n) && /^(title|placeholder|aria-label|alt)$/.test(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer) && /[A-Za-zÀ-ÿ]{2}/.test(n.initializer.text)) jsx.push({ ...loc(n), attribut: n.name.getText(), texte: n.initializer.text });
  });
}
const result = {
  limites: 'Appels directs aux fonctions reconnues seulement ; alias, tables et accès dynamiques non résolus. Les clés non vues sont des candidats, jamais une preuve de code mort. Les objets importés de fr.ts ne sont pas réassemblés.',
  catalogues: [...catalogues].map(([nom, c]) => ({ nom, fichier: c.fichier, cles: c.keys.length, nonVues: c.keys.filter(k => !uses.get(nom).has(k)) })),
  wrappers: Object.fromEntries(wrappers), missing, dynamic, jsx, unresolved,
};
fs.writeFileSync(path.join(out, 'i18n-ast.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ catalogues: catalogues.size, wrappers: wrappers.size, missing: missing.length, dynamic: dynamic.length, jsx: jsx.length, unresolved: unresolved.length }));
