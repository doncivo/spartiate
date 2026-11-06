/* global process, console */
// SPA-007 (lot B) : injection de l'extension Live Activity dans le projet iOS généré par `tauri ios init`.
// Tauri 2 produit `src-tauri/gen/apple/project.yml` (XcodeGen) puis le projet Xcode. Ce script modifie project.yml (jamais le pbxproj à la
// main) pour ajouter UNE cible `SpartiateLiveActivity` (type app-extension), embarquée dans l'app, dont les sources sont les fichiers
// durables de `src-tauri/ios/LiveActivity`, puis régénère le projet (`xcodegen generate`) et contrôle le résultat.
// - le nom du projet et de la cible de l'app sont LUS dans project.yml (première cible de type application), jamais présumés ;
// - idempotent : deux exécutions = une seule cible, une seule dépendance ; seconde exécution sans écriture ;
// - bundle id de l'extension = celui de l'app + `.LiveActivity` ; cible de déploiement = max(16.2, celle de l'app) ;
// - aucun entitlement, App Group, push ni mode de fond pour l'extension ;
// - projet incompatible : échec explicite (code 1), jamais une publication incomplète.
// Le fichier d'attributs partagé est compilé dans l'extension (sources durables) et dans l'app par le plugin live-activity (copie identique,
// vérifiée par un test).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

export const EXTENSION_TARGET = 'SpartiateLiveActivity';
export const SOURCES_FROM_PROJECT = '../../ios/LiveActivity';
export const MIN_DEPLOYMENT = '16.2';
const SUFFIX = '.LiveActivity';

/** Compare deux versions « majeure.mineure » ; rend un nombre positif si a > b. */
function compareVersions(a, b) {
  const [a1 = 0, a2 = 0] = String(a).split('.').map(Number);
  const [b1 = 0, b2 = 0] = String(b).split('.').map(Number);
  return a1 - b1 || a2 - b2;
}

/** Texte d'un scalaire tel qu'écrit (18.0 reste « 18.0 »), ou null. */
function scalarText(node) {
  if (node === undefined || node === null) return null;
  if (isScalar(node)) return typeof node.source === 'string' && node.source !== '' ? node.source : String(node.value);
  return null;
}

/** Première cible de type application ; échec explicite sinon. */
function findAppTarget(targets) {
  for (const pair of targets.items) {
    const value = pair.value;
    if (isMap(value) && value.get('type') === 'application') return { name: String(pair.key), node: value };
  }
  throw new Error('project.yml incompatible : aucune cible de type application sous targets');
}

/**
 * Ajoute (si besoin) la cible d'extension et sa dépendance. `options` : { identifier, version } de tauri.conf.json.
 * Rend { text, changed }.
 */
export function injectLiveActivity(text, options) {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error(`project.yml illisible (YAML) : ${doc.errors[0].message}`);
  const targets = doc.get('targets', true);
  if (!isMap(targets)) throw new Error('project.yml incompatible : section targets absente');
  const app = findAppTarget(targets);

  const declared = app.node.getIn(['settings', 'base', 'PRODUCT_BUNDLE_IDENTIFIER']);
  if (typeof declared === 'string' && !declared.includes('$') && declared !== options.identifier) {
    throw new Error(`project.yml incompatible : identifiant de l'app ${declared} différent de tauri.conf.json (${options.identifier})`);
  }

  const appTarget = scalarText(app.node.get('deploymentTarget', true)) ?? scalarText(doc.getIn(['options', 'deploymentTarget', 'iOS'], true));
  const deployment = appTarget !== null && compareVersions(appTarget, MIN_DEPLOYMENT) > 0 ? appTarget : MIN_DEPLOYMENT;

  let changed = false;
  if (!targets.has(EXTENSION_TARGET)) {
    const version = String(options.version);
    targets.set(
      EXTENSION_TARGET,
      doc.createNode({
        type: 'app-extension',
        platform: 'iOS',
        deploymentTarget: deployment,
        sources: [{ path: SOURCES_FROM_PROJECT, excludes: ['Info.plist'] }],
        settings: {
          base: {
            PRODUCT_BUNDLE_IDENTIFIER: `${options.identifier}${SUFFIX}`,
            PRODUCT_NAME: '$(TARGET_NAME)',
            INFOPLIST_FILE: `${SOURCES_FROM_PROJECT}/Info.plist`,
            GENERATE_INFOPLIST_FILE: 'NO',
            SKIP_INSTALL: 'YES',
            SWIFT_VERSION: '5.0',
            TARGETED_DEVICE_FAMILY: '1',
            MARKETING_VERSION: version,
            CURRENT_PROJECT_VERSION: version,
            LD_RUNPATH_SEARCH_PATHS: '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks',
          },
        },
      }),
    );
    changed = true;
  }

  const wanted = { target: EXTENSION_TARGET, embed: true };
  let dependencies = app.node.get('dependencies', true);
  if (!isSeq(dependencies)) {
    app.node.set('dependencies', doc.createNode([wanted]));
    changed = true;
  } else {
    const present = dependencies.items.some((item) => isMap(item) && item.get('target') === EXTENSION_TARGET);
    if (!present) {
      dependencies.add(doc.createNode(wanted));
      changed = true;
    }
  }
  return { text: changed ? doc.toString({ lineWidth: 0 }) : text, changed };
}

/** Contrôle du project.pbxproj régénéré : cible, phase d'embarquement et fichier d'attributs partagé. Rend la liste des problèmes. */
export function verifyPbxproj(text) {
  const problems = [];
  if (!text.includes(`${EXTENSION_TARGET} /* ${EXTENSION_TARGET}.appex */`) && !new RegExp(`name = ${EXTENSION_TARGET};`).test(text)) problems.push(`cible ${EXTENSION_TARGET} absente du projet régénéré`);
  if (!/Embed (Foundation Extensions|App Extensions)/.test(text)) problems.push("phase d'embarquement des extensions absente du projet régénéré");
  if (!text.includes('SpartiateTimerAttributes.swift')) problems.push("fichier d'attributs partagé absent des sources de l'extension");
  return problems;
}

function main(argv) {
  const r = argv.indexOf('--root');
  const root = r >= 0 ? resolve(argv[r + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const apple = join(root, 'src-tauri', 'gen', 'apple');
  const spec = join(apple, 'project.yml');
  if (!existsSync(spec)) throw new Error('src-tauri/gen/apple/project.yml absent (tauri ios init a-t-il tourné ?)');
  const conf = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  if (typeof conf.identifier !== 'string' || typeof conf.version !== 'string') throw new Error('tauri.conf.json : identifier ou version manquant');
  const { text, changed } = injectLiveActivity(readFileSync(spec, 'utf8'), { identifier: conf.identifier, version: conf.version });
  if (changed) writeFileSync(spec, text);
  console.log(changed ? `Cible ${EXTENSION_TARGET} ajoutée à project.yml` : `Cible ${EXTENSION_TARGET} déjà présente : project.yml inchangé`);
  if (argv.includes('--no-generate')) return;
  const generated = spawnSync('xcodegen', ['generate', '--no-env', '--spec', 'project.yml'], { cwd: apple, stdio: 'inherit' });
  if (generated.status !== 0) throw new Error('xcodegen generate a échoué');
  const project = readdirSync(apple).find((name) => name.endsWith('.xcodeproj'));
  if (!project) throw new Error('projet .xcodeproj absent après xcodegen generate');
  const problems = verifyPbxproj(readFileSync(join(apple, project, 'project.pbxproj'), 'utf8'));
  if (problems.length > 0) throw new Error(problems.join(' ; '));
  console.log(`Projet régénéré : ${EXTENSION_TARGET} présente, embarquée, attributs partagés`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
