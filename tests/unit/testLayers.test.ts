import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SHELL-0294e (BL-145, ADR 0001) : les tests suivent les couches de leur code. ESLint ignore les fichiers de test (forbidLayers) ; cette garde
 * les lit : un test de `src/<couche>` n'importe pas une couche que cette couche n'a pas le droit d'importer. Les fixtures partagées vivent
 * dans `tests/fixtures`, jamais dans une autre couche de `src`. Les exceptions sont nommées et motivées ; une exception qui n'a plus lieu d'être
 * est refusée (la liste ne ment pas).
 */
const SRC = resolve(import.meta.dirname, '..', '..', 'src');

const FORBIDDEN: Readonly<Record<string, readonly string[]>> = {
  domain: ['db', 'features', 'ui', 'sync', 'platform', 'i18n'],
  db: ['features', 'ui', 'sync', 'platform', 'i18n'],
  sync: ['features', 'ui'],
  i18n: ['db', 'features', 'ui', 'sync', 'platform'],
  ui: ['db', 'features', 'sync', 'platform'],
};

/** Exceptions : fichier (relatif à src, séparateur /) → motif. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  'domain/sync/compat.test.ts': 'src/domain/sync/** : déplacement à relire par sync-icloud (D-26), type de platform/sync',
  'domain/sync/devices.test.ts': 'src/domain/sync/** : déplacement à relire par sync-icloud (D-26), type de platform/sync',
  'domain/syncBanners.test.ts': 'type de platform/sync, avec les tests de domain/sync : même relecture sync-icloud',
  'domain/sync/epochCarryReport.test.ts': 'src/domain/sync/** : déplacement à relire par sync-icloud (D-26), semences de db',
  'i18n/plural.test.ts': 'lit le dossier src/i18n lui-même (fs relatif au fichier) : le déplacer casserait son balayage',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

function violations(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const parts = relative(SRC, file).split(sep);
    const layer = parts[0] ?? '';
    const forbidden = FORBIDDEN[layer];
    if (forbidden === undefined) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?:from|import\()\s*'(\.[^']*)'/g)) {
      const target = relative(SRC, resolve(join(file, '..'), match[1] ?? '')).split(sep);
      const targetLayer = target[0] ?? '';
      // src/domain/sync est du domaine pur (ADR 0011) : ce n'est pas la couche src/sync.
      const sameDomain = layer === 'domain' && targetLayer === 'domain';
      if (!sameDomain && forbidden.includes(targetLayer)) {
        const key = parts.join('/');
        found.set(key, [...(found.get(key) ?? []), `${targetLayer} (${match[1] ?? ''})`]);
      }
    }
  }
  return found;
}

describe('BL-145 : les tests respectent les couches (ADR 0001)', () => {
  const found = violations();

  it('aucun test ne franchit une couche, hors exceptions motivées', () => {
    const unexpected = [...found.entries()].filter(([file]) => EXCEPTIONS[file] === undefined);
    expect(unexpected).toEqual([]);
  });

  it('chaque exception existe encore et franchit encore une couche', () => {
    expect(Object.keys(EXCEPTIONS).filter((file) => !found.has(file))).toEqual([]);
  });
});
