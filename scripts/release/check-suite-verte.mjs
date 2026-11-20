/* global process, console */
// CI-PUB (C-172) : le check « suite verte » du SHA d'un tag doit être vert avant toute compilation de publication.
// Usage : node check-suite-verte.mjs <check-runs.json> <sha> ; le fichier est la liste `check_runs` de
// `gh api repos/<dépôt>/commits/<sha>/check-runs`. Code de sortie 1 et message clair sinon.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHECK_NAME = 'suite verte';

/** @returns {{ ok: boolean, message: string }} */
export function evaluateSuiteVerte(runs, sha = '') {
  const label = sha ? ` sur ${sha.slice(0, 12)}` : '';
  const list = Array.isArray(runs) ? runs.filter((r) => r && r.name === CHECK_NAME) : [];
  if (list.length === 0) {
    return { ok: false, message: `Check « ${CHECK_NAME} » absent${label} : publication refusée (la suite doit avoir tourné sur ce commit de main).` };
  }
  const latest = [...list].sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')))[0];
  if (latest.status !== 'completed') {
    return { ok: false, message: `Check « ${CHECK_NAME} »${label} pas terminé (${latest.status}) : attendre la fin de la suite puis relancer.` };
  }
  if (latest.conclusion !== 'success') {
    return { ok: false, message: `Check « ${CHECK_NAME} »${label} non vert (${latest.conclusion}) : publication refusée.` };
  }
  return { ok: true, message: `Check « ${CHECK_NAME} » vert${label}.` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, sha] = process.argv.slice(2);
  if (!file) {
    console.error('Usage : node check-suite-verte.mjs <check-runs.json> <sha>');
    process.exit(2);
  }
  const result = evaluateSuiteVerte(JSON.parse(readFileSync(file, 'utf8')), sha);
  if (result.ok) console.log(result.message);
  else {
    console.error(`::error::${result.message}`);
    process.exit(1);
  }
}
