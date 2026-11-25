#!/usr/bin/env node
/* global console, process, fetch */
// BL-165 (REL-0.29.2, D-489, D-564 ; D-625) : les corps de six anciennes publications de spartiate-releases portaient le nom d'un lieu
// réel (l'identifiant du profil par défaut). source.json est réécrit par make-source-json.mjs ; ces corps le sont ici, par l'API GitHub,
// à chaque publication iPhone (job « publish » de build-ios.yml, jeton RELEASES_TOKEN), jamais à la main. Même correcteur
// (`redactPlace`) ; idempotent : un corps déjà propre n'est pas réécrit. Le journal ne cite que l'étiquette et l'état, jamais le corps.
import { pathToFileURL } from 'node:url';
import { RELEASES_REPO, redactPlace } from './make-source-json.mjs';

export const OLD_RELEASE_TAGS = ['v0.2.0', 'ios-v0.2.0', 'v0.3.0', 'ios-v0.3.0', 'v0.3.3', 'ios-v0.3.3'];

const API = 'https://api.github.com';

export async function redactReleaseBodies({ repo = RELEASES_REPO, token, tags = OLD_RELEASE_TAGS, fetchImpl = fetch, redact = redactPlace, dryRun = false }) {
  if (!token) throw new Error('Jeton absent (GH_TOKEN) : réécriture des anciennes publications impossible.');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const result = [];
  for (const tag of tags) {
    const res = await fetchImpl(`${API}/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, { headers });
    if (res.status === 404) {
      result.push({ tag, status: 'absente' });
      continue;
    }
    if (!res.ok) throw new Error(`Lecture de la publication ${tag} impossible : HTTP ${res.status}`);
    const release = await res.json();
    const body = typeof release.body === 'string' ? release.body : '';
    const next = redact(body);
    if (next === body) {
      result.push({ tag, status: 'inchangée' });
      continue;
    }
    if (dryRun) {
      result.push({ tag, status: 'à réécrire' });
      continue;
    }
    const patch = await fetchImpl(`${API}/repos/${repo}/releases/${release.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      // Relecture à froid : make_latest vaut true par défaut à l'API ; une ancienne publication ne doit jamais devenir « latest »
      // (l'updater PC lit releases/latest/download/latest.json).
      body: JSON.stringify({ body: next, make_latest: 'false' }),
    });
    if (!patch.ok) throw new Error(`Réécriture de la publication ${tag} impossible : HTTP ${patch.status}`);
    result.push({ tag, status: 'réécrite' });
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  redactReleaseBodies({ token: process.env.GH_TOKEN ?? '', dryRun: process.argv.includes('--dry-run') })
    .then((r) => {
      for (const { tag, status } of r) console.log(`${tag} : ${status}`);
    })
    .catch((e) => {
      console.error(`::error::${e.message}`);
      process.exit(1);
    });
}
