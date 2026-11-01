#!/usr/bin/env node
/* global process, console */
// SPA-001a, Méthode D-51 : renommage CircleTasks → Spartiate par table, sur les fichiers SUIVIS par git seulement.
//   node scripts/release/rename.mjs          applique et imprime le rapport (fichiers touchés / occurrences)
//   node scripts/release/rename.mjs --dry    imprime le rapport sans rien écrire
// Idempotent : une seconde exécution ne change rien. Ne lit jamais les données utilisateur (%APPDATA%, iCloud) : seule la liste
// `git ls-files` du dépôt courant est parcourue. Les références CircleTasks protégées (données, provenance) ne sont pas touchées.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Table [ancien, nouveau], du plus spécifique au plus général (matrice identité → consommateurs de SPA-001). */
export const RULES = [
  ['fr.circletasks.planner', 'fr.spartiate.app'],
  ['fr.circletasks.source', 'fr.spartiate.source'],
  ['circletasks_lib', 'spartiate_lib'],
  ['circletasks-releases', 'spartiate-releases'],
  ['CircleTasks', 'Spartiate'],
  ['CIRCLETASKS', 'SPARTIATE'],
  ['circletasks', 'spartiate'],
];

export const NEW_VERSION = '0.1.0';

/** Jamais touchés : fiches d'agents, consignes (fusion manuelle D-42, protection des données des deux apps), outillage de contrôle. */
const NEVER = [/^\.claude\//, /^CLAUDE\.md$/, /^AGENTS\.md$/, /^scripts\/release\/(rename\.mjs|rename\.test\.ts|identity\.test\.ts|agents\.test\.ts|docs-paths\.test\.ts|prd-split\.test\.ts)$/, /^scripts\/release\/lib\//, /^scripts\/release\/fixtures\//];
/** docs/ est exempt (D-41 et archives), sauf les trois guides nommés par la matrice. */
const DOCS_RENAMED = new Set(['docs/install-iphone.md', 'docs/install-pc.md', 'docs/release-pc.md']);
/** Phrases de provenance : le nom CircleTasks y reste (« repris de CircleTasks (ADR 00xx) », « fork de CircleTasks »). */
const PROVENANCE = /\b(repris(?:e|es)?|issu(?:e|es|s)?|hérit\w+|dérivé\w*|fork|copie)\s+(?:de|du|des|d['’])\s*CircleTasks/g;
/** Marque temporaire des phrases protégées (caractère d'usage privé Unicode, absent des sources). */
const MARK = '';
/** Constantes du protocole de synchro (D-26) : le sel HKDF reste « circletasks », sinon toute clé dérivée et tout fichier chiffré changent. Ligne intacte. */
const PROTOCOL_LINE = /HKDF(?:_SALT)?/;
const BINARY_EXT = /\.(png|jpe?g|gif|ico|icns|woff2?|ttf|wasm|traineddata|gz|zip|mp3|wav|ogg|pdf|jar|a|so|dll|exe)$/i;

/** @param {string} file */
export function isRenamable(file) {
  if (NEVER.some((re) => re.test(file))) return false;
  if (file.startsWith('docs/')) return DOCS_RENAMED.has(file);
  return !BINARY_EXT.test(file);
}

/**
 * Applique la table à un texte. Les phrases de provenance sont protégées par des marques temporaires.
 * @param {string} file chemin relatif (pose les exemptions)
 * @param {string} text
 * @returns {{ text: string; count: number }}
 */
export function renameText(file, text) {
  if (!isRenamable(file)) return { text, count: 0 };
  const kept = [];
  const keep = (match) => {
    kept.push(match);
    return `${MARK}${kept.length - 1}${MARK}`;
  };
  let work = text.replace(PROVENANCE, keep).replace(/^.*$/gm, (line) => (PROTOCOL_LINE.test(line) ? keep(line) : line));
  let count = 0;
  for (const [from, to] of RULES) {
    work = work.split(from).join('\u0001');
    const parts = work.split('\u0001');
    count += parts.length - 1;
    work = parts.join(to);
  }
  work = work.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i) => kept[Number(i)] ?? '');
  return { text: work, count };
}

/** Version unique 0.1.0 : édition ciblée, idempotente, sans reformater le fichier. */
const VERSION_EDITS = [
  { file: 'package.json', pattern: /^(\s*"version":\s*")[^"]*(")/m },
  { file: 'src-tauri/tauri.conf.json', pattern: /^(\s*"version":\s*")[^"]*(")/m },
  { file: 'src-tauri/Cargo.toml', pattern: /^(\[package\][\s\S]*?\nversion = ")[^"]*(")/ },
  { file: 'src-tauri/Cargo.lock', pattern: /(\[\[package\]\]\r?\nname = "spartiate"\r?\nversion = ")[^"]*(")/ },
];

/** @param {string} text */
function setLockVersion(text) {
  const lock = JSON.parse(text);
  if (lock.version === NEW_VERSION && lock.packages?.['']?.version === NEW_VERSION) return text;
  lock.version = NEW_VERSION;
  if (lock.packages?.['']) lock.packages[''].version = NEW_VERSION;
  return JSON.stringify(lock, null, 2) + (text.endsWith('\n') ? '\n' : '');
}

/**
 * @param {{ cwd: string; write: boolean }} options
 * @returns {{ files: number; occurrences: number; touched: { file: string; count: number }[] }}
 */
export function runRename({ cwd, write }) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  const touched = [];
  for (const file of tracked) {
    const path = join(cwd, file);
    let buffer;
    try {
      buffer = readFileSync(path);
    } catch {
      continue; // fichier suivi mais absent du disque
    }
    if (buffer.includes(0)) continue; // binaire
    const original = buffer.toString('utf8');
    let { text, count } = renameText(file, original);
    const edit = VERSION_EDITS.find((e) => e.file === file);
    if (edit && edit.pattern.test(text)) {
      const next = text.replace(edit.pattern, `$1${NEW_VERSION}$2`);
      if (next !== text) count += 1;
      text = next;
    }
    if (file === 'package-lock.json') {
      const next = setLockVersion(text);
      if (next !== text) count += 1;
      text = next;
    }
    if (text !== original) {
      touched.push({ file, count });
      if (write) writeFileSync(path, text);
    }
  }
  return { files: touched.length, occurrences: touched.reduce((n, t) => n + t.count, 0), touched };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const dry = process.argv.includes('--dry');
  const report = runRename({ cwd: process.cwd(), write: !dry });
  console.log(`# Rapport rename.mjs${dry ? ' (--dry, rien écrit)' : ''}`);
  console.log(`fichiers touchés : ${report.files} · occurrences : ${report.occurrences}`);
  console.log('| fichier | occurrences |\n| --- | ---: |');
  for (const t of report.touched) console.log(`| ${t.file} | ${t.count} |`);
}
