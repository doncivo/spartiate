import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- module JavaScript sans déclaration de types (script d'outillage)
import { ICON_SOURCE, ICON_TARGET, compareIcons, iconFiles, tauriIconArgs } from './generate-icons.mjs';

/**
 * § 18.4 b (C-194) : les icônes de l'app (src-tauri/icons, iPhone compris) sont générées par script depuis content/brand/spartiate.svg
 * (`node scripts/release/generate-icons.mjs`, qui appelle `tauri icon` du CLI déjà installé ; `--check` compare sans écrire).
 */
const made: string[] = [];
const tmp = (): string => {
  const dir = mkdtempSync(join(resolve('.codex-tmp'), 'icons-test-'));
  made.push(dir);
  return dir;
};
// CLEAN-0296 : dossiers temporaires retirés après chaque test.
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tree(root: string, files: Record<string, string>): string {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('§ 18.4 b : icônes générées depuis spartiate.svg', () => {
  it('source et cible', () => {
    expect(ICON_SOURCE).toBe('content/brand/spartiate.svg');
    expect(ICON_TARGET).toBe('src-tauri/icons');
    expect(tauriIconArgs('sortie')).toEqual(['icon', 'content/brand/spartiate.svg', '-o', 'sortie']);
  });

  it('retient les icônes PC et iPhone, jamais Android (aucune cible Android)', () => {
    mkdirSync(resolve('.codex-tmp'), { recursive: true });
    const gen = tree(tmp(), { 'icon.png': 'a', 'ios/AppIcon-20x20@1x.png': 'b', 'android/mipmap-hdpi/ic_launcher.png': 'c', 'android/values/x.xml': 'd' });
    expect(iconFiles(gen)).toEqual(['icon.png', 'ios/AppIcon-20x20@1x.png']);
  });

  it('compare octet à octet : fichier différent, manquant ou en trop', () => {
    mkdirSync(resolve('.codex-tmp'), { recursive: true });
    const gen = tree(tmp(), { 'icon.png': 'a', 'ios/A.png': 'b', '32x32.png': 'n' });
    const repo = tree(tmp(), { 'icon.png': 'a', 'ios/A.png': 'B', 'vieux.png': 'v' });
    expect(compareIcons(gen, repo)).toEqual({ different: ['ios/A.png'], missing: ['32x32.png'], extra: ['vieux.png'] });
    expect(compareIcons(gen, gen)).toEqual({ different: [], missing: [], extra: [] });
  });

  it('chaque fichier suivi de src-tauri/icons est une sortie connue de tauri icon', () => {
    const files = iconFiles(resolve(ICON_TARGET));
    expect(files.length).toBe(readdirSync(resolve(ICON_TARGET)).filter((f) => f !== 'ios').length + readdirSync(resolve(ICON_TARGET, 'ios')).length);
    for (const f of files) expect(f).toMatch(/^(ios\/AppIcon-[\d.x@-]+\.png|icon\.(png|ico|icns)|\d+x\d+(@2x)?\.png|Square\d+x\d+Logo\.png|StoreLogo\.png)$/);
  });

  // CLEAN-0296 (§ 18.4 b, test réécrit après la relecture à froid) : le `--check` réel tourne dans une étape de tests.yml ; ici, le
  // chemin `--check` du script sur des arbres synthétiques (`--from` : sortie déjà générée, `--target` : dossier comparé), sans `tauri icon`.
  it('--check : arbres identiques acceptés ; une icône retouchée à la main est refusée et nommée', () => {
    mkdirSync(resolve('.codex-tmp'), { recursive: true });
    const script = resolve('scripts/release/generate-icons.mjs');
    const check = (from: string, target: string) => spawnSync(process.execPath, [script, '--check', '--from', from, '--target', target], { encoding: 'utf8' });
    const files = { 'icon.png': 'a', 'ios/AppIcon-60x60@3x.png': 'b', 'icon.icns': 'c' };
    const gen = tree(tmp(), files);
    const same = check(gen, tree(tmp(), { ...files, 'icon.icns': 'autre' }));
    expect(same.stdout).toContain('3 icônes identiques');
    expect(same.status).toBe(0);
    const altered = check(gen, tree(tmp(), { ...files, 'ios/AppIcon-60x60@3x.png': 'b retouché' }));
    expect(altered.status).toBe(1);
    expect(altered.stderr).toContain('ios/AppIcon-60x60@3x.png');
    expect(readFileSync(join(gen, 'icon.png'), 'utf8')).toBe('a');
  });

  it('tests.yml lance le --check réel (job « Lint et typecheck »)', () => {
    const workflow = readFileSync(resolve('.github/workflows/tests.yml'), 'utf8');
    const job = workflow.slice(workflow.indexOf('\n  qualite:'), workflow.indexOf('\n  vitest-node:'));
    expect(job).toContain('run: node scripts/release/generate-icons.mjs --check');
  });
});
