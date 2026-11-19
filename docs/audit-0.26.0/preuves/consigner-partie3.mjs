/* eslint-disable -- Lectures intégrales réellement effectuées, consignées par lot. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/';
const reads = JSON.parse(fs.readFileSync(base + 'preuves/lectures.json', 'utf8'));
const groups = [
  [['src/sync/engine.ts', 'src/sync/status.ts', 'src/sync/maintenance.ts', 'src/domain/syncBanners.ts'], 'Cycle intégral, reprises, publication, entretien, états et choix des bandeaux lus ; état de réintégration transmis au statut, raccordement interface à terminer.'],
  [['src/domain/hlc.ts', 'src/sync/index.ts', 'src/sync/guarded.ts', 'src/sync/dataReset.ts'], 'Horloges, exports, transaction gardée et horizons de remise à zéro intégralement lus ; appelants et persistance à confronter.'],
  [['src/domain/sync/merge.ts', 'src/domain/sync/compat.ts', 'src/domain/sync/limits.ts', 'src/domain/sync/drift.ts'], 'Fusion par champ, bases, conflits, réintégration, plafonds et dérive physique intégralement lus.'],
  [['src/sync/apply.ts', 'src/sync/reader.ts', 'src/sync/repair.ts'], 'Application, savepoints, lignes partielles, tombstones, groupes HLC et curseurs intégralement lus ; vérifications croisées encore ouvertes.'],
  [['src/sync/olderWriter.ts', 'src/domain/sync/schemaRepublish.ts'], 'Conservation des créations incomplètes, détection et republication intégralement lues, confrontées à ADR 0018.'],
  [['src/sync/eligible.ts', 'src/domain/sync/retention.ts'], 'Éligibilité des instantanés, accusés, expiration, purge et ordre des oublis intégralement lus ; contrat natif à vérifier en partie 8b.'],
];
for (const [files, preuve] of groups) for (const fichier of files) {
  const row = { fichier, partie: 3, preuve };
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
