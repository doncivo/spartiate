import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE } from '../../../src/domain/sync/syncTables';
import { SYNC_COMMANDS } from '../../../src/platform/sync/types';

/**
 * I5-03 point 1 (D-90, H-26) : le dossier `iCloud Drive/Spartiate/sante/` (fichiers du raccourci Santé) est lu par le marque-page de la
 * synchro, mais n'appartient pas à la synchro. Côté TypeScript, trois conditions (les preuves Rust sont dans
 * `src-tauri/tests/desktop/sync_health.rs`, relues par sync-icloud, D-26) :
 * 1. aucun code de synchro ne nomme `sante`, la commande de lecture ni l'import des fichiers Raccourcis ;
 * 2. la synchro n'a aucune commande de lecture ou d'écriture de `sante/` : les 25 commandes `sync_*` sont inchangées, la lecture est une
 *    commande à part (`health_files_read`), appelée par un seul module ;
 * 3. aucune table des fichiers (échantillons, état d'import) n'est dans le catalogue publié : rien de `sante/` n'est publié ni chiffré.
 */

const root = join(__dirname, '../../..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
const text = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('dossier sante : séparé de la synchro', () => {
  const SYNC_DIRS = ['src/sync', 'src/domain/sync', 'src/platform/sync'];

  it('aucun code de synchro ne nomme sante, health_files_read ni l’import des fichiers Raccourcis', () => {
    const files = SYNC_DIRS.flatMap(sources);
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const source = text(file);
      expect(source, file).not.toMatch(/health_files_read|shortcutFiles|recoveryImport|recoverySampleRepository/);
      expect(source, file).not.toMatch(/['"`/]sante['"`/]/);
    }
  });

  it('les 25 commandes sync_* sont inchangées : aucune lecture ni écriture de sante/ par une commande de synchro', () => {
    expect(SYNC_COMMANDS).toHaveLength(25);
    expect(SYNC_COMMANDS.some((c) => /health|sante/.test(c))).toBe(false);
  });

  it('health_files_read n’est appelée que par la façade platform/shortcutFiles', () => {
    const callers = sources('src').filter((file) => /health_files_read/.test(text(file)));
    expect(callers.map((f) => f.split(sep).join('/'))).toEqual(['src/platform/shortcutFiles/index.ts']);
  });

  it('le catalogue publié ne contient aucune table des fichiers du raccourci', () => {
    const names = SYNC_CATALOGUE.tables.map((t) => t.name);
    for (const local of ['recovery_sample', 'recovery_import_state']) {
      expect(names).not.toContain(local);
      expect(SYNC_CATALOGUE.table(local)).toBeUndefined();
    }
    // Seuls les résumés calculés sont publiés (D-89) : jamais une mesure brute.
    expect(names.filter((n) => n.startsWith('recovery'))).toEqual(['recovery_day']);
  });
});
