#!/usr/bin/env node
/* global process, console, fetch, Buffer */
// Médias d'exercice (I6-07) : Node, aucune dépendance. Script mécanique (D-51), lancé une fois par lot de médias, jamais par l'app.
// Usage : node scripts/content/build-media.mjs
// Lit scripts/content/media-map.json (correspondance relue : exercice → fichier de la source), télécharge chaque fichier au commit
// épinglé de la source (licence vérifiée sur la page du dépôt, docs/licences.md), refuse un fichier qui n'est pas un PNG ou dépasse le
// plafond par média, écrit content/exercises/media/<id>.png, le registre de provenance content/exercises/media/sources.json (empreinte
// SHA-256, taille, chemin d'origine) et les champs `media` de content/exercises/exercises.json. Les fichiers ne sont jamais retouchés
// (copie à l'identique : aucune œuvre adaptée au sens de CC BY-SA 4.0).
// L'app ne télécharge rien : ce script est le seul endroit qui connaît l'adresse de la source.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIA_MAX_BYTES, MEDIA_SOURCES } from './validate-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MEDIA_DIR = join(ROOT, 'content', 'exercises', 'media');
const EXERCISES = join(ROOT, 'content', 'exercises', 'exercises.json');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RAW_BASE = 'https://raw.githubusercontent.com/everkinetic/data';

async function main() {
  const map = JSON.parse(readFileSync(join(ROOT, 'scripts', 'content', 'media-map.json'), 'utf8'));
  const source = MEDIA_SOURCES[map.source];
  if (!source || source.commit !== map.commit) throw new Error(`source ou commit inconnu : ${map.source} ${map.commit}`);
  mkdirSync(MEDIA_DIR, { recursive: true });
  for (const f of readdirSync(MEDIA_DIR)) if (f.endsWith('.png')) unlinkSync(join(MEDIA_DIR, f));
  const files = [];
  for (const entry of map.entries) {
    const res = await fetch(`${RAW_BASE}/${map.commit}/${entry.path}`);
    if (!res.ok) throw new Error(`${entry.path} : HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${entry.path} : pas un PNG`);
    if (bytes.length > MEDIA_MAX_BYTES) throw new Error(`${entry.path} : ${bytes.length} octets > ${MEDIA_MAX_BYTES}`);
    const file = `${entry.exerciseId}.png`;
    writeFileSync(join(MEDIA_DIR, file), bytes);
    files.push({ file, exerciseId: entry.exerciseId, source: map.source, originPath: entry.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(join(MEDIA_DIR, 'sources.json'), `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`);
  const byId = new Map(files.map((f) => [f.exerciseId, f]));
  const exercises = JSON.parse(readFileSync(EXERCISES, 'utf8'));
  for (const x of exercises.exercises) {
    const f = byId.get(x.id);
    x.media = f ? { images: [f.file], video: null, license: source.license, source: `${map.source}:${f.originPath}` } : { images: [], video: null, license: null, source: null };
  }
  writeFileSync(EXERCISES, `${JSON.stringify(exercises, null, 2)}\n`);
  const total = files.reduce((s, f) => s + f.bytes, 0);
  console.log(`build-media : ${files.length} médias, ${total} octets.`);
}

main().catch((e) => {
  console.log(`::error::${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
