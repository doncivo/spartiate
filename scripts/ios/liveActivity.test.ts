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

  it('I1-02 : état final lisible sans rafraîchissement (heure de fin permanente), option retenue écrite dans le widget', () => {
    const src = read(`${DIR}/SpartiateLiveActivity.swift`);
    // Le texte « Terminé » vient de l'i18n (finishedLabel), jamais en dur.
    expect(src).toMatch(/Text\(state\.finishedLabel\)/);
    expect(src).not.toMatch(/"Terminé"|"Repos"/);
    // Heure de fin rendue en permanence (lisible même si la vue n'est jamais redessinée après l'échéance).
    expect(src).toMatch(/Text\(endDate,\s*style:\s*\.time\)/);
    expect(src).toMatch(/SpartiateEndTime\(endDate:\s*context\.state\.endDate\)/);
    // Option retenue et limite documentées ; aucun `end` anticipé (il retirerait l'activité de la Dynamic Island).
    expect(src).toMatch(/Option retenue/);
    expect(src).toMatch(/Dynamic Island/);
    expect(src).not.toMatch(/\.end\(/);
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

/** Luminance relative WCAG 2.x d'une couleur « RRGGBB ». */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('I1-02 : couleurs de la charte et texte clair forcé sur chaque présentation', () => {
  const src = read(`${DIR}/SpartiateLiveActivity.swift`);
  const tokens = read('src/ui/theme/tokens.css');
  const rootBlock = tokens.slice(tokens.indexOf(':root'), tokens.indexOf('}', tokens.indexOf(':root')));

  /** Couleur Swift `static let <nom> = Color(spartiateHex: 0xRRGGBB) // --ct-color-…` et le token cité. */
  function swiftColor(name: string): { hex: string; token: string } {
    const match = src.match(new RegExp(`static let ${name} = Color\\(spartiateHex: 0x([0-9A-Fa-f]{6})\\)\\s*//\\s*(--ct-color-[a-z-]+)`));
    expect(match, name).not.toBeNull();
    return { hex: (match as RegExpMatchArray)[1].toLowerCase(), token: (match as RegExpMatchArray)[2] };
  }

  function tokenValue(token: string): string {
    const match = rootBlock.match(new RegExp(`${token}:\\s*#([0-9a-fA-F]{6})`));
    expect(match, token).not.toBeNull();
    return (match as RegExpMatchArray)[1].toLowerCase();
  }

  it('chaque couleur du widget reprend la valeur du token cité (tokens.css, :root)', () => {
    for (const name of ['fond', 'texte', 'texteSecondaire', 'bronze']) {
      const { hex, token } = swiftColor(name);
      expect(hex, `${name} = ${token}`).toBe(tokenValue(token));
    }
  });

  it('le fond est sombre et chaque couleur de texte ou d’icône a un contraste AA (≥ 4,5:1) sur lui', () => {
    const fond = swiftColor('fond').hex;
    expect(luminance(fond)).toBeLessThan(0.05);
    for (const name of ['texte', 'texteSecondaire', 'bronze']) expect(contrast(swiftColor(name).hex, fond), name).toBeGreaterThanOrEqual(4.5);
  });

  it('le fond opaque de la charte remplace le noir translucide ; l’apparence ne suit pas le mode clair / sombre du téléphone', () => {
    expect(src).toMatch(/\.activityBackgroundTint\(SpartiateCharte\.fond\)/);
    expect(src).toMatch(/\.activitySystemActionForegroundColor\(SpartiateCharte\.texte\)/);
    expect(src).not.toMatch(/Color\.black|Color\.white|\.primary|\.secondary\b/);
    expect(src).toMatch(/\.keylineTint\(SpartiateCharte\.bronze\)/);
    expect((src.match(/\.environment\(\\\.colorScheme,\s*\.dark\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('écran verrouillé, Dynamic Island étendue (3 régions), compacte (2) et minimale : couleur claire forcée dans chacune', () => {
    const between = (from: string, to: string): string => {
      const start = src.indexOf(from);
      const end = src.indexOf(to, start + from.length);
      expect(start, from).toBeGreaterThanOrEqual(0);
      expect(end, to).toBeGreaterThan(start);
      return src.slice(start, end);
    };
    const parts: Record<string, string> = {
      'écran verrouillé': between('struct SpartiateLockScreenView', '\nstruct '),
      'étendue, début': between('DynamicIslandExpandedRegion(.leading)', 'DynamicIslandExpandedRegion(.trailing)'),
      'étendue, fin': between('DynamicIslandExpandedRegion(.trailing)', 'DynamicIslandExpandedRegion(.bottom)'),
      'étendue, bas': between('DynamicIslandExpandedRegion(.bottom)', '} compactLeading:'),
      'compacte, début': between('} compactLeading:', '} compactTrailing:'),
      'compacte, fin': between('} compactTrailing:', '} minimal:'),
      minimale: between('} minimal:', '.keylineTint'),
    };
    for (const [name, part] of Object.entries(parts)) expect(part, name).toMatch(/\.foregroundStyle\(SpartiateCharte\.(texte|texteSecondaire|bronze)\)/);
    expect(src).toMatch(/ActivityConfiguration\(for:\s*SpartiateTimerAttributes\.self\)\s*\{\s*context in\s*SpartiateLockScreenView\(context:\s*context\)/);
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
