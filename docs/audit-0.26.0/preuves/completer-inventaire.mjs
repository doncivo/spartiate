/* eslint-disable -- Réconciliation mécanique de l'inventaire figé en partie 0. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/preuves/';
const bytes = fs.readFileSync(base + 'tous-fichiers.txt');
const files = bytes.toString(bytes[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const inventory = JSON.parse(fs.readFileSync(base + 'inventaire.json', 'utf8'));
const known = new Set(inventory.map(r => r.fichier));
const missing = files.filter(f => !known.has(f) && /\.(ts|tsx|js|mjs|rs|swift|css|html)$/.test(f) && !f.startsWith('docs/') && !f.startsWith('src-tauri/vendor/'));
for (const fichier of missing) inventory.push({ fichier, statut: 'à lire', motif: 'Ajout partie 1 : source suivie au tag absente de l’inventaire initial.', partie: null, preuve: null });
inventory.sort((a, b) => a.fichier < b.fichier ? -1 : a.fichier > b.fichier ? 1 : 0);
fs.writeFileSync(base + 'inventaire.json', JSON.stringify(inventory, null, 2) + '\n');
const included = inventory.filter(r => r.statut !== 'hors relecture');
const tests = included.filter(r => /\.test\.|\.spec\.|^tests\/|\/tests\//.test(r.fichier));
const summary = { total: included.length, testsEtSupports: tests.length, productionEtOutillage: included.length - tests.length, exclusVendor: inventory.length - included.length };
const previous = fs.existsSync(base + 'inventaire-ajouts-partie1.json') ? JSON.parse(fs.readFileSync(base + 'inventaire-ajouts-partie1.json', 'utf8')).ajouts : [];
fs.writeFileSync(base + 'inventaire-ajouts-partie1.json', JSON.stringify({ ...summary, ajouts: [...new Set([...previous, ...missing])].sort() }, null, 2) + '\n');
console.log(JSON.stringify({ ajouts: missing.length, ...summary }));
