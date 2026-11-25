#!/usr/bin/env node
/* global console, process */
// § 18.4 b (C-194 ; D-626) : icônes de l'app générées depuis content/brand/spartiate.svg par `tauri icon` (CLI déjà installé,
// @tauri-apps/cli ; rendu SVG intégré, aucun outil de plus). Sortie dans .codex-tmp/, puis copie des icônes PC et iPhone vers
// src-tauri/icons (le dossier android/ produit par le CLI est ignoré : aucune cible Android).
// `node scripts/release/generate-icons.mjs` : régénère ; `--check` : compare octet à octet sans écrire (échec si un écart).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICON_SOURCE = 'content/brand/spartiate.svg';
export const ICON_TARGET = 'src-tauri/icons';

export const tauriIconArgs = (out) => ['icon', ICON_SOURCE, '-o', out];

/** Fichiers d'icônes (chemins relatifs, séparateur « / », triés) sous `root`, hors android/. */
export function iconFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full).split('\\').join('/');
      if (rel === 'android' || rel.startsWith('android/')) continue;
      if (statSync(full).isDirectory()) walk(full);
      else out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

// icon.icns (macOS, hors cibles de Spartiate) change d'octets à chaque génération (ordre des images internes) : présence seulement.
export const NON_DETERMINISTIC = new Set(['icon.icns']);

export function compareIcons(generated, target) {
  const gen = iconFiles(generated);
  const tgt = existsSync(target) ? iconFiles(target) : [];
  const different = gen.filter((f) => tgt.includes(f) && !NON_DETERMINISTIC.has(f) && !readFileSync(join(generated, f)).equals(readFileSync(join(target, f))));
  return { different, missing: gen.filter((f) => !tgt.includes(f)), extra: tgt.filter((f) => !gen.includes(f)) };
}

function generate(root) {
  const base = resolve(root, '.codex-tmp');
  mkdirSync(base, { recursive: true });
  const out = mkdtempSync(join(base, 'icons-'));
  execFileSync(process.execPath, [resolve(root, 'node_modules/@tauri-apps/cli/tauri.js'), ...tauriIconArgs(out)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const out = generate(root);
  const target = resolve(root, ICON_TARGET);
  const diff = compareIcons(out, target);
  if (process.argv.includes('--check')) {
    const n = diff.different.length + diff.missing.length + diff.extra.length;
    if (n) {
      console.error(`Icônes à régénérer (node scripts/release/generate-icons.mjs) : ${JSON.stringify(diff)}`);
      process.exit(1);
    }
    console.log(`${iconFiles(out).length} icônes identiques à la génération depuis ${ICON_SOURCE}`);
  } else {
    for (const f of iconFiles(out)) {
      mkdirSync(dirname(join(target, f)), { recursive: true });
      copyFileSync(join(out, f), join(target, f));
    }
    console.log(`${iconFiles(out).length} icônes écrites dans ${ICON_TARGET}${diff.extra.length ? ` ; en trop, à retirer : ${diff.extra.join(', ')}` : ''}`);
  }
}
