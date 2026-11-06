/* global process, console */
// 0.1.4 (8) : icône de l'app iPhone.
// `tauri ios init` ne recopie pas `src-tauri/icons/ios` : l'iPhone affichait l'icône Tauri par défaut. Après l'init :
// - sans option : copie chaque icône listée par l'AppIcon du projet généré depuis `src-tauri/icons/ios` ; échec si un fichier manque, si
//   ses dimensions ne sont pas celles de Contents.json (taille × échelle) ou si la copie diffère de la source ;
// - `--compare <dossier attendu> <dossier .app>` : contrôle de l'IPA finale. Le premier dossier contient les `AppIcon*.png` compilés par
//   actool depuis les icônes Spartiate, le second l'app extraite de l'IPA : chaque fichier doit y être, avec le même SHA-256.
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICON_SOURCE = 'src-tauri/icons/ios';
export const ICON_SET = 'src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Dimensions lues dans le bloc IHDR d'un PNG ; lève une erreur si le fichier n'en est pas un. */
function pngSize(file) {
  const head = readFileSync(file).subarray(0, 24);
  if (head.length < 24 || !head.subarray(0, 8).equals(PNG_SIGNATURE) || head.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${file} n'est pas un PNG`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Copie les icônes ; rend le nombre de fichiers copiés. */
export function applyIcons({ root }) {
  const set = join(root, ICON_SET);
  const contents = join(set, 'Contents.json');
  if (!existsSync(contents)) throw new Error(`AppIcon généré absent : ${ICON_SET}/Contents.json (tauri ios init a-t-il tourné ?)`);
  const images = (JSON.parse(readFileSync(contents, 'utf8')).images ?? []).filter((image) => typeof image.filename === 'string');
  if (images.length === 0) throw new Error(`AppIcon sans aucune image : ${ICON_SET}/Contents.json`);
  const done = new Set();
  for (const image of images) {
    const source = join(root, ICON_SOURCE, image.filename);
    if (!existsSync(source)) throw new Error(`icône manquante dans ${ICON_SOURCE} : ${image.filename} (${image.size} @${image.scale})`);
    const expected = Math.round(parseFloat(String(image.size).split('x')[0]) * parseInt(String(image.scale), 10));
    const { width, height } = pngSize(source);
    if (width !== expected || height !== expected) throw new Error(`${image.filename} : ${width}x${height} au lieu de ${expected}x${expected}`);
    const dest = join(set, image.filename);
    copyFileSync(source, dest);
    if (sha256(source) !== sha256(dest)) throw new Error(`${image.filename} : la copie diffère de la source`);
    done.add(image.filename);
  }
  return done.size;
}

/** Compare les icônes compilées attendues à celles de l'app de l'IPA finale ; rend le nombre de fichiers comparés. */
export function compareCompiledIcons(expectedDir, appDir) {
  const names = readdirSync(expectedDir).filter((name) => /^AppIcon.*\.png$/.test(name)).sort();
  if (names.length === 0) throw new Error(`aucune icône AppIcon*.png compilée dans ${expectedDir}`);
  for (const name of names) {
    const found = join(appDir, name);
    if (!existsSync(found)) throw new Error(`icône absente de l'IPA : ${name}`);
    if (sha256(found) !== sha256(join(expectedDir, name))) throw new Error(`icône de l'IPA différente de l'icône Spartiate (hash) : ${name}`);
  }
  return names.length;
}

function main(argv) {
  const compare = argv.indexOf('--compare');
  if (compare >= 0) {
    const [expected, app] = [argv[compare + 1], argv[compare + 2]];
    if (!expected || !app) throw new Error('usage : --compare <dossier attendu> <dossier .app>');
    console.log(`Icônes de l'IPA conformes (hash identique) : ${compareCompiledIcons(expected, app)}`);
    return;
  }
  const r = argv.indexOf('--root');
  const root = r >= 0 ? resolve(argv[r + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  console.log(`Icônes copiées dans l'AppIcon généré : ${applyIcons({ root })}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
