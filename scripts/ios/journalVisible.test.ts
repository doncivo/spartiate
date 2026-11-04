// ios-demarrage : le journal technique est visible dans l'app Fichiers (D-47 : aucune autre clé superflue, photothèque interdite).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPlistContract } from './check-plist-contract.mjs';
import { parsePlist } from './plist.mjs';

const root = join(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const plist = parsePlist(read('src-tauri/Info.ios.plist')) as Record<string, unknown>;
const contract = JSON.parse(read('scripts/ios/plist-contract.json')) as { plugins: Record<string, unknown>; forbiddenKeys: string[] };

describe('journal visible dans Fichiers', () => {
  it('Info.ios.plist active le partage de fichiers et l’ouverture sur place', () => {
    expect(plist['UIFileSharingEnabled']).toBe(true);
    expect(plist['LSSupportsOpeningDocumentsInPlace']).toBe(true);
  });

  it('le contrat plist déclare ces deux clés et le plist le respecte', () => {
    expect(contract.plugins['journal']).toEqual({ story: 'ios-demarrage', keys: ['UIFileSharingEnabled', 'LSSupportsOpeningDocumentsInPlace'] });
    expect(checkPlistContract(contract, plist)).toEqual({ errors: [], warnings: [] });
  });

  it('le contrat refuse toujours la photothèque (D-47)', () => {
    expect(contract.forbiddenKeys).toContain('NSPhotoLibraryUsageDescription');
    expect(Object.hasOwn(plist, 'NSPhotoLibraryUsageDescription')).toBe(false);
  });
});
