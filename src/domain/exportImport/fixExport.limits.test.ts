import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PICK_ARCHIVE_MAX_BYTES, DEFAULT_PICK_MAX_BYTES } from '../../platform/files/types';
import { IMPORT_ZIP_LIMITS, buildExportArchive, exportFitsImportLimit, parseExportArchive, EXPORT_SV, type ExportData } from './archive';
import { buildZip, readZip } from './zip';

const DATA: ExportData = { profile: null, weights: [{ id: 'weight|2026-10-04|manual', date: '2026-10-04', kg: 82.4, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null }], settings: {} };

describe('FIX-EXPORT C-136 : plafond d’import aligné sur la limite de l’archive', () => {
  it('le plafond du sélecteur d’archive vaut la limite de lecture, côté TS et côté Rust (lecture du source)', () => {
    expect(DEFAULT_PICK_ARCHIVE_MAX_BYTES).toBe(IMPORT_ZIP_LIMITS.maxBytes);
    const rust = readFileSync('src-tauri/src/import.rs', 'utf8');
    const m = /pub const MAX_IMPORT_BYTES: usize = (\d+) \* 1024 \* 1024;/.exec(rust);
    expect(m).not.toBeNull();
    expect(Number(m?.[1]) * 1024 * 1024).toBe(IMPORT_ZIP_LIMITS.maxBytes);
  });
  it('le plafond des fichiers texte (CSV) reste 2 Mo', () => {
    expect(DEFAULT_PICK_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
  it('les sélecteurs d’archive des quatre plateformes utilisent le plafond d’archive', () => {
    for (const f of ['browser', 'iosFiles', 'open', 'tauriFiles']) {
      const src = readFileSync(`src/platform/files/${f}.ts`, 'utf8');
      expect(src, f).toContain('DEFAULT_PICK_ARCHIVE_MAX_BYTES');
    }
  });
  it('une archive synthétique de 3 Mo (entre 2 Mo et 24 Mio) est lue', async () => {
    const base = (await buildExportArchive(DATA, { date: '2026-10-05T08:00:00.000Z', sv: EXPORT_SV })).bytes;
    const big = buildZip([...readZip(base), { name: 'csv/padding.csv', data: new Uint8Array(3 * 1024 * 1024).fill(0x41) }]);
    expect(big.length).toBeGreaterThan(2 * 1024 * 1024);
    expect(big.length).toBeLessThan(IMPORT_ZIP_LIMITS.maxBytes);
    const parsed = await parseExportArchive(big, { currentSv: EXPORT_SV, currentYear: 2026 });
    expect(parsed.data.weights).toHaveLength(1);
  });
  it('exportFitsImportLimit : jusqu’à la limite, oui ; au-delà, non', () => {
    expect(exportFitsImportLimit(IMPORT_ZIP_LIMITS.maxBytes)).toBe(true);
    expect(exportFitsImportLimit(IMPORT_ZIP_LIMITS.maxBytes + 1)).toBe(false);
  });
});
