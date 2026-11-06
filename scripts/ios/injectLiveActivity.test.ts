import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
// @ts-expect-error module .mjs sans déclaration de types
import { EXTENSION_TARGET, injectLiveActivity, verifyPbxproj } from './inject-live-activity.mjs';

/**
 * SPA-007, lot B : injection de la cible d'extension après `tauri ios init`. Projet généré FACTICE, à l'image du project.yml XcodeGen que
 * Tauri 2 produit (cible `<nom>_iOS` de type application) : le nom du projet est lu, jamais présumé.
 */
const root = resolve(__dirname, '..', '..');

const PROJECT = (name = 'Spartiate', deps = true): string =>
  [
    `name: ${name}`,
    'options:',
    '  bundleIdPrefix: fr.spartiate',
    '  deploymentTarget:',
    '    iOS: 18.0',
    'fileGroups:',
    '  - ../../src',
    'configs:',
    '  debug: debug',
    '  release: release',
    'settingGroups:',
    '  app:',
    '    base:',
    `      PRODUCT_NAME: ${name}`,
    '      PRODUCT_BUNDLE_IDENTIFIER: fr.spartiate.app',
    'targets:',
    `  ${name}_iOS:`,
    '    type: application',
    '    platform: iOS',
    '    sources:',
    '      - path: Sources',
    '      - path: Assets.xcassets',
    '    info:',
    `      path: ${name}_iOS/Info.plist`,
    '      properties:',
    '        LSRequiresIPhoneOS: true',
    '    settings:',
    '      base:',
    `        PRODUCT_NAME: ${name}`,
    '        PRODUCT_BUNDLE_IDENTIFIER: fr.spartiate.app',
    '        ENABLE_BITCODE: false',
    ...(deps ? ['    dependencies:', '      - framework: libapp.a', '        embed: false', '      - sdk: Metal.framework'] : []),
    '    preBuildScripts:',
    '      - script: npm run tauri ios xcode-script',
    '        name: Build Rust Code',
    '',
  ].join('\n');

const OPTIONS = { identifier: 'fr.spartiate.app', version: '0.1.5' };
type Project = { targets: Record<string, Record<string, unknown>>; name: string };

describe('injection de la cible SpartiateLiveActivity (SPA-007 lot B)', () => {
  it('ajoute une seule cible d’extension : bundle id de l’app + .LiveActivity, embarquée dans l’app, iOS 18.0 (celui de l’app, plus haut que 16.2)', () => {
    const { text, changed } = injectLiveActivity(PROJECT(), OPTIONS);
    expect(changed).toBe(true);
    const project = parse(text) as Project;
    const extensions = Object.entries(project.targets).filter(([, t]) => t['type'] === 'app-extension');
    expect(extensions.map(([name]) => name)).toEqual([EXTENSION_TARGET]);
    const ext = extensions[0]?.[1] as { settings: { base: Record<string, string> }; sources: unknown[]; deploymentTarget?: string };
    expect(ext.settings.base['PRODUCT_BUNDLE_IDENTIFIER']).toBe('fr.spartiate.app.LiveActivity');
    expect(ext.settings.base['INFOPLIST_FILE']).toMatch(/ios\/LiveActivity\/Info\.plist$/);
    expect(String(ext.deploymentTarget)).toBe('18.0');
    expect(JSON.stringify(ext.sources)).toContain('ios/LiveActivity');
    const app = project.targets['Spartiate_iOS'] as { dependencies: Record<string, unknown>[] };
    expect(app.dependencies).toContainEqual({ target: EXTENSION_TARGET, embed: true });
    // Les dépendances existantes de l’app sont intactes.
    expect(app.dependencies).toContainEqual({ framework: 'libapp.a', embed: false });
    expect(app.dependencies).toContainEqual({ sdk: 'Metal.framework' });
  });

  it('cible de déploiement : iOS 16.2 au minimum quand l’app est plus basse', () => {
    const low = injectLiveActivity(PROJECT().replace('iOS: 18.0', 'iOS: 15.0'), OPTIONS).text;
    expect(String((parse(low) as Project).targets[EXTENSION_TARGET]?.['deploymentTarget'])).toBe('16.2');
  });

  it('idempotent : une deuxième exécution ne change rien et ne duplique ni la cible ni l’embarquement', () => {
    const once = injectLiveActivity(PROJECT(), OPTIONS);
    const twice = injectLiveActivity(once.text, OPTIONS);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once.text);
    const app = (parse(twice.text) as Project).targets['Spartiate_iOS'] as { dependencies: { target?: string }[] };
    expect(app.dependencies.filter((d) => d.target === EXTENSION_TARGET)).toHaveLength(1);
  });

  it('nom du projet lu, jamais présumé ; app sans dépendances : la liste est créée', () => {
    const { text } = injectLiveActivity(PROJECT('Autre', false), OPTIONS);
    const project = parse(text) as Project;
    expect(Object.keys(project.targets).sort()).toEqual(['Autre_iOS', EXTENSION_TARGET].sort());
    expect((project.targets['Autre_iOS'] as { dependencies: unknown[] }).dependencies).toEqual([{ target: EXTENSION_TARGET, embed: true }]);
  });

  it('projet incompatible : échec explicite (pas de cible application, YAML illisible, sans targets, identifiant différent)', () => {
    expect(() => injectLiveActivity('name: X\ntargets:\n  X_iOS:\n    type: framework\n', OPTIONS)).toThrow(/application/);
    expect(() => injectLiveActivity('targets: [', OPTIONS)).toThrow(/YAML|illisible/i);
    expect(() => injectLiveActivity('name: X\n', OPTIONS)).toThrow(/targets/);
    expect(() => injectLiveActivity(PROJECT(), { ...OPTIONS, identifier: 'fr.autre.app' })).toThrow(/identifiant/);
  });

  it('l’extension ne reçoit ni entitlements, ni App Group, ni push, ni mode de fond', () => {
    const { text } = injectLiveActivity(PROJECT(), OPTIONS);
    const ext = JSON.stringify((parse(text) as Project).targets[EXTENSION_TARGET]);
    expect(ext).not.toMatch(/entitlements|application-groups|aps-environment|UIBackgroundModes|CODE_SIGN_ENTITLEMENTS/);
  });

  it('contrôle du projet régénéré : cible, embarquement et fichier d’attributs partagé', () => {
    const good = `/* Begin PBXNativeTarget section */\n${EXTENSION_TARGET} /* ${EXTENSION_TARGET}.appex */\n/* Embed Foundation Extensions */\nSpartiateTimerAttributes.swift in Sources\n`;
    expect(verifyPbxproj(good)).toEqual([]);
    expect(verifyPbxproj('rien')).toEqual(expect.arrayContaining([expect.stringContaining(EXTENSION_TARGET)]));
  });

  it('en ligne de commande : écrit project.yml, deuxième passage inchangé, code 1 si le projet manque', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spartiate-inject-'));
    mkdirSync(join(dir, 'src-tauri', 'gen', 'apple'), { recursive: true });
    writeFileSync(join(dir, 'src-tauri', 'tauri.conf.json'), JSON.stringify(OPTIONS));
    writeFileSync(join(dir, 'src-tauri', 'gen', 'apple', 'project.yml'), PROJECT());
    const run = (cwd: string) => spawnSync(process.execPath, [join(root, 'scripts/ios/inject-live-activity.mjs'), '--root', cwd, '--no-generate'], { encoding: 'utf8' });
    expect(run(dir).status).toBe(0);
    const first = readFileSync(join(dir, 'src-tauri', 'gen', 'apple', 'project.yml'), 'utf8');
    expect(first).toContain(EXTENSION_TARGET);
    expect(run(dir).status).toBe(0);
    expect(readFileSync(join(dir, 'src-tauri', 'gen', 'apple', 'project.yml'), 'utf8')).toBe(first);
    expect(run(mkdtempSync(join(tmpdir(), 'spartiate-vide-'))).status).toBe(1);
  });

  it('workflow : injection juste après apply-entitlements.mjs, avant la compilation', () => {
    const wf = readFileSync(join(root, '.github/workflows/build-ios.yml'), 'utf8');
    const marks = ['node scripts/ios/apply-entitlements.mjs\n', 'node scripts/ios/inject-live-activity.mjs', 'npx tauri ios build --ci --no-sign --target aarch64'];
    const at = marks.map((m) => wf.indexOf(m));
    expect(at.every((i) => i >= 0), JSON.stringify(marks.filter((_, i) => at[i] < 0))).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});
