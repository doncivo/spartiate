#!/usr/bin/env node
/* global console */
// SPA-001a, D-49 : découpe docs/archive/PRD-v6.2.md en docs/prd/NN-<titre>.md (un chapitre = une section « ## »), après application des
// seules corrections listées dans scripts/release/fixtures/prd-v6.3-changes.json. Rejouable : réécrit les mêmes fichiers.
// L'index docs/prd/README.md et la page docs/PRD.md sont rédigés à la main ; prd-split.test.ts vérifie la conservation du contenu.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyChanges, chapterFileName, parseSections } from './lib/prdSplit.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(join(root, 'docs/archive/PRD-v6.2.md'), 'utf8');
const { changes } = JSON.parse(readFileSync(join(root, 'scripts/release/fixtures/prd-v6.3-changes.json'), 'utf8'));
const sections = parseSections(source);
const outDir = join(root, 'docs/prd');
mkdirSync(outDir, { recursive: true });

sections.forEach((section, index) => {
  const number = /^## (\d+)\./.exec(section.heading)?.[1];
  const key = String(index).padStart(2, '0');
  const body = applyChanges(section.body, changes.filter((c) => c.section === key));
  const file = chapterFileName(section.heading, number === undefined ? index : Number(number));
  writeFileSync(join(outDir, file), body);
  console.log(file);
});
