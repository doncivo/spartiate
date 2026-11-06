import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SPA-007 lot D : gardes de source (pas de Mac : le Swift ne compile qu'en CI). Plugin live-activity sur le modèle de healthkit, pont Rust avec
 * délais, capability iOS exacte, copie du fichier d'attributs identique à la source durable de l'extension.
 */
const root = join(__dirname, '..', '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const swift = read('src-tauri/plugins/live-activity/ios/Sources/LiveActivityPlugin.swift');
const bridge = read('src-tauri/src/live_activity.rs');

describe('plugin Swift live-activity', () => {
  it('trois méthodes : status (isAvailable), start, end ; point d’entrée du plugin', () => {
    for (const method of ['func status', 'func start', 'func end']) expect(swift, method).toContain(method);
    expect(swift).toMatch(/@_cdecl\("init_plugin_live_activity"\)/);
  });

  it('disponibilité : ActivityAuthorizationInfo().areActivitiesEnabled, avec le motif quand la réponse est non', () => {
    expect(swift).toMatch(/ActivityAuthorizationInfo\(\)\.areActivitiesEnabled/);
    expect(swift).toMatch(/"reason"/);
    expect(swift).toMatch(/disabled/);
  });

  it('start : Activity.request sans push, date de fin périmée à l’échéance, activité précédente fermée (pas d’orpheline)', () => {
    expect(swift).toMatch(/Activity<SpartiateTimerAttributes>\.request\(/);
    expect(swift).toMatch(/pushType:\s*nil/);
    expect(swift).toMatch(/staleDate:/);
    expect(swift).toMatch(/Activity<SpartiateTimerAttributes>\.activities/);
  });

  it('end : dismissalPolicy .immediate', () => {
    expect(swift).toMatch(/dismissalPolicy:\s*\.immediate/);
  });

  it('erreurs natives remontées en clair : domaine, code, localizedDescription tronquée à 200', () => {
    expect(swift).toMatch(/as NSError/);
    expect(swift).toMatch(/\.domain/);
    expect(swift).toMatch(/localizedDescription/);
    expect(swift).toMatch(/prefix\(200\)/);
  });

  it('aucun push, App Group, mode de fond ni écriture de donnée', () => {
    expect(swift).not.toMatch(/pushToken|pushType:\s*\.token|UserDefaults\(suiteName|application-groups|BGTask/);
  });

  it('copie du fichier d’attributs identique à la source durable de l’extension', () => {
    expect(read('src-tauri/plugins/live-activity/ios/Sources/SpartiateTimerAttributes.swift')).toBe(read('src-tauri/ios/LiveActivity/SpartiateTimerAttributes.swift'));
  });

  it('Package.swift et crate Rust du plugin', () => {
    expect(read('src-tauri/plugins/live-activity/ios/Package.swift')).toContain('tauri-plugin-live-activity');
    const cargo = read('src-tauri/plugins/live-activity/Cargo.toml');
    expect(cargo).toContain('name = "tauri-plugin-live-activity"');
    expect(cargo).toContain('links = "tauri-plugin-live-activity"');
    expect(read('src-tauri/plugins/live-activity/src/lib.rs')).toMatch(/ios_plugin_binding!\(init_plugin_live_activity\)/);
  });
});

describe('pont Rust live_activity.rs', () => {
  it('trois commandes bornées par un délai, iPhone seulement', () => {
    for (const name of ['live_activity_status', 'live_activity_start', 'live_activity_end']) expect(bridge, name).toContain(`pub async fn ${name}`);
    expect(bridge).toContain('call_with_deadline');
    expect(bridge).toContain('call(app, "status"');
    expect(bridge).toContain('call(app, "end"');
  });

  it('libellé borné et date de fin contrôlée côté Rust avant l’appel Swift', () => {
    expect(bridge).toMatch(/LABEL_MAX/);
    expect(bridge).toMatch(/liveactivity-bad-args/);
  });

  it('enregistré : lib.rs, build.rs (manifeste), Cargo.toml (cible iOS seulement), capability à liste exacte', () => {
    const lib = read('src-tauri/src/lib.rs');
    expect(lib).toMatch(/mod live_activity;/);
    expect(lib).toMatch(/tauri_plugin_live_activity::init\(\)/);
    for (const name of ['live_activity_status', 'live_activity_start', 'live_activity_end']) {
      expect(lib).toContain(`live_activity::${name}`);
      expect(read('src-tauri/build.rs')).toContain(`"${name}"`);
    }
    const cargo = read('src-tauri/Cargo.toml');
    expect(cargo.indexOf('tauri-plugin-live-activity')).toBeGreaterThan(cargo.indexOf("[target.'cfg(target_os = \"ios\")'.dependencies]"));
    const capability = JSON.parse(read('src-tauri/capabilities/live-activity-ios.json')) as { platforms: string[]; windows: string[]; permissions: string[] };
    expect(capability.platforms).toEqual(['iOS']);
    expect(capability.windows).toEqual(['main']);
    expect([...capability.permissions].sort()).toEqual(['allow-live-activity-end', 'allow-live-activity-start', 'allow-live-activity-status']);
    expect(existsSync(join(root, 'src-tauri/capabilities/default.json'))).toBe(true);
    expect(read('src-tauri/capabilities/default.json')).not.toContain('live-activity');
  });
});
