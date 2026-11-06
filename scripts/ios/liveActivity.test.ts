import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlist } from './plist.mjs';

/**
 * SPA-007, lot A : sources durables de l'extension Live Activity (compteur de 60 s). Aucun App Group, aucun push, aucun mode d'arrière-plan,
 * aucun nouvel entitlement : Live Activities n'a besoin d'aucune capacité restreinte (le compte Apple gratuit n'en donne pas).
 */
const root = resolve(__dirname, '..', '..');
const DIR = 'src-tauri/ios/LiveActivity';
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('sources durables de l’extension (SPA-007 lot A)', () => {
  it('les trois fichiers existent', () => {
    for (const name of ['SpartiateTimerAttributes.swift', 'SpartiateLiveActivity.swift', 'Info.plist']) expect(existsSync(join(root, DIR, name)), name).toBe(true);
  });

  it('attributs : ActivityAttributes avec ContentState { endDate: Date; label: String }', () => {
    const src = read(`${DIR}/SpartiateTimerAttributes.swift`);
    expect(src).toMatch(/struct SpartiateTimerAttributes:\s*ActivityAttributes/);
    expect(src).toMatch(/struct ContentState:\s*Codable,\s*Hashable/);
    expect(src).toMatch(/var endDate:\s*Date/);
    expect(src).toMatch(/var label:\s*String/);
  });

  it('widget : écran verrouillé et Dynamic Island compacte, minimale, étendue, décompte par Text(timerInterval:)', () => {
    const src = read(`${DIR}/SpartiateLiveActivity.swift`);
    expect(src).toMatch(/ActivityConfiguration\(for:\s*SpartiateTimerAttributes\.self\)/);
    for (const part of ['compactLeading', 'compactTrailing', 'minimal', 'DynamicIslandExpandedRegion']) expect(src, part).toContain(part);
    expect(src).toMatch(/Text\(timerInterval:[^)]*countsDown:\s*true\)/);
    expect(src).toMatch(/@main/);
    // Le décompte avance seul : aucune minuterie ni mise à jour poussée.
    expect(src).not.toMatch(/Timer\.scheduledTimer|URLSession|pushType|\.update\(/);
  });

  it('clôture I0 : à l’échéance le widget rend lui-même « Terminé » (état périmé), sans app ni mise à jour', () => {
    const attributes = read(`${DIR}/SpartiateTimerAttributes.swift`);
    expect(attributes).toMatch(/var finishedLabel:\s*String/);
    const src = read(`${DIR}/SpartiateLiveActivity.swift`);
    expect(src).toMatch(/context\.isStale/);
    expect(src).toMatch(/finishedLabel/);
    // Écran verrouillé, Dynamic Island étendue / compacte / minimale : toutes les présentations tiennent compte de l'état final.
    expect((src.match(/context\.isStale/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(src).not.toMatch(/Timer.scheduledTimer|URLSession|pushType/);
  });

  it('Info.plist de l’extension : point d’extension WidgetKit, aucun mode d’arrière-plan ni groupe', () => {
    const plist = parsePlist(read(`${DIR}/Info.plist`)) as Record<string, unknown>;
    expect((plist['NSExtension'] as Record<string, string>)['NSExtensionPointIdentifier']).toBe('com.apple.widgetkit-extension');
    expect(plist['CFBundlePackageType']).toBe('XPC!');
    expect(JSON.stringify(plist)).not.toMatch(/UIBackgroundModes|application-groups|aps-environment/);
  });

  it('aucun nouvel entitlement, App Group, push ni mode de fond dans les sources', () => {
    const all = ['SpartiateTimerAttributes.swift', 'SpartiateLiveActivity.swift', 'Info.plist'].map((n) => read(`${DIR}/${n}`)).join('\n');
    expect(all).not.toMatch(/application-groups|group\.|aps-environment|UIBackgroundModes|pushToken|pushType/);
    expect(existsSync(join(root, DIR, 'SpartiateLiveActivity.entitlements'))).toBe(false);
    const entitlements = parsePlist(read('src-tauri/ios/Spartiate.entitlements')) as Record<string, unknown>;
    expect(Object.keys(entitlements)).toEqual(['com.apple.developer.healthkit']);
  });
});

describe('app : NSSupportsLiveActivities (SPA-007 lot A)', () => {
  it('Info.ios.plist déclare NSSupportsLiveActivities = true', () => {
    const plist = parsePlist(read('src-tauri/Info.ios.plist')) as Record<string, unknown>;
    expect(plist['NSSupportsLiveActivities']).toBe(true);
  });

  it('le contrat des permissions porte la clé (plugin live-activity, story SPA-007) et interdit toujours UIBackgroundModes', () => {
    const contract = JSON.parse(read('scripts/ios/plist-contract.json')) as { plugins: Record<string, unknown>; forbiddenKeys: string[] };
    expect(contract.plugins['live-activity']).toEqual({ story: 'SPA-007', keys: ['NSSupportsLiveActivities'] });
    expect(contract.forbiddenKeys).toContain('UIBackgroundModes');
  });
});

describe('signature et IPA finale (SPA-007 lot C)', () => {
  const wf = read('.github/workflows/build-ios.yml');

  it('ordre : extension signée d’abord, puis l’app avec ses entitlements, puis IPA reconstruite', () => {
    const appex = 'codesign -s - --force "$WORK/Payload/Spartiate.app/PlugIns/SpartiateLiveActivity.appex"';
    const app = 'codesign -s - --entitlements src-tauri/gen/apple/Spartiate.entitlements --force "$WORK/Payload/Spartiate.app"';
    const zip = 'zip -qry "$GITHUB_WORKSPACE/ipa/Spartiate.ipa" Payload';
    const at = [appex, app, zip].map((m) => wf.indexOf(m));
    expect(at.every((i) => i >= 0), JSON.stringify([appex, app, zip].filter((_, i) => at[i] < 0))).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('l’extension est signée sans entitlements', () => {
    const line = wf.split('\n').find((l) => l.includes('PlugIns/SpartiateLiveActivity.appex') && l.includes('codesign -s -')) ?? '';
    expect(line).not.toMatch(/--entitlements/);
  });

  it('contrôles sur l’IPA finale : appex présent, deux signatures strictes, plist de l’extension relu, résumé du run', () => {
    expect(wf).toMatch(/test -d "\$APP\/PlugIns\/SpartiateLiveActivity\.appex"/);
    expect(wf).toMatch(/codesign --verify --strict --verbose=2 "\$APP\/PlugIns\/SpartiateLiveActivity\.appex"/);
    expect(wf).toMatch(/codesign --verify --strict --verbose=2 "\$APP"/);
    expect(wf).toMatch(/NSExtensionPointIdentifier/);
    expect(wf).toMatch(/com\.apple\.widgetkit-extension/);
    expect(wf).toMatch(/fr\.spartiate\.app\.LiveActivity/);
    expect(wf).toMatch(/Extension Live Activity de l'IPA finale/);
    // Aucun entitlement dans l'extension : la sortie de codesign -d --entitlements n'est pas exigée, mais l'absence d'App Group et de push l'est.
    expect(wf).toMatch(/application-groups/);
    // Mêmes versions pour l'app et l'extension (CFBundleVersion différent = installation refusée).
    expect(wf).toMatch(/CFBundleVersion différent/);
  });
});
