/* eslint-disable -- Lectures intégrales réellement effectuées, consignées par lot. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/';
const reads = JSON.parse(fs.readFileSync(base + 'preuves/lectures.json', 'utf8'));
const groups = [
  [fs.readdirSync('src/db/migrations').filter(f => /^(?:00(?:0[1-9]|1[0-9])_[a-z_]+|index)\.ts$/.test(f)).map(f => 'src/db/migrations/' + f), 'DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2.'],
  [['src/db/migrator.ts', 'src/db/migrationBackup.ts'], 'Ordre, sommes, version future, transactions, sauvegarde et réutilisation lus ; sans preuve native nouvelle.'],
  [['src/db/serializedDriver.ts', 'src/db/serializedDriver.test.ts'], 'File, transactions et tests existants intégralement lus ; A-008 reproduit sous rejet de rollback injecté, écriture suivante perdue.'],
  [['src/db/drivers/sqliteWasm.ts', 'src/db/localWrite.ts', 'src/db/repositories/observeWrites.ts'], 'Cache borné des statements, fermeture, signaux et observateurs lus ; effets transactionnels à confronter aux appelants.'],
  [['src/db/repositories/sql/syncUnknown.ts'], 'Réintégration par pages/savepoints, garde et état persistant lus ; nuance la piste de partie 1, affichage à vérifier partie 3.'],
];
for (const [files, preuve] of groups) for (const fichier of files) {
  const row = { fichier, partie: 2, preuve };
  const at = reads.findIndex(r => r.fichier === fichier);
  if (at < 0) reads.push(row); else reads[at] = row;
}
fs.writeFileSync(base + 'preuves/lectures.json', JSON.stringify(reads, null, 2) + '\n');
const inv = JSON.parse(fs.readFileSync(base + 'preuves/inventaire.json', 'utf8'));
const total = inv.filter(r => r.statut !== 'hors relecture').length;
const prodRead = reads.filter(r => !/\.test\.|\.spec\.|^tests\/|\/tests\//.test(r.fichier)).length;
for (const file of ['avancement.md', 'rapport.md']) {
  let text = fs.readFileSync(base + file, 'utf8');
  text = text.replace(/\*\*\d+ \/ 2 047 fichiers (?:lus )?\([\d,]+ %\)\*\*/, `**${reads.length} / 2 047 fichiers lus (${(100 * reads.length / total).toFixed(2).replace('.', ',')} %)**`);
  text = text.replace(/\d+ \/ 1 046/g, `${prodRead} / 1 046`);
  fs.writeFileSync(base + file, text);
}
console.log(JSON.stringify({ lus: reads.length, production: prodRead }));
