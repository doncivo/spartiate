/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
// Inventaire déterministe de candidats, sans verdict sémantique ni modification de l'application.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'C:/Dev/spartiate-codex';
const out = path.join(root, 'docs/audit-0.26.0/preuves');
const read = f => {
  const b = fs.readFileSync(path.join(root, f));
  return b.toString(b[0] === 255 && b[1] === 254 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '');
};
const files = read('docs/audit-0.26.0/preuves/tous-fichiers.txt').trim().split(/\r?\n/);
const hits = { couleurs: [], textesJsx: [], marqueursTests: [], horlogesDomaine: [], importsDomaine: [], sqlHorsDepot: [], doublonsExacts: [] };
const hashes = new Map();
for (const f of files) {
  if (!/^(src\/|scripts\/|tests\/|\.github\/workflows\/)/.test(f) || !/\.(tsx?|css|m?js|ya?ml)$/.test(f)) continue;
  const text = read(f), isTest = /(?:\.test\.|\.spec\.|^tests\/)/.test(f);
  const hash = crypto.createHash('sha256').update(text.replace(/\r/g, '')).digest('hex');
  if (text.length > 100) hashes.set(hash, [...(hashes.get(hash) ?? []), f]);
  text.split(/\r?\n/).forEach((line, i) => {
    const hit = () => ({ fichier: f, ligne: i + 1, extrait: line.trim().slice(0, 350) });
    if (!isTest && f.startsWith('src/') && !f.endsWith('/tokens.css') && /(?:#[\da-f]{3}(?:[\da-f]{3})?\b|\b(?:rgba?|hsla?)\s*\()/i.test(line)) hits.couleurs.push(hit());
    if (!isTest && f.endsWith('.tsx') && !f.startsWith('src/i18n/') && (/>\s*[A-Za-zÀ-ÿ][^<>{]*\s+[A-Za-zÀ-ÿ][^<>{]*</.test(line) || /(?:aria-label|placeholder|title)="[A-Za-zÀ-ÿ][^"]*"/.test(line))) hits.textesJsx.push(hit());
    if (/(?:\b(?:it|test|describe)\.(?:skip|fixme|only|slow)\b|\b(?:testTimeout|hookTimeout|timeout)\s*:|setTimeout\(|waitForTimeout\()/.test(line)) hits.marqueursTests.push(hit());
    if (!isTest && f.startsWith('src/domain/')) {
      if (/\b(?:Date\.now|Math\.random)\s*\(/.test(line)) hits.horlogesDomaine.push(hit());
      if (/(?:from\s*|import\s*\()['"](?:react|@tauri-apps|.*\/(?:db|features|platform|ui|i18n)(?:\/|['"]))/.test(line)) hits.importsDomaine.push(hit());
    }
    if (!isTest && f.startsWith('src/') && !f.startsWith('src/db/') && /\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(line)) hits.sqlHorsDepot.push(hit());
  });
}
hits.doublonsExacts = [...hashes.values()].filter(group => group.length > 1);
fs.writeFileSync(path.join(out, 'candidats-statiques.json'), JSON.stringify(hits, null, 2));
const manifest = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const licencesDoc = read('docs/licences.md').toLowerCase();
const dependencies = Object.entries(lock.packages ?? {}).filter(([name]) => name).map(([name, p]) => ({
  nom: name.replace(/^.*node_modules\//, ''), version: p.version, dev: p.dev === true,
  licence: p.license ?? 'absente du lockfile', integrite: typeof p.integrity === 'string',
  citeeLitteralement: licencesDoc.includes(name.replace(/^.*node_modules\//, '').toLowerCase()),
}));
fs.writeFileSync(path.join(out, 'dependances-npm.json'), JSON.stringify({
  plagesManifestes: Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).filter(([, v]) => /^[~^*><]|\|\|/.test(v)),
  dependencies,
  limite: 'Les plages des manifestes ne contredisent pas un lockfile figé. Une absence de citation littérale ne prouve pas une licence omise ou incompatible ; examen manuel requis.',
}, null, 2));
fs.writeFileSync(path.join(out, 'scan-resume.json'), JSON.stringify(Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])), null, 2));
