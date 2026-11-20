/* eslint-disable -- Scan local d'audit ; ne révèle aucune valeur candidate. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base = 'docs/audit-0.26.0/preuves/';
const b = fs.readFileSync(base + 'tous-fichiers.txt');
const tracked = b.toString(b[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === '.runtime' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = [...new Set([...tracked, ...walk('docs/audit-0.26.0')])];
const patterns = [
  ['cle-privee-pem', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['jeton-github', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
  ['cle-api', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g],
  ['cle-aws', /\bAKIA[0-9A-Z]{16}\b/g],
];
const findings = [];
let scanned = 0;
for (const f of files) {
  if (!fs.existsSync(f) || !/\.(?:md|json|txt|log|ts|tsx|mjs|js|rs|toml|yml|yaml|swift|ps1|css|html|env|pem|key)$/.test(f)) continue;
  const data = fs.readFileSync(f, 'utf8');
  scanned++;
  for (const [kind, pattern] of patterns) for (const m of data.matchAll(pattern)) findings.push({ fichier: f.replaceAll('\\', '/'), ligne: data.slice(0, m.index).split('\n').length, type: kind, empreinte: crypto.createHash('sha256').update(m[0]).digest('hex') });
}
fs.writeFileSync(base + 'secrets-candidats.json', JSON.stringify({ limite: 'Motifs de secrets courants dans les fichiers suivis et preuves à pousser ; ni recherche dans les données personnelles ni audit exhaustif de l’historique. Aucun contenu candidat conservé dans ce résultat.', fichiers: scanned, findings }, null, 2));
console.log(JSON.stringify({ fichiers: scanned, candidats: findings.length }));
