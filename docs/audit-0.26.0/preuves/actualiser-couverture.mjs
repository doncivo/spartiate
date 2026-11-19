/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/';
const read = f => JSON.parse(fs.readFileSync(base + f, 'utf8').replace(/^\uFEFF/, ''));
const inventory = read('preuves/inventaire.json');
const readings = read('preuves/lectures.json');
for (const r of readings) {
  const row = inventory.find(i => i.fichier === r.fichier);
  if (!row) throw new Error('Fichier absent de l’inventaire : ' + r.fichier);
  Object.assign(row, r, { statut: 'lu', motif: '' });
}
fs.writeFileSync(base + 'preuves/inventaire.json', JSON.stringify(inventory, null, 2));
const total = inventory.filter(r => r.statut !== 'hors relecture').length;
const readCount = inventory.filter(r => r.statut === 'lu').length;
const title = '# Couverture de relecture — AUDIT-0.26.0\n\nSHA : `8686a8fc2860f7a94eb193426cbcc640a33bac80`.\n';
const production = inventory.filter(r => r.statut !== 'hors relecture' && !/\.test\.|\.spec\.|^tests\/|\/tests\//.test(r.fichier));
const note = `${readCount}/${total} fichiers lus (${(100 * readCount / total).toFixed(2)} %). « Lu » indique une lecture complète dans la passe précisée, pas la validation de tous les scénarios métier. Les lectures partielles et scans ne sont pas comptés.\n\nProduction et outillage : ${production.filter(r => r.statut === 'lu').length}/${production.length} lus intégralement. Tests et supports : ${total - production.length} fichiers ; partie 11 par outils, lecture complète des règles critiques et échantillon motivé du reste (décision d’Ali des 16 et 19/11). Inventaire corrigé en partie 1 : 389 ajouts, dont 33 de production/outillage et 356 de tests/supports ; les 645 tests du compteur initial n’incluaient pas tout le banc. Les 81 fichiers vendored exclus restent listés. Configurations déclaratives et documents consultés sont cités dans les rapports de partie, hors de ce décompte de sources.\n\n`;
const rows = inventory.map(r => `| \`${r.fichier}\` | ${r.statut} | ${r.preuve ? `Partie ${r.partie} : ${r.preuve}` : r.motif ?? ''} |`).join('\n');
fs.writeFileSync(base + 'couverture.md', title + note + '| Fichier | Statut | Motif / preuve |\n| --- | --- | --- |\n' + rows + '\n');
console.log(JSON.stringify({ readCount, total }));
