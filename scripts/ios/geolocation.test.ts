// I6-06 (D-222, H-35) : GPS sur l'iPhone par le plugin OFFICIEL Tauri `geolocation`, au premier plan seulement. Contrôles déterministes de la
// chaîne : versions exactes et identiques (npm et crate), crate dans la cible iOS seulement, plugin enregistré dans le bloc iOS de lib.rs, capability
// iOS seule et minimale, clé Info.plist « pendant l'utilisation » en français, aucune clé « toujours » ni mode d'arrière-plan, contrôle du build iOS.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlist } from './plist.mjs';
import { checkPlistContract, validateContract } from './check-plist-contract.mjs';

type Json = Record<string, unknown>;
const root = resolve(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const VERSION = '2.5.0';

describe('plugin officiel geolocation : dépendances (passe architect)', () => {
  it('npm : @tauri-apps/plugin-geolocation en version exacte, la même que la crate ; lockfile cohérent', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@tauri-apps/plugin-geolocation']).toBe(VERSION);
    const lock = JSON.parse(read('package-lock.json')) as { packages: Record<string, { version?: string }> };
    expect(lock.packages['node_modules/@tauri-apps/plugin-geolocation']?.version).toBe(VERSION);
  });

  it('cargo : tauri-plugin-geolocation = "=2.5.0" sous la cible iOS seulement ; Cargo.lock le porte', () => {
    let section = '';
    const found: string[] = [];
    for (const line of read('src-tauri/Cargo.toml').split('\n')) {
      if (line.startsWith('[')) section = line.trim();
      if (line.startsWith('tauri-plugin-geolocation')) found.push(`${section} ${line.trim()}`);
    }
    expect(found).toEqual([`[target.'cfg(target_os = "ios")'.dependencies] tauri-plugin-geolocation = "=${VERSION}"`]);
    expect(read('src-tauri/Cargo.lock')).toMatch(new RegExp(`name = "tauri-plugin-geolocation"\\nversion = "${VERSION.replaceAll('.', '\\.')}"`));
  });

  it('lib.rs : plugin enregistré dans le bloc iOS seulement', () => {
    const lib = read('src-tauri/src/lib.rs');
    const at = lib.indexOf('.plugin(tauri_plugin_geolocation::init())');
    expect(at).toBeGreaterThan(0);
    expect(lib.split('tauri_plugin_geolocation::init()').length).toBe(2);
    const before = lib.slice(0, at);
    expect(before.slice(before.lastIndexOf('#[cfg(')).startsWith('#[cfg(target_os = "ios")]')).toBe(true);
  });

  it('build-ios.yml : la crate est exigée dans la cible iOS et refusée dans la cible Windows', () => {
    const workflow = read('.github/workflows/build-ios.yml');
    expect(workflow).toContain(`echo "$ios" | grep -q '^tauri-plugin-geolocation '`);
    expect(workflow).toContain(`if echo "$windows" | grep -q '^tauri-plugin-geolocation '`);
  });
});

describe('capability geolocation-ios.json (passe ios-mobile et security-privacy)', () => {
  const capability = JSON.parse(read('src-tauri/capabilities/geolocation-ios.json')) as Json;

  it('fenêtre principale, iPhone seulement, quatre permissions exactes : état, demande, suivi, arrêt (aucune position ponctuelle)', () => {
    expect(capability['identifier']).toBe('geolocation-ios');
    expect(capability['windows']).toEqual(['main']);
    expect(capability['platforms']).toEqual(['iOS']);
    expect(capability['permissions']).toEqual(['geolocation:allow-check-permissions', 'geolocation:allow-request-permissions', 'geolocation:allow-watch-position', 'geolocation:allow-clear-watch']);
  });

  it('aucune autre capability n’accorde une permission geolocation', () => {
    for (const name of readdirSync(join(root, 'src-tauri', 'capabilities'))) {
      if (name === 'geolocation-ios.json') continue;
      expect(read(`src-tauri/capabilities/${name}`), name).not.toContain('geolocation:');
    }
  });
});

describe('Info.plist : localisation pendant l’utilisation seulement (contrat du dépôt)', () => {
  const contract = JSON.parse(read('scripts/ios/plist-contract.json')) as Json;
  const plist = parsePlist(read('src-tauri/Info.ios.plist')) as Json;

  it('entrée geolocation du contrat (I6-06) ; « toujours » et arrière-plan restent interdits', () => {
    expect((contract['plugins'] as Json)['geolocation']).toEqual({ story: 'I6-06', usageDescriptions: ['NSLocationWhenInUseUsageDescription'] });
    const forbidden = contract['forbiddenKeys'] as string[];
    expect(forbidden).toContain('UIBackgroundModes');
    expect(forbidden).toContain('NSLocationAlwaysAndWhenInUseUsageDescription');
    expect(forbidden).not.toContain('NSLocationWhenInUseUsageDescription');
    expect(validateContract(contract)).toEqual([]);
    expect(checkPlistContract(contract, plist)).toEqual({ errors: [], warnings: [] });
  });

  it('raison d’usage en français : dit le cardio, le premier plan et que le tracé reste sur l’iPhone', () => {
    const text = String(plist['NSLocationWhenInUseUsageDescription']);
    expect(text).toMatch(/^Spartiate /);
    expect(text).toMatch(/cardio/);
    expect(text).toMatch(/ouverte|premier plan/);
    expect(text).toMatch(/reste sur l’iPhone/);
    expect(Object.hasOwn(plist, 'NSLocationAlwaysAndWhenInUseUsageDescription')).toBe(false);
    expect(Object.hasOwn(plist, 'UIBackgroundModes')).toBe(false);
  });

  it('retirer la clé fait échouer le contrat', () => {
    const { NSLocationWhenInUseUsageDescription: _removed, ...without } = plist;
    void _removed;
    expect(checkPlistContract(contract, without).errors).toContain('NSLocationWhenInUseUsageDescription absente (plugin geolocation, I6-06)');
  });
});
