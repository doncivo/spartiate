/* global process, console */
// BL-043 : avis de licence des composants tiers livrés (npm de production, crates compilées pour Windows ou l'iPhone).
//   node scripts/release/third-party-notices.mjs --write   réécrit public/THIRD-PARTY-NOTICES.txt
//   node scripts/release/third-party-notices.mjs --check   échoue si le fichier ne correspond plus au verrou (CI, job cargo audit)
// Vite copie public/ dans dist/ : le fichier est donc embarqué dans l'installeur PC et dans l'IPA. Mécanique (D-51), sans dépendance.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOTICES_PATH = 'public/THIRD-PARTY-NOTICES.txt';
const TARGETS = ['x86_64-pc-windows-msvc', 'aarch64-apple-ios'];
const LICENCE_FILE = /^(licen[cs]e|copying|unlicense|notice)/i;

const normalise = (text) => text.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Textes de licence d'un dossier de sources (fichiers LICENSE*, COPYING*, UNLICENSE*, NOTICE*), ou null. */
function licenceText(dir) {
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir)
    .filter((n) => LICENCE_FILE.test(n) && statSync(join(dir, n)).isFile())
    .sort(compare);
  if (names.length === 0) return null;
  return names.map((n) => normalise(readFileSync(join(dir, n), 'utf8'))).join('\n\n');
}

/** composants : [{ ecosystem: 'npm' | 'cargo', name, version, license, text | null }] → texte final, déterministe. */
export function renderNotices(components) {
  const list = [...components].sort((a, b) => compare(`${a.ecosystem} ${a.name} ${a.version}`, `${b.ecosystem} ${b.name} ${b.version}`));
  const groups = new Map();
  const without = [];
  const out = [
    'Avis de licence des composants tiers livrés dans Spartiate',
    '',
    'Fichier généré par scripts/release/third-party-notices.mjs : ne pas modifier à la main (node scripts/release/third-party-notices.mjs --write).',
    "Il couvre les dépendances npm de production et les crates compilées pour Windows et pour l'iPhone.",
    '',
    '== Composants (écosystème, nom, version : licence déclarée) ==',
    '',
  ];
  for (const c of list) {
    out.push(`${c.ecosystem} ${c.name} ${c.version} : ${c.license ?? 'licence non déclarée'}`);
    if (c.text === null || c.text === undefined) {
      without.push(c);
      continue;
    }
    const text = normalise(c.text);
    const key = createHash('sha256').update(text).digest('hex');
    if (!groups.has(key)) groups.set(key, { text, users: [] });
    groups.get(key).users.push(`${c.name} ${c.version}`);
  }
  const mpl = list.filter((c) => /MPL-2\.0/.test(c.license ?? ''));
  if (mpl.length > 0) {
    out.push('', '== Code sous MPL-2.0 : sources disponibles ==', '');
    out.push('Ces composants sont livrés sans modification ; leur code source est disponible aux adresses suivantes :');
    for (const c of mpl) {
      out.push(c.ecosystem === 'cargo' ? `- ${c.name} ${c.version} : https://crates.io/crates/${c.name}/${c.version}` : `- ${c.name} ${c.version} : https://www.npmjs.com/package/${c.name}/v/${c.version}`);
    }
  }
  if (without.length > 0) {
    out.push('', '== Composants sans fichier de licence dans leurs sources ==', '');
    out.push('Licence déclarée par le composant (champ « license » de son manifeste) ; son texte est celui du modèle publié sous cet identifiant SPDX :');
    for (const c of without) out.push(`- ${c.name} ${c.version} : ${c.license ?? 'licence non déclarée'} (aucun fichier de licence dans les sources)`);
  }
  out.push('', '== Textes de licence ==');
  const ordered = [...groups.values()].sort((a, b) => compare(a.users[0], b.users[0]));
  ordered.forEach((g, i) => {
    out.push('', `----- Texte ${i + 1} : ${g.users.length} composant(s) -----`, g.users.join(', '), '', g.text);
  });
  return `${out.join('\n')}\n`;
}

function npmComponents(root) {
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const found = [];
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    if (!key.startsWith('node_modules/') || entry.dev === true || entry.link === true) continue;
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!entry.version) throw new Error(`version absente du verrou : ${key}`);
    found.push({ ecosystem: 'npm', name, version: entry.version, license: entry.license ?? null, text: licenceText(resolve(root, key)) });
  }
  return found;
}

function cargoComponents(root, offline) {
  const byId = new Map();
  for (const target of TARGETS) {
    const args = ['metadata', '--locked', '--format-version', '1', '--filter-platform', target, ...(offline ? ['--offline'] : [])];
    const run = spawnSync('cargo', args, { cwd: resolve(root, 'src-tauri'), encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    if (run.status !== 0) throw new Error(`cargo metadata a échoué pour ${target} : ${run.stderr || run.error}`);
    const meta = JSON.parse(run.stdout);
    const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
    const packages = new Map(meta.packages.map((p) => [p.id, p]));
    const members = new Set(meta.workspace_members);
    const seen = new Set();
    const queue = [...members];
    while (queue.length > 0) {
      const id = queue.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      for (const dep of nodes.get(id)?.deps ?? []) {
        if (dep.dep_kinds.some((k) => k.kind !== 'dev')) queue.push(dep.pkg);
      }
    }
    for (const id of seen) {
      if (members.has(id)) continue;
      const p = packages.get(id);
      byId.set(`${p.name}@${p.version}`, { ecosystem: 'cargo', name: p.name, version: p.version, license: p.license ?? null, text: licenceText(dirname(p.manifest_path)) });
    }
  }
  return [...byId.values()];
}

export function buildNotices(root, offline = process.env.CT_NOTICES_OFFLINE === '1') {
  return renderNotices([...npmComponents(root), ...cargoComponents(root, offline)]);
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    console.error('usage : third-party-notices.mjs --write | --check');
    process.exit(2);
  }
  const target = resolve(root, NOTICES_PATH);
  const expected = buildNotices(root);
  if (mode === '--write') {
    writeFileSync(target, expected);
    console.log(`${NOTICES_PATH} écrit (${expected.length} caractères)`);
  } else {
    const actual = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actual !== expected) {
      console.log(`::error::${NOTICES_PATH} n'est plus à jour : lancer « node scripts/release/third-party-notices.mjs --write » et commiter`);
      process.exit(1);
    }
    console.log(`${NOTICES_PATH} à jour`);
  }
}
