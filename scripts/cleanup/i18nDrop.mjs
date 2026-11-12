/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : retire de src/i18n/fr.ts des groupes de premier niveau (propriétés de l'objet `fr`) et supprime les modules de catalogue
// (fr.xxx.ts) qui ne sont plus importés par personne. tsc dit ensuite si un groupe était encore lu.
// Usage : node scripts/cleanup/i18nDrop.mjs groupe [groupe...]
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..', '..');
const FR = join(ROOT, 'src/i18n/fr.ts');
const groups = new Set(process.argv.slice(2));
const text = readFileSync(FR, 'utf8');
const sf = ts.createSourceFile('fr.ts', text, ts.ScriptTarget.ES2022, true);
const cuts = [];
let removedVars = new Set();
sf.forEachChild((st) => {
  if (ts.isVariableStatement(st) && st.declarationList.declarations[0]?.name.getText() === 'fr') {
    const obj = st.declarationList.declarations[0].initializer;
    const lit = ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj) ? obj.expression : obj;
    for (const p of lit.properties) {
      const name = p.name?.getText();
      if (!groups.has(name)) continue;
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer)) removedVars.add(p.initializer.text);
      // inclut les commentaires qui précèdent (// ...) collés à la propriété
      cuts.push([p.getFullStart(), p.end + (text[p.end] === ',' ? 1 : 0)]);
    }
  }
});
let out = text;
for (const [a, b] of cuts.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + out.slice(b);
// retire les imports dont l'identifiant n'est plus utilisé
const sf2 = ts.createSourceFile('fr.ts', out, ts.ScriptTarget.ES2022, true);
const importCuts = [];
const droppedModules = [];
for (const st of sf2.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue;
  const names = st.importClause.namedBindings.elements.map((e) => e.name.text);
  const body = out.slice(st.end);
  const unused = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(body));
  if (unused.length === names.length) {
    importCuts.push([st.getFullStart(), st.end]);
    droppedModules.push(st.moduleSpecifier.text);
  }
}
for (const [a, b] of importCuts.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + out.slice(b);
writeFileSync(FR, out.replace(/^\r?\n/, ''));
// supprime les modules de catalogue plus importés par aucun fichier
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}
const files = walk(join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f));
for (const spec of droppedModules) {
  const target = resolve(dirname(FR), spec);
  const file = [target + '.ts', target + '.tsx'].find(existsSync);
  if (!file) continue;
  const base = spec.split('/').pop();
  const stillUsed = files.some((f) => f !== file && new RegExp(`from\\s+['"][^'"]*/${base}['"]|import\\(['"][^'"]*/${base}['"]\\)`).test(readFileSync(f, 'utf8')));
  if (!stillUsed) {
    unlinkSync(file);
    console.log('supprimé', file.replace(ROOT, ''));
  } else console.log('conservé (encore importé)', spec);
}
console.log(`groupes retirés : ${cuts.length}`);
