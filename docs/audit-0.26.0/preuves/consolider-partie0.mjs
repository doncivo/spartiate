/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/preuves/';
const read = f => fs.readFileSync(base + f, 'utf8').replace(/^\uFEFF/, '');
const write = (f, data) => fs.writeFileSync(base + f, JSON.stringify(data, null, 2));
const failures = JSON.parse(read('unitaires-echecs.json'));
write('unitaires-resume.json', failures.map(x => ({ fichier: x.fichier, test: x.test, erreurs: x.erreurs.map(e => e.split('\n')[0]), positions: x.erreurs.flatMap(e => [...e.matchAll(/spartiate-codex\/(.*?\.(?:test|spec)\.tsx?):(\d+):(\d+)/g)].map(m => `${m[1]}:${m[2]}`)) })));
const audit = JSON.parse(read('resultats/cargo-audit.log').trim());
write('cargo-alertes.json', {
  database: audit.database, dependencyCount: audit.lockfile['dependency-count'],
  vulnerabilites: audit.vulnerabilities.list.map(v => ({ id: v.advisory.id, paquet: v.package.name, version: v.package.version, titre: v.advisory.title, corrige: v.versions.patched })),
  avertissements: Object.entries(audit.warnings).flatMap(([kind, values]) => values.map(v => ({ kind, paquet: v.package.name, version: v.package.version, id: v.advisory?.id, corrige: v.versions?.patched }))),
});
const results = fs.readdirSync(base + 'resultats').filter(f => f.endsWith('.json')).map(f => JSON.parse(read('resultats/' + f)));
write('commandes.json', results);
const lines = ['# Commandes de la partie 0', '', 'Les échecs de lancement et de préparation restent conservés. Un code 0 ne supprime pas les avertissements.', '', '| Commande | Code | Durée (s) | Preuve |', '| --- | --- | --- | --- |'];
for (const r of results) lines.push(`| ${r.nom} | ${r.code ?? 'en cours'} | ${r.fin ? ((Date.parse(r.fin) - Date.parse(r.debut)) / 1000).toFixed(1) : '—'} | preuves/resultats/${r.nom}.json |`);
fs.writeFileSync(base + '../commandes.md', lines.join('\n') + '\n');
for (const file of fs.readdirSync(base).filter(f => f.endsWith('.mjs'))) {
  const text = fs.readFileSync(base + file, 'utf8');
  if (!text.startsWith('/* eslint-disable')) fs.writeFileSync(base + file, "/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */\n" + text);
}
console.log(JSON.stringify({ commandes: results.length, echecsUnitaires: failures.length, cargo: audit.vulnerabilities.count }));
