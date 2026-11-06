import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error module .mjs sans déclaration de types
import { applyIcons, compareCompiledIcons, ICON_SOURCE, ICON_SET } from './apply-icons.mjs';

/**
 * 0.1.4 (8) : `tauri ios init` ne recopie pas `src-tauri/icons/ios` : l'iPhone affichait l'icône Tauri par défaut. Après l'init, les icônes
 * versionnées sont copiées dans l'AppIcon du projet généré ; le build échoue si une taille manque ; l'IPA finale est contrôlée par hash.
 */
const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

/** PNG minimal : signature, bloc IHDR (largeur, hauteur), pas de données d'image (suffisant pour le contrôle de taille). */
function png(width: number, height: number, tag = 0): Buffer {
  const head = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0);
  head.writeUInt32BE(13, 8);
  head.write('IHDR', 12, 'ascii');
  head.writeUInt32BE(width, 16);
  head.writeUInt32BE(height, 20);
  head[24] = 8;
  head[25] = 6;
  head.writeUInt32BE(tag, 29);
  return head;
}

const IMAGES = [
  { filename: 'AppIcon-20x20@2x.png', size: '20x20', scale: '2x', px: 40 },
  { filename: 'AppIcon-60x60@3x.png', size: '60x60', scale: '3x', px: 180 },
  { filename: 'AppIcon-512@2x.png', size: '512x512', scale: '2x', px: 1024 },
];

function fakeRoot(options: { generated?: boolean; missing?: string; wrongSize?: string } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'spartiate-icons-'));
  mkdirSync(join(dir, ICON_SOURCE), { recursive: true });
  for (const image of IMAGES) {
    if (image.filename === options.missing) continue;
    const px = image.filename === options.wrongSize ? image.px - 1 : image.px;
    writeFileSync(join(dir, ICON_SOURCE, image.filename), png(px, px, px));
  }
  if (options.generated !== false) {
    mkdirSync(join(dir, ICON_SET), { recursive: true });
    writeFileSync(join(dir, ICON_SET, 'Contents.json'), JSON.stringify({ images: IMAGES.map(({ filename, size, scale }) => ({ filename, size, scale, idiom: 'iphone' })), info: { version: 1, author: 'xcode' } }));
    for (const image of IMAGES) writeFileSync(join(dir, ICON_SET, image.filename), png(1, 1, 99)); // icône Tauri par défaut
  }
  return dir;
}

const sha = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('icônes de l’app iPhone (0.1.4 point 8)', () => {
  it('copie chaque icône de src-tauri/icons/ios dans l’AppIcon généré, octet pour octet', () => {
    const dir = fakeRoot();
    expect(applyIcons({ root: dir })).toBe(IMAGES.length);
    for (const image of IMAGES) expect(sha(join(dir, ICON_SET, image.filename))).toBe(sha(join(dir, ICON_SOURCE, image.filename)));
  });

  it('une taille manquante fait échouer, avec le nom du fichier', () => {
    expect(() => applyIcons({ root: fakeRoot({ missing: 'AppIcon-60x60@3x.png' }) })).toThrow(/AppIcon-60x60@3x\.png/);
  });

  it('une icône aux mauvaises dimensions fait échouer', () => {
    expect(() => applyIcons({ root: fakeRoot({ wrongSize: 'AppIcon-512@2x.png' }) })).toThrow(/1023|1024/);
  });

  it('projet généré absent (tauri ios init n’a pas tourné) : échec explicite', () => {
    expect(() => applyIcons({ root: fakeRoot({ generated: false }) })).toThrow(/AppIcon/);
  });

  it('en ligne de commande : code 1 si une taille manque, 0 sinon', () => {
    const run = (dir: string) => spawnSync(process.execPath, [join(root, 'scripts/ios/apply-icons.mjs'), '--root', dir], { encoding: 'utf8' });
    expect(run(fakeRoot({ missing: 'AppIcon-20x20@2x.png' })).status).toBe(1);
    expect(run(fakeRoot()).status).toBe(0);
  });

  it('IPA finale : les icônes compilées doivent avoir le hash de celles compilées depuis les icônes Spartiate', () => {
    const expected = mkdtempSync(join(tmpdir(), 'spartiate-exp-'));
    const app = mkdtempSync(join(tmpdir(), 'spartiate-app-'));
    writeFileSync(join(expected, 'AppIcon60x60@2x.png'), 'spartiate-60');
    writeFileSync(join(expected, 'AppIcon60x60@3x.png'), 'spartiate-90');
    writeFileSync(join(app, 'AppIcon60x60@2x.png'), 'spartiate-60');
    writeFileSync(join(app, 'AppIcon60x60@3x.png'), 'spartiate-90');
    expect(compareCompiledIcons(expected, app)).toBe(2);
    writeFileSync(join(app, 'AppIcon60x60@3x.png'), 'icône Tauri par défaut');
    expect(() => compareCompiledIcons(expected, app)).toThrow(/AppIcon60x60@3x\.png/);
    expect(() => compareCompiledIcons(expected, mkdtempSync(join(tmpdir(), 'spartiate-vide-')))).toThrow(/AppIcon60x60@2x\.png/);
  });

  it('workflow : copie des icônes juste après l’init, contrôle de hash sur l’IPA finale', () => {
    const wf = read('.github/workflows/build-ios.yml');
    const marks = ['npx tauri ios init --ci', 'node scripts/ios/apply-icons.mjs\n', 'npx tauri ios build --ci --no-sign --target aarch64', 'codesign --verify', 'apply-icons.mjs --compare'];
    const at = marks.map((m) => wf.indexOf(m));
    expect(at.every((i) => i >= 0), JSON.stringify(marks.filter((_, i) => at[i] < 0))).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(wf).toMatch(/actool/);
  });
});
