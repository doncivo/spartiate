/* eslint-disable -- Inventaire autonome d'audit, hors CI. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = ['src', 'tests', 'scripts'].flatMap(walk).filter(f => /\.(test|spec)\.tsx?$/.test(f));
files.push(...fs.readdirSync('.').filter(f => /^(vitest|playwright).*config\.ts$/.test(f)));
const markers = [], timeouts = [];
for (const f of files) {
  const tree = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  const item = n => ({ fichier: f.replaceAll('\\', '/'), ligne: tree.getLineAndCharacterOfPosition(n.getStart()).line + 1, extrait: n.getText(tree).slice(0, 650) });
  const visit = n => {
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(tree);
      if (/^(?:test|it|describe)\.(skip|skipIf|runIf|fixme|only|todo|slow)(?:\b|\()/.test(name) || /^(xit|xtest|xdescribe|fit|fdescribe)$/.test(name)) markers.push(item(n));
      if (/(?:^|\.)(setTimeout|waitForTimeout|slow)$/.test(name) || (/^(test|it|describe)(\.|$)/.test(name) && n.arguments.length >= 3 && ts.isNumericLiteral(n.arguments[2]))) timeouts.push(item(n));
    }
    if (ts.isPropertyAssignment(n) && /^(?:testTimeout|hookTimeout|timeout|retries)$/.test(n.name.getText(tree))) timeouts.push(item(n));
    ts.forEachChild(n, visit);
  };
  visit(tree);
}
fs.writeFileSync('docs/audit-0.26.0/preuves/marqueurs-tests.json', JSON.stringify({ limite: 'Délais explicites présents au tag ; leur augmentation historique et leur justification demandent lecture des commits. Les extraits sont plafonnés à 650 caractères. Une condition de plateforme n’est pas une désactivation de commodité.', files: files.length, markers, timeouts }, null, 2));
console.log(JSON.stringify({ files: files.length, markers: markers.length, timeouts: timeouts.length }));
