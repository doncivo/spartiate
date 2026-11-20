import { describe, expect, it } from 'vitest';
import { archiveResetVerdict } from './dataReset';
import { EXPORT_SV, buildExportArchive, parseExportArchive, type ExportData } from './exportImport/archive';
import { buildFullExport } from './exportImport/fullExport';
import { buildZip, readZip } from './exportImport/zip';
import type { Hlc } from './types';

const hlc = (ms: number, c = 0): Hlc => `${String(ms).padStart(15, '0')}-${c.toString(16).padStart(4, '0')}-60000000-0000-4000-8000-0000000000e5` as Hlc;
const T = Date.parse('2026-11-20T10:00:00.000Z');
const H = hlc(T);
const base = { localResetAtMs: T, localHorizon: H as string | null };

describe('FIX-EXPORT C-109 : verdict d’une archive face à la remise à zéro locale (pur)', () => {
  it('aucun effacement ici : admise, même sans horizon', () => {
    expect(archiveResetVerdict({ manifestDate: '2026-01-01T00:00:00.000Z', manifestHorizon: null, localResetAtMs: null, localHorizon: null })).toBe('ok');
  });
  it('date antérieure ou égale à l’effacement, ou illisible : before-reset', () => {
    expect(archiveResetVerdict({ ...base, manifestDate: '2026-11-20T10:00:00.000Z', manifestHorizon: H })).toBe('before-reset');
    expect(archiveResetVerdict({ ...base, manifestDate: 'pas une date', manifestHorizon: H })).toBe('before-reset');
  });
  it('C-109 : faite APRÈS l’effacement par un appareil resté à l’horizon précédent : before-reset', () => {
    expect(archiveResetVerdict({ ...base, manifestDate: '2026-11-20T10:05:00.000Z', manifestHorizon: hlc(T - 3_600_000) })).toBe('before-reset');
  });
  it('faite après l’effacement par un appareil sans horizon (jamais effacé, ou ancienne version) : unproven', () => {
    expect(archiveResetVerdict({ ...base, manifestDate: '2026-11-20T10:05:00.000Z', manifestHorizon: null })).toBe('unproven');
  });
  it('horizon égal ou plus récent : admise', () => {
    expect(archiveResetVerdict({ ...base, manifestDate: '2026-11-20T10:05:00.000Z', manifestHorizon: H })).toBe('ok');
    expect(archiveResetVerdict({ ...base, manifestDate: '2026-11-20T10:05:00.000Z', manifestHorizon: hlc(T + 60_000) })).toBe('ok');
  });
});

const DATA: ExportData = { profile: null, weights: [], settings: {} };
const DATE = '2026-11-20T10:05:00.000Z';

describe('FIX-EXPORT C-109 : l’horizon dans le manifeste', () => {
  it('écrit seulement si l’appareil en a un ; hash de data.json inchangé ; relu', async () => {
    const without = await buildExportArchive(DATA, { date: DATE, sv: EXPORT_SV });
    const withH = await buildExportArchive(DATA, { date: DATE, sv: EXPORT_SV, resetHorizon: H });
    expect(withH.dataSha256).toBe(without.dataSha256);
    const a = await parseExportArchive(without.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
    const b = await parseExportArchive(withH.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
    expect(a.manifest.resetHorizon ?? null).toBeNull();
    expect(b.manifest.resetHorizon).toBe(H);
  });
  it('l’export complet porte aussi l’horizon', async () => {
    const full = await buildFullExport(DATA, { date: DATE, sv: EXPORT_SV, appVersion: '0.0.0', resetHorizon: H });
    const parsed = await parseExportArchive(full.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
    expect(parsed.manifest.resetHorizon).toBe(H);
  });
  it('un horizon illisible dans le manifeste : archive refusée (bad-manifest)', async () => {
    const ok = await buildExportArchive(DATA, { date: DATE, sv: EXPORT_SV, resetHorizon: H });
    const entries = readZip(ok.bytes).map((e) => (e.name === 'manifest.json' ? { name: e.name, data: new TextEncoder().encode(new TextDecoder().decode(e.data).replace(H, 'xx')) } : e));
    await expect(parseExportArchive(buildZip(entries), { currentSv: EXPORT_SV, currentYear: 2026 })).rejects.toMatchObject({ code: 'bad-manifest' });
  });
});

describe('FIX-EXPORT qa-test : cas limites de l’horizon', () => {
  const manifestWith = async (value: unknown): Promise<Uint8Array> => {
    const ok = await buildExportArchive(DATA, { date: DATE, sv: EXPORT_SV });
    const entries = readZip(ok.bytes).map((e) => {
      if (e.name !== 'manifest.json') return e;
      const m = JSON.parse(new TextDecoder().decode(e.data)) as Record<string, unknown>;
      return { name: e.name, data: new TextEncoder().encode(JSON.stringify({ ...m, reset_horizon: value, inconnue: 1 })) };
    });
    return buildZip(entries);
  };
  it.each([null, 42, '', H.toUpperCase()])('reset_horizon %j : refusé (bad-manifest)', async (value) => {
    await expect(parseExportArchive(await manifestWith(value), { currentSv: EXPORT_SV, currentYear: 2026 })).rejects.toMatchObject({ code: 'bad-manifest' });
  });
  it('une clé de manifeste inconnue est ignorée ; horizon valide relu', async () => {
    const parsed = await parseExportArchive(await manifestWith(H), { currentSv: EXPORT_SV, currentYear: 2026 });
    expect(parsed.manifest.resetHorizon).toBe(H);
  });
  it('archive des versions précédentes (sans horizon) : lue, et admise tant que cet appareil n’a jamais été effacé', async () => {
    const legacy = await parseExportArchive((await buildExportArchive(DATA, { date: '2026-10-05T08:00:00.000Z', sv: 16 })).bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
    expect(legacy.manifest.resetHorizon).toBeUndefined();
    expect(archiveResetVerdict({ manifestDate: legacy.manifest.date, manifestHorizon: null, localResetAtMs: null, localHorizon: null })).toBe('ok');
  });
  it('appareil effacé dont l’horizon n’est pas lisible (null) mais heure d’effacement connue : la date seule décide', () => {
    expect(archiveResetVerdict({ manifestDate: '2026-11-20T10:05:00.000Z', manifestHorizon: null, localResetAtMs: T, localHorizon: null })).toBe('ok');
    expect(archiveResetVerdict({ manifestDate: '2026-11-20T09:00:00.000Z', manifestHorizon: null, localResetAtMs: T, localHorizon: null })).toBe('before-reset');
  });
});
