// BL-133 (CLEAN-03) : l'inventaire du banc legacy (scripts/cleanup/legacySyncInventory.mjs) ne compte que les fichiers qui en dépendent
// vraiment : un appareil simulé atteint par import (direct ou par un kit), l'ancien schéma, ou un dépôt hérité appelé.
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..', '..');

interface Row {
  readonly path: string;
  readonly entities: readonly string[];
}

function inventory(): Row[] {
  const out = execFileSync(process.execPath, [join(root, 'scripts/cleanup/legacySyncInventory.mjs'), '--json', '-'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out) as Row[];
}

describe('inventaire du banc legacy (BL-133)', () => {
  const rows = inventory();
  const paths = new Set(rows.map((r) => r.path));

  it('un tableau local nommé comme un dépôt hérité (`tasks.push`) n’est pas un appel de dépôt', () => {
    expect(paths.has('tests/unit/sync/hostile/evictedHeadReaders.test.ts')).toBe(false);
  });

  it('un fichier qui n’atteint aucun appareil simulé (codec, dossier simulé, plan de pannes) n’est pas compté', () => {
    for (const path of ['tests/unit/syncCodec.test.ts', 'tests/unit/syncCodecQa.test.ts', 'tests/unit/syncSeparation.test.ts', 'tests/unit/sync/hostile/cloudSimDeletions.test.ts', 'tests/unit/sync/sim/folderSimDeviceWait.test.ts', 'src/platform/sync/faultPlan.test.ts']) {
      expect(paths.has(path), path).toBe(false);
    }
  });

  it('les dépendances réelles restent comptées : simulateur, kit qui l’importe, dépôt hérité appelé', () => {
    expect(paths.has('tests/sim/syncDevice.ts')).toBe(true);
    expect(paths.has('tests/unit/sync/hostile/scenario1Orphan.test.ts')).toBe(true);
    expect(rows.find((r) => r.path === 'tests/unit/sync/deletions.test.ts')?.entities).toContain('tasks');
  });
});
