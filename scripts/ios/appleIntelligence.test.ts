import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlist } from './plist.mjs';

/**
 * IOS-029b (essai Apple Intelligence, H-41 proposée) : contrôle statique du plugin Swift `apple-intelligence` (aucun Mac : compilé par
 * build-ios.yml seulement). Le texte envoyé au modèle est fixe dans le Swift : aucune donnée de l'app n'y entre.
 */
const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const PLUGIN = 'src-tauri/plugins/apple-intelligence';
const SWIFT = `${PLUGIN}/ios/Sources/AppleIntelligencePlugin.swift`;

describe('plugin apple-intelligence (IOS-029b)', () => {
  it('crate Tauri : links, ios_path, aucune commande WebView', () => {
    for (const file of ['Cargo.toml', 'build.rs', 'src/lib.rs', 'ios/Package.swift']) expect(existsSync(join(root, PLUGIN, file)), file).toBe(true);
    expect(read(`${PLUGIN}/Cargo.toml`)).toMatch(/links = "tauri-plugin-apple-intelligence"/);
    expect(read(`${PLUGIN}/build.rs`)).toMatch(/Builder::new\(&\[\]\)\.ios_path\("ios"\)/);
    const lib = read(`${PLUGIN}/src/lib.rs`);
    expect(lib).toMatch(/ios_plugin_binding!\(init_plugin_apple_intelligence\)/);
    expect(lib).toMatch(/Builder::new\("apple-intelligence"\)/);
  });

  it('Package.swift : iOS 17, aucune dépendance externe', () => {
    const pkg = read(`${PLUGIN}/ios/Package.swift`);
    expect(pkg).toMatch(/\.iOS\("17\.0"\)/);
    expect(pkg).not.toMatch(/\.package\(url:/);
  });

  it('Swift : compilation conditionnelle (SDK sans Foundation Models, iOS < 26), méthode probe, point d’entrée', () => {
    const src = read(SWIFT);
    expect(src).toMatch(/#if canImport\(FoundationModels\)\s*\nimport FoundationModels\s*\n#endif/);
    expect(src).toMatch(/@available\(iOS 26\.0, \*\)/);
    expect(src).toMatch(/if #available\(iOS 26\.0, \*\)/);
    expect(src).toMatch(/class AppleIntelligencePlugin: Plugin/);
    expect(src).toMatch(/@objc public func probe\(_ invoke: Invoke\)/);
    expect(src).toMatch(/@_cdecl\("init_plugin_apple_intelligence"\)/);
    expect(src).toMatch(/SystemLanguageModel\.default/);
    expect(src).toMatch(/LanguageModelSession\(\)/);
    for (const status of ['"answered"', '"unavailable"', '"error"', '"sdk-absent"', '"os-too-old"', '"model-unavailable"']) expect(src, status).toContain(status);
    // Chaque chemin résout : jamais un appel laissé sans réponse.
    expect(src).not.toMatch(/invoke\.reject/);
  });

  it('Swift : texte synthétique fixe, aucun argument lu, aucun réseau ni stockage', () => {
    const src = read(SWIFT);
    expect(src).toMatch(/private let syntheticPrompt = "/);
    expect(src).not.toMatch(/parseArgs|getString|getArgs/);
    expect(src).not.toMatch(/URLSession|UserDefaults|FileManager|HealthKit|HKHealthStore/);
    expect(src).toMatch(/respond\(to: syntheticPrompt\)/);
  });

  it('pont : Rust seul appelle le plugin, iPhone seulement ; commande au manifeste ; capability à liste exacte', () => {
    const lib = read('src-tauri/src/lib.rs');
    expect(lib).toMatch(/#\[cfg\(target_os = "ios"\)\]\s*\nmod apple_intelligence;/);
    expect(lib).toContain('.plugin(tauri_plugin_apple_intelligence::init())');
    expect(lib).toContain('apple_intelligence::apple_intelligence_probe,');
    expect(read('src-tauri/build.rs')).toContain('"apple_intelligence_probe",');
    expect(read('src-tauri/Cargo.toml')).toMatch(/tauri-plugin-apple-intelligence = \{ path = "plugins\/apple-intelligence" \}/);
    expect(read('src-tauri/Cargo.lock')).toContain('name = "tauri-plugin-apple-intelligence"');
    const bridge = read('src-tauri/src/apple_intelligence.rs');
    expect(bridge).toMatch(/call_with_deadline/);
    expect(bridge).toMatch(/"probe"/);
    const capability = JSON.parse(read('src-tauri/capabilities/apple-intelligence-ios.json')) as Record<string, unknown>;
    expect(capability['windows']).toEqual(['main']);
    expect(capability['platforms']).toEqual(['iOS']);
    expect(capability['permissions']).toEqual(['allow-apple-intelligence-probe']);
  });

  it('aucune clé Info.plist ni entitlement pour Foundation Models', () => {
    const plist = read('src-tauri/Info.ios.plist');
    expect(plist).not.toMatch(/FoundationModels|AppleIntelligence/i);
    expect(Object.keys(parsePlist(plist) as Record<string, unknown>).some((key) => /intelligence|language/i.test(key))).toBe(false);
    expect(read('src-tauri/ios/Spartiate.entitlements')).not.toMatch(/intelligence|foundation/i);
  });
});
