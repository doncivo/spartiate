/* eslint-disable -- Inventaire isolé, aucune conclusion juridique automatique. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/preuves/';
const raw = fs.readFileSync(base + 'resultats/cargo-metadata.log', 'utf8').replace(/^\uFEFF/, '');
const line = raw.split(/\r?\n/).find(l => l.startsWith('{"packages":'));
if (!line) throw new Error('Sortie cargo metadata absente');
const data = JSON.parse(line);
const doc = fs.readFileSync('docs/licences.md', 'utf8').toLowerCase();
const packages = data.packages.map(p => ({ nom: p.name, version: p.version, licence: p.license, fichierLicence: p.license_file, source: p.source, citeeLitteralement: doc.includes(p.name.toLowerCase()) }));
const counts = {};
for (const p of packages) counts[p.licence ?? 'non déclarée'] = (counts[p.licence ?? 'non déclarée'] ?? 0) + 1;
fs.writeFileSync(base + 'dependances-rust.json', JSON.stringify({ limite: 'Toutes les cibles du lock résolu, pas seulement les crates embarquées. Une licence alternative permissive ne se confond pas avec une obligation de choisir GPL. Les obligations de notices et la compatibilité finale restent à vérifier dans les artefacts livrés.', packages, licences: counts }, null, 2));
console.log(JSON.stringify({ packages: packages.length, licences: counts, sansLicence: packages.filter(p => !p.licence).map(p => p.nom) }, null, 2));
