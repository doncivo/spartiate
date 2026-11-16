/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
// Graphe syntaxique : imports statiques/dynamiques littéraux, réexports et accès DB.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd(), out = 'docs/audit-0.26.0/preuves/architecture.json';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk('src').filter(f => /\.tsx?$/.test(f) && !/\.test\.|[\\/]testing[\\/]/.test(f));
const edges = [], suspects = [], clocks = [], dbCalls = [], dynamic = [];
const allowed = { domain: ['domain'], db: ['db', 'domain'], sync: ['sync', 'domain', 'db', 'platform', 'i18n'], platform: ['platform', 'domain', 'db', 'sync', 'i18n'], i18n: ['i18n', 'domain'], ui: ['ui', 'domain', 'i18n'] };
const relative = f => path.relative(root, path.resolve(f)).replaceAll('\\', '/');
for (const file of files) {
  const f = relative(file), layer = f.split('/')[1];
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const loc = n => ({ fichier: f, ligne: tree.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
  const edge = (n, spec, kind) => {
    const target = spec.startsWith('.') ? relative(path.resolve(path.dirname(file), spec)) : spec;
    const targetLayer = target.startsWith('src/') ? target.split('/')[1] : null;
    const e = { ...loc(n), cible: target, type: kind };
    edges.push(e);
    if (targetLayer && allowed[layer] && !allowed[layer].includes(targetLayer)) suspects.push(e);
    if (spec.startsWith('@tauri-apps/') && layer !== 'platform') suspects.push(e);
    if (layer === 'domain' && /^(react|react-dom)(\/|$)/.test(spec)) suspects.push(e);
    if (layer === 'features' && /^src\/(db\/drivers|platform\/tauri)(\/|$)/.test(target)) suspects.push(e);
  };
  const visit = n => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) edge(n, n.moduleSpecifier.text, 'statique');
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(tree);
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = n.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) edge(n, arg.text, 'dynamique');
        else dynamic.push({ ...loc(n), expression: n.getText(tree) });
      }
      if (layer === 'domain' && /^(Date\.now|Math\.random|(?:globalThis\.)?crypto\.(randomUUID|getRandomValues))$/.test(name)) clocks.push({ ...loc(n), appel: name });
      if (layer !== 'db' && /\.(execute|select|transaction)$/.test(name)) dbCalls.push({ ...loc(n), appel: name });
    }
    if (layer === 'domain' && ts.isNewExpression(n) && n.expression.getText() === 'Date' && !n.arguments?.length) clocks.push({ ...loc(n), appel: 'new Date()' });
    ts.forEachChild(n, visit);
  };
  visit(tree);
}
fs.writeFileSync(out, JSON.stringify({ limite: 'Politique conservatrice incluant les dépendances décrites par les avenants ; les exceptions sont à relire. Chemins normalisés sans résoudre les réexports transitifs. Appels DB candidats : le nom de méthode seul ne prouve pas un accès SQL.', files: files.length, edges, suspects, clocks, dbCalls, dynamic }, null, 2));
console.log(JSON.stringify({ files: files.length, edges: edges.length, suspects: suspects.length, clocks: clocks.length, dbCalls: dbCalls.length, dynamic: dynamic.length }));
