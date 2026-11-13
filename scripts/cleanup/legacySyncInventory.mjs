/* eslint-disable -- outil de nettoyage (CLEAN-02), hors du code de l'app */
// CLEAN-02 : inventaire des tests qui s'appuient sur le banc legacy CircleTasks (D-67) : import direct de tests/fixtures/legacy-schema,
// des dépôts hérités (tâches, projets, espaces, routines, rappels, récurrences, objectifs, checklists), ou du simulateur tests/sim dont
// le schéma par défaut est `legacy`. Classement par famille de scénario (dossier) et par entité héritée appelée.
// Usage : node scripts/cleanup/legacySyncInventory.mjs [--json sortie.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'target', '.codex-tmp', 'legacy-schema']);
const rel = (p) => relative(ROOT, p).split(sep).join('/');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
const ENTITIES = ['tasks', 'projects', 'spaces', 'routines', 'routineLogs', 'reminders', 'recurrences', 'goals', 'checklists', 'checklistItems'];
const LEGACY_IMPORT = /legacy-schema|repositories\/sql\/(task|recurrence|reminder|project|space|routine|goal|checklist)[A-Za-z]*['"]/;
const SIM_IMPORT = /from ['"][./]*(tests\/)?sim(\/[A-Za-z]+)?['"]|from ['"]\.\.\/sim['"]|tests\/sim\//;
const SPARTIATE_SCHEMA = /schema:\s*['"](i0|v\d+)['"]/;
const rows = [];
for (const file of ['src', 'tests', 'scripts'].flatMap((d) => walk(join(ROOT, d)))) {
  const path = rel(file);
  if (path === 'scripts/cleanup/legacySyncInventory.mjs') continue;
  const text = readFileSync(file, 'utf8');
  const legacyImport = LEGACY_IMPORT.test(text);
  const sim = SIM_IMPORT.test(text);
  const entities = ENTITIES.filter((name) => new RegExp(`\\b${name}\\.[a-zA-Z]+\\(`).test(text));
  const spartiateOnly = sim && !legacyImport && entities.length === 0 && SPARTIATE_SCHEMA.test(text);
  if (!legacyImport && entities.length === 0 && !(sim && !spartiateOnly)) continue;
  const family = path.split('/').slice(0, -1).join('/');
  rows.push({ path, family, legacyImport, sim, entities, test: /\.test\.tsx?$/.test(path) });
}
const byFamily = new Map();
for (const row of rows) byFamily.set(row.family, [...(byFamily.get(row.family) ?? []), row]);
const byEntity = new Map(ENTITIES.map((name) => [name, rows.filter((row) => row.entities.includes(name)).length]));
const lines = [`fichiers : ${String(rows.length)} (tests : ${String(rows.filter((r) => r.test).length)}, supports : ${String(rows.filter((r) => !r.test).length)})`, '', 'par famille :'];
for (const [family, list] of [...byFamily].sort((a, b) => b[1].length - a[1].length)) lines.push(`  ${family} : ${String(list.length)}`);
lines.push('', 'par entité héritée appelée :');
for (const [name, count] of byEntity) lines.push(`  ${name} : ${String(count)}`);
process.stdout.write(lines.join('\n') + '\n');
const at = process.argv.indexOf('--json');
if (at > 0) writeFileSync(process.argv[at + 1], JSON.stringify(rows, null, 2));
