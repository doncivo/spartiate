/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
import fs from 'node:fs';
import path from 'node:path';
const base = 'C:/Dev/spartiate-codex/docs/audit-0.26.0/preuves';
const dir = path.join(base, '.runtime/ci-artefacts/couverture-html');
const rows = [];
function parse(file) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<tr>\s*<td class="file [^"]+" data-value="([^"]+)">([\s\S]*?)<\/tr>/g)) {
    const values = [...match[2].matchAll(/class="pct [^"]+">([\d.]+)%/g)].map(m => Number(m[1]));
    const fractions = [...match[2].matchAll(/class="abs [^"]+">(\d+)\/(\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    if (values.length !== 4 || fractions.length !== 4) throw new Error('Format couverture inattendu : ' + file);
    const module = path.relative(dir, path.dirname(file)).replaceAll('\\', '/');
    rows.push({ fichier: module ? module + '/' + match[1] : match[1], type: module ? 'fichier' : 'dossier', instructions: values[0], branches: values[1], fonctions: values[2], lignes: values[3], fractions });
  }
}
parse(path.join(dir, 'index.html'));
for (const row of [...rows]) {
  const index = path.join(dir, row.fichier, 'index.html');
  if (fs.existsSync(index)) parse(index);
}
fs.writeFileSync(path.join(base, 'couverture-ci.json'), JSON.stringify(rows, null, 2));
const headers = ['# Couverture CI par module', '', 'Run 43801990156, SHA 8686a8fc2860f7a94eb193426cbcc640a33bac80. Mesure instrumentée, distincte de la couverture de relecture et de la qualité des assertions.', '', '| Dossier | Instructions % | Branches % | Fonctions % | Lignes % |', '| --- | --- | --- | --- | --- |'];
for (const r of rows.filter(r => r.type === 'dossier')) headers.push(`| ${r.fichier} | ${r.instructions} | ${r.branches} | ${r.fonctions} | ${r.lignes} |`);
fs.writeFileSync(path.join(base, '../couverture-ci.md'), headers.join('\n') + '\n');
fs.copyFileSync(path.join(base, '.runtime/ci-artefacts/perf-mesures/playwright-report.json'), path.join(base, 'perf-ci.json'));
