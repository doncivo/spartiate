// SHELL-0294b (C-158, § 19.4) : entitlements durables relus contre le chapitre 19.4 du PRD. L'écart (healthkit.access et
// keychain-access-groups absents) est une décision écrite (D-598), jamais un oubli : toute clé ajoutée ou retirée fait échouer ce test.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlist } from './plist.mjs';

const root = resolve(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

describe('C-158 : entitlements contre § 19.4', () => {
  const entitlements = parsePlist(read('src-tauri/ios/Spartiate.entitlements')) as Record<string, unknown>;
  const chapter = read('docs/prd/19-plugins-swift-et-contrat-ios.md');
  const decisions = read('docs/decisions.md');

  it('le § 19.4 demande trois clés ; la source durable n’en porte qu’une, HealthKit', () => {
    for (const key of ['com.apple.developer.healthkit', 'com.apple.developer.healthkit.access', 'keychain-access-groups']) expect(chapter).toContain(key);
    expect(Object.keys(entitlements).sort()).toEqual(['com.apple.developer.healthkit']);
    expect(entitlements['com.apple.developer.healthkit']).toBe(true);
  });

  it('l’écart au § 19.4 est une décision écrite (D-598) qui nomme les deux clés absentes et la raison du Trousseau', () => {
    const line = decisions.split('\n').find((l) => l.startsWith('| D-598 |')) ?? '';
    expect(line).toContain('§ 19.4');
    expect(line).toContain('com.apple.developer.healthkit.access');
    expect(line).toContain('keychain-access-groups');
    expect(line).toMatch(/Trousseau/);
  });
});
