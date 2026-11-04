/* global process, console */
// SPA-003 (D-14, D-59) : entitlements durables de l'app iPhone.
// - copie `src-tauri/ios/Spartiate.entitlements` (source versionnée) vers `src-tauri/gen/apple/Spartiate.entitlements`
//   (sortie générée, jamais source de vérité) après `tauri ios init`, avec égalité octet à octet ;
// - `--check <fichier>` valide des entitlements (durables ou extraits de l'IPA finale par `codesign -d --entitlements :-`).
// Seule capacité déclarée : HealthKit. App Groups, iCloud, push et identifiants d'équipe sont refusés.
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlist } from './plist.mjs';

export const DURABLE_SOURCE = 'src-tauri/ios/Spartiate.entitlements';
export const GENERATED_DEST = 'src-tauri/gen/apple/Spartiate.entitlements';
export const HEALTHKIT_KEY = 'com.apple.developer.healthkit';
const FORBIDDEN = [/application-groups/, /icloud/i, /^aps-environment$/, /team-identifier/, /^application-identifier$/];

/** Rend la liste des problèmes (vide = valide). */
export function validateEntitlements(xml) {
  let parsed;
  try {
    parsed = parsePlist(xml);
  } catch (e) {
    return [`entitlements illisibles : ${e.message}`];
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return ['entitlements : dictionnaire attendu'];
  const problems = [];
  if (!(HEALTHKIT_KEY in parsed)) problems.push(`${HEALTHKIT_KEY} absent`);
  else if (parsed[HEALTHKIT_KEY] !== true) problems.push(`${HEALTHKIT_KEY} doit être le booléen true`);
  for (const key of Object.keys(parsed)) {
    if (FORBIDDEN.some((re) => re.test(key))) problems.push(`capacité interdite : ${key}`);
  }
  return problems;
}

/** Copie la source durable vers la destination générée ; lève une erreur explicite au moindre écart. */
export function applyEntitlements({ root }) {
  const source = join(root, DURABLE_SOURCE);
  const dest = join(root, GENERATED_DEST);
  if (!existsSync(source)) throw new Error(`source des entitlements absente : ${DURABLE_SOURCE}`);
  const problems = validateEntitlements(readFileSync(source, 'utf8'));
  if (problems.length > 0) throw new Error(`source des entitlements invalide : ${problems.join(' ; ')}`);
  const dir = dirname(dest);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`dossier généré absent : ${dirname(GENERATED_DEST)} (tauri ios init a-t-il tourné ?)`);
  copyFileSync(source, dest);
  if (!readFileSync(source).equals(readFileSync(dest))) throw new Error('la copie générée diffère de la source');
  return dest;
}

function main(argv) {
  const check = argv.indexOf('--check');
  if (check >= 0) {
    const file = argv[check + 1];
    if (!file || !existsSync(file)) throw new Error(`fichier d'entitlements absent : ${file ?? '(non fourni)'}`);
    const problems = validateEntitlements(readFileSync(file, 'utf8'));
    if (problems.length > 0) throw new Error(problems.join(' ; '));
    console.log(`Entitlements valides : ${HEALTHKIT_KEY} = true`);
    return;
  }
  const r = argv.indexOf('--root');
  const root = r >= 0 ? resolve(argv[r + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  console.log(`Entitlements copiés : ${applyEntitlements({ root })}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
