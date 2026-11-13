import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import { FULL_EXPORT_EXCLUDED, FULL_EXPORT_TABLES } from '../../domain/exportImport/fullExport';
import { TRAINING_EXPORT_TABLES } from '../../domain/exportImport/archive';

/**
 * I6-06 (D-222, § 22) : garde déterministe de la localisation. Aucune position n'est envoyée à une API ni écrite dans un journal : les modules qui
 * touchent une position (façade, domaine, écran, dépôt du cardio) n'appellent aucun réseau ni aucun journal ; le tracé n'est ni publié, ni exporté,
 * ni nommé par un module réseau ou de journal.
 */
const root = resolve(__dirname, '..', '..', '..');
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
const POSITION_MODULES = [...files('src/platform/geolocation'), ...files('src/domain/cardio'), ...files('src/features/cardio'), 'src/db/repositories/sql/cardioRepository.ts'];
const NETWORK = /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|plugin-http|from '[^']*platform\/(off|ai|sync)\b|invoke\(/;
const LOGGING = /\bconsole\.|logFailure|logEvent|\bappLog\b|platform\/logs|platform\/desktop\/log|recordLog|writeLog/;

describe('garde de la localisation (I6-06, D-222)', () => {
  it('les modules qui touchent une position existent et n’appellent ni réseau ni journal', () => {
    expect(POSITION_MODULES.length).toBeGreaterThanOrEqual(8);
    for (const path of POSITION_MODULES) {
      expect(existsSync(join(root, path)), path).toBe(true);
      const text = readFileSync(join(root, path), 'utf8');
      expect(NETWORK.test(text), `${path} : appel réseau`).toBe(false);
      expect(LOGGING.test(text), `${path} : journal`).toBe(false);
    }
  });

  it('le tracé n’est jamais publié ni exporté ; aucun module réseau, de journal ou de synchro ne le nomme', () => {
    expect(SYNC_CATALOGUE.table('cardio_track')).toBeUndefined();
    expect(TRAINING_EXPORT_TABLES as readonly string[]).not.toContain('cardio_track');
    expect(FULL_EXPORT_TABLES as readonly string[]).not.toContain('cardio_track');
    expect(FULL_EXPORT_EXCLUDED as readonly string[]).toContain('cardio_track');
    for (const dir of ['src/sync', 'src/platform/sync', 'src/platform/logs', 'src/platform/off', 'src/platform/ai', 'src/domain/sync']) {
      if (!existsSync(join(root, dir))) continue;
      for (const path of files(dir)) expect(/cardio_track|latitude|longitude/.test(readFileSync(join(root, path), 'utf8')), path).toBe(false);
    }
    for (const dir of ['src-tauri/src']) {
      const rs = (d: string): string[] => readdirSync(join(root, d)).flatMap((n) => (statSync(join(root, d, n)).isDirectory() ? rs(join(d, n)) : n.endsWith('.rs') ? [join(d, n)] : []));
      // Rust ne voit jamais une position (le plugin la remet à la WebView) ; `cardio_track` n'y figure que comme nom de table des sauvegardes.
      for (const path of rs(dir)) expect(/latitude|longitude/.test(readFileSync(join(root, path), 'utf8')), path).toBe(false);
    }
  });
});
