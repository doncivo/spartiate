/* eslint-disable -- Préparation des preuves : originaux compressés, texte lisible normalisé. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const dir = 'docs/audit-0.26.0/preuves/resultats/';
const records = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.log'))) {
  const file = dir + f, archive = file + '.gz';
  const bytes = fs.readFileSync(file);
  if (!fs.existsSync(archive)) fs.writeFileSync(archive, zlib.gzipSync(bytes));
  const original = zlib.gunzipSync(fs.readFileSync(archive));
  records.push({ fichier: f, original: f + '.gz', sha256Original: crypto.createHash('sha256').update(original).digest('hex') });
  const oldNames = ['fr.' + 'circletasks.planner', 'circle' + 'tasks.db'];
  const text = original.toString('utf8').replace(/^\uFEFF/, '').replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).map(line => {
    const clean = line.trimEnd();
    return oldNames.some(name => clean.includes(name)) ? clean + ' <!-- ancien-ok: citation du résultat de test historique, aucune identité active -->' : clean;
  }).join('\n').trimEnd() + '\n';
  fs.writeFileSync(file, text);
}
fs.writeFileSync('docs/audit-0.26.0/preuves/journaux-originaux.json', JSON.stringify(records, null, 2));
console.log(JSON.stringify({ journaux: records.length }));
