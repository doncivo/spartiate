#!/usr/bin/env node
/* global console, process, URL */
// SHELL-0295 (BL-044, D-641) : relevé par script des « skip » conditionnels, pauses et plafonds de délai des tests (D-51).
// `node scripts/release/test-markers.mjs` imprime le relevé par module ; `--check` compare à tests/test-markers.json (exact dans les deux
// sens) ; `--write` réécrit la liste (un ajout se justifie dans le commit qui la réécrit).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASELINE = 'tests/test-markers.json';
const KINDS = ['skipProjet', 'skipCondition', 'pause', 'plafond', 'interdit'];

/** Genre d'une ligne : skip filtré par projet Playwright, skip sur une autre condition, pause fixe, plafond de délai, marqueur interdit. */
export function classifyLine(line) {
  // Motif cité entre guillemets (garde qui le cherche comme donnée) : pas un appel.
  if (/(?<![\w'"`/.])(?:(?:test|it|describe)\.(?:only|fixme|todo)|xit)\(/.test(line)) return 'interdit';
  if (/(?<![\w'"`/.])(?:test|it|describe)\.(?:skip|skipIf|runIf)\(/.test(line)) return /isPhone|isPc|isMobile|projectName|project\.name|browserName/.test(line) ? 'skipProjet' : 'skipCondition';
  if (/\bwaitForTimeout\(|setTimeout\(\s*(?:r|res|resolve|done)\s*,|=>\s*setTimeout\(\s*(?:r|res|resolve|done)\b/.test(line)) return 'pause';
  if (/\btestTimeout\s*:|\btimeout\s*:\s*[\d_]+|\b(?:test|it)\.setTimeout\(|\btest\.slow\(/.test(line)) return 'plafond';
  return null;
}

/** Fichiers de test suivis par git (et aides de tests/), hors ce relevé et ses gardes, qui citent les motifs comme données. */
const SELF = new Set(['scripts/release/test-markers.mjs', 'scripts/release/testMarkers.test.ts', 'tests/unit/testIsolation.test.ts']);
function testFiles(root) {
  return execFileSync('git', ['ls-files', 'src', 'tests', 'scripts'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => !SELF.has(f) && (/\.(?:test|spec)\.(?:ts|tsx|mjs)$/.test(f) || (/^tests\//.test(f) && /\.(?:ts|tsx|mjs)$/.test(f))));
}

export function collectMarkers(root) {
  const out = [];
  for (const file of testFiles(root)) {
    readFileSync(resolve(root, file), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(?:\/\/|\*)/.test(line)) return;
      const kind = classifyLine(line);
      if (kind) out.push({ file, line: i + 1, kind });
    });
  }
  return out;
}

export function countByFile(markers) {
  const files = {};
  for (const m of markers) {
    files[m.file] ??= {};
    files[m.file][m.kind] = (files[m.file][m.kind] ?? 0) + 1;
  }
  return Object.fromEntries(Object.keys(files).sort().map((f) => [f, Object.fromEntries(KINDS.filter((k) => files[f][k]).map((k) => [k, files[f][k]]))]));
}

/** Écarts « fichier : genre avant → après », triés. */
export function compareBaseline(current, baseline) {
  const diffs = [];
  const names = [...new Set([...Object.keys(current), ...Object.keys(baseline.fichiers ?? {})])].sort();
  for (const f of names) {
    for (const k of KINDS) {
      const a = baseline.fichiers?.[f]?.[k] ?? 0;
      const b = current[f]?.[k] ?? 0;
      if (a !== b) diffs.push(`${f} : ${k} ${String(a)} → ${String(b)}`);
    }
  }
  return diffs;
}

const moduleKey = (file) => file.split('/').slice(0, file.startsWith('tests/') ? 2 : 3).join('/').replace(/\.[^/]*$/, '');

function totals(markers) {
  return Object.fromEntries(KINDS.map((k) => [k, markers.filter((m) => m.kind === k).length]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
  const markers = collectMarkers(root);
  const current = countByFile(markers);
  if (process.argv.includes('--write')) {
    writeFileSync(resolve(root, BASELINE), `${JSON.stringify({ version: 1, totaux: totals(markers), fichiers: current }, null, 2)}\n`);
    console.log(`${BASELINE} réécrit`);
  } else if (process.argv.includes('--check')) {
    const diffs = compareBaseline(current, JSON.parse(readFileSync(resolve(root, BASELINE), 'utf8')));
    if (diffs.length > 0) {
      console.error(`Relevé différent de ${BASELINE} (justifier puis --write) :\n${diffs.join('\n')}`);
      process.exit(1);
    }
    console.log('relevé conforme');
  } else {
    const byModule = {};
    for (const m of markers) {
      const key = moduleKey(m.file);
      byModule[key] ??= Object.fromEntries(KINDS.map((k) => [k, 0]));
      byModule[key][m.kind] += 1;
    }
    console.log(`| Module | ${KINDS.join(' | ')} |\n|---|${KINDS.map(() => '---').join('|')}|`);
    for (const key of Object.keys(byModule).sort()) console.log(`| ${key} | ${KINDS.map((k) => byModule[key][k]).join(' | ')} |`);
    console.log(`| total | ${KINDS.map((k) => totals(markers)[k]).join(' | ')} |`);
  }
}
