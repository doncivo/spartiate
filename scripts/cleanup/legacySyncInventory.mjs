/* eslint-disable -- outil de nettoyage (CLEAN-02), hors du code de l'app */
// CLEAN-02 : inventaire des tests qui s'appuient sur le banc legacy de l'ancien projet (D-67) : import direct de tests/fixtures/legacy-schema,
// des dépôts hérités (tâches, projets, espaces, routines, rappels, récurrences, objectifs, checklists), ou du simulateur tests/sim dont
// le schéma par défaut est `legacy`. Classement par famille de scénario (dossier) et par entité héritée appelée.
// Usage : node scripts/cleanup/legacySyncInventory.mjs [--json sortie.json | --json -] (`-` : lignes JSON seules sur la sortie standard)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';

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

// CLEAN-03 : un fichier migré déclare le banc Spartiate pour tous ses appareils (`selectSimSchema('i0')`, tests/sim/syncDevice.ts).
const SPARTIATE_SCHEMA = /schema:\s*['"](i0|v\d+)['"]|selectSimSchema\(['"](i0|v\d+)['"]\)/;
// BL-133 : un fichier est « sur le simulateur » s'il ATTEINT `tests/sim/syncDevice.ts` par ses imports relatifs (directement ou par un kit) ;
// les autres modules de tests/sim (codec, dossier simulé, nuage) ne créent aucun appareil et n'ont pas de schéma.
const SIM_DEVICE = 'tests/sim/syncDevice.ts';
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
// BL-133 : méthodes de tableau ou de table : dans un fichier migré, `tasks.push(` sur une variable locale n'est pas un appel du dépôt hérité `tasks`.
const COLLECTION_METHODS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'at', 'slice', 'concat', 'join', 'indexOf', 'includes', 'forEach', 'map', 'filter', 'find', 'findIndex', 'some', 'every', 'reduce', 'sort', 'flatMap', 'get', 'has', 'set', 'add', 'delete', 'clear', 'entries', 'keys', 'values']);
const texts = new Map(['src', 'tests', 'scripts'].flatMap((d) => walk(join(ROOT, d))).map((file) => [rel(file), readFileSync(file, 'utf8')]));
function resolveImport(from, spec) {
  const base = rel(resolve(ROOT, dirname(from), spec));
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base.replace(/\.m?js$/, '.ts')].find((candidate) => texts.has(candidate)) ?? null;
}
const importsOf = new Map([...texts].map(([path, text]) => [path, [...text.matchAll(RELATIVE_IMPORT)].map((m) => resolveImport(path, m[1])).filter((p) => p !== null)]));
const reaching = new Set([SIM_DEVICE]);
for (let grew = true; grew; ) {
  grew = false;
  for (const [path, imports] of importsOf) {
    if (reaching.has(path) || !imports.some((p) => reaching.has(p))) continue;
    reaching.add(path);
    grew = true;
  }
}
const rows = [];
for (const [path, text] of texts) {
  if (path === 'scripts/cleanup/legacySyncInventory.mjs') continue;
  const legacyImport = LEGACY_IMPORT.test(text);
  const sim = path !== SIM_DEVICE && reaching.has(path);
  // Dans un fichier migré seulement (le code hérité du domaine manipule des tableaux nommés comme les dépôts et reste compté).
  const migrated = SPARTIATE_SCHEMA.test(text);
  const entities = ENTITIES.filter((name) => [...text.matchAll(new RegExp(`\\b${name}\\.([a-zA-Z]+)\\(`, 'g'))].some((m) => !(migrated && COLLECTION_METHODS.has(m[1]))));
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
const at = process.argv.indexOf('--json');
if (at > 0 && process.argv[at + 1] === '-') process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
else {
  process.stdout.write(lines.join('\n') + '\n');
  if (at > 0) writeFileSync(process.argv[at + 1], JSON.stringify(rows, null, 2));
}
