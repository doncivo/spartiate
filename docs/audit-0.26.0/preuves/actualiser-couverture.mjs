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
const note = `${readCount}/${total} fichiers lus (${(100 * readCount / total).toFixed(2)} %). « Lu » indique une lecture complète dans la passe précisée, pas la validation de tous les scénarios métier. Les lectures partielles et scans ne sont pas comptés.\n\n`;
const rows = inventory.map(r => `| \`${r.fichier}\` | ${r.statut} | ${r.preuve ? `Partie ${r.partie} : ${r.preuve}` : r.motif ?? ''} |`).join('\n');
fs.writeFileSync(base + 'couverture.md', title + note + '| Fichier | Statut | Motif / preuve |\n| --- | --- | --- |\n' + rows + '\n');
console.log(JSON.stringify({ readCount, total }));
