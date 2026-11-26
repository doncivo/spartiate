// SHELL-0294b (C-158, § 19.4), DEC-0298 (D-648, Ali, 26/11, Q-33) : entitlements durables relus contre le bloc XML du § 19.4 du PRD,
// qui ne demande plus que la clé HealthKit. Toute clé ajoutée ou retirée d'un seul côté fait échouer ce test.
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

  it('les clés du bloc XML du § 19.4 égalent celles de la source durable : HealthKit seule (D-648)', () => {
    const section = chapter.split('### 19.4')[1] ?? '';
    const xml = /```xml\n([\s\S]*?)```/.exec(section)?.[1] ?? '';
    const keys = [...xml.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]).sort();
    expect(keys).toEqual(['com.apple.developer.healthkit']);
    expect(Object.keys(entitlements).sort()).toEqual(keys);
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
