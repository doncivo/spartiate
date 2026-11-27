import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import type { EquipmentProfileInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { HOME_PROFILE } from '../../../../tests/fixtures/training';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * EQUIP-0302 (BL-175, D-674) : poids du gilet lesté au profil de matériel (`equipment_profile.vest_kg`, migration 0025). Dépôt : écrit, relu, gardé
 * par une modification qui ne le nomme pas, effacé par `null`, refusé hors bornes. Export : rendu tel quel au schéma 25 ; une archive du schéma 24
 * (sans la clé) est lue avec un poids nul ; « Fusionner » une archive ancienne garde le poids local ; une valeur hors bornes est refusée à la lecture.
 * Données synthétiques.
 */
const A = '60000000-0000-4000-8000-0000000302c1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000302d1' as DeviceId;
const AT = '2026-11-27T10:00:00.000Z';
const P = '8a3a1c2e-0000-4000-8000-000000000302';
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, AT);
  opened.push(db);
  return db;
};
const VEST_INVENTORY = { ...HOME_PROFILE.inventory, available: [...HOME_PROFILE.inventory.available, 'weighted-vest'] };
const profile = (over: Partial<EquipmentProfileInput> = {}): EquipmentProfileInput => ({ id: P, name: 'Maison', kind: 'maison', inventory: VEST_INVENTORY, increments: {}, ...over });
const vestOf = async (db: TestDb) => db.driver.select('SELECT vest_kg FROM equipment_profile');

describe('EQUIP-0302 : dépôt des profils, poids du gilet', () => {
  it('création avec un poids : relu ; sans poids : nul', async () => {
    const db = await open(A);
    const repo = await db.data.repos.equipmentProfiles();
    expect((await repo.create(profile({ vestKg: 7.5 }))).vestKg).toBe(7.5);
    expect((await repo.get(P))?.vestKg).toBe(7.5);
    const other = '8a3a1c2e-0000-4000-8000-000000000303';
    expect((await repo.create(profile({ id: other, name: 'Voyage' }))).vestKg).toBeNull();
  });

  it('modification sans le poids : gardé ; poids changé : capturé seul ; null : effacé', async () => {
    const db = await open(A);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create(profile({ vestKg: 10 }));
    db.clock.advance(1_000);
    expect((await repo.update(P, { name: 'Maison 2' })).vestKg).toBe(10);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    expect((await repo.update(P, { vestKg: 12.5 })).vestKg).toBe(12.5);
    expect(await db.driver.select("SELECT field FROM sync_outbox WHERE table_name = 'equipment_profile' ORDER BY field")).toEqual([{ field: 'vest_kg' }]);
    db.clock.advance(1_000);
    expect((await repo.update(P, { vestKg: null })).vestKg).toBeNull();
  });

  it('hors bornes ou au-delà du dixième : refusé, rien d’écrit', async () => {
    const db = await open(A);
    const repo = await db.data.repos.equipmentProfiles();
    await expect(repo.create(profile({ vestKg: 0.2 }))).rejects.toMatchObject({ code: 'invalid' });
    await repo.create(profile({ vestKg: 10 }));
    for (const bad of [61, 7.55, 0]) await expect(repo.update(P, { vestKg: bad })).rejects.toMatchObject({ code: 'invalid' });
    expect(await vestOf(db)).toEqual([{ vest_kg: 10 }]);
  });
});

const importInto = (db: TestDb, data: ExportData, mode: 'merge' | 'replace') =>
  db.data.transaction(async (r) => {
    const repo = await r.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), data, mode), 2026);
  });
/** Archive du schéma `sv` ; avant le 25, sans la clé `vest_kg` ; `patch` modifie chaque profil exporté. */
async function archive(db: TestDb, sv: number, patch: Record<string, unknown> = {}): Promise<ExportData> {
  const data = await (await db.data.repos.exportImport()).readExportData();
  const built = await buildExportArchive(data, { date: AT, sv });
  const json = JSON.parse(new TextDecoder().decode(readZip(built.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
  json.training['equipment_profile'] = (json.training['equipment_profile'] ?? []).map((row) => ({ ...(sv >= 25 ? row : Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'vest_kg'))), ...patch }));
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const zip = buildZip([
    { name: 'data.json', data: bytes },
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'spartiate', sv, date: AT, sha256: sha256Hex(bytes) })) },
  ]);
  return (await parseExportArchive(zip, { currentSv: EXPORT_SV, currentYear: 2026 })).data;
}

describe('EQUIP-0302 : export et import du poids du gilet', () => {
  it('schéma 25 : la version d’export suit la dernière migration ; le poids revient tel quel', async () => {
    expect(EXPORT_SV).toBe(25);
    const a = await open(A);
    await (await a.data.repos.equipmentProfiles()).create(profile({ vestKg: 7.5 }));
    const exported = await (await a.data.repos.exportImport()).readExportData();
    expect(exported.training?.equipment_profile?.[0]?.values).toMatchObject({ vest_kg: 7.5 });
    const b = await open(B);
    await importInto(b, await archive(a, EXPORT_SV), 'replace');
    expect(await vestOf(b)).toEqual([{ vest_kg: 7.5 }]);
  });

  it('archive du schéma 24 (sans la clé) : lue sans erreur, poids nul', async () => {
    const a = await open(A);
    await (await a.data.repos.equipmentProfiles()).create(profile({ vestKg: 7.5 }));
    const data = await archive(a, 24);
    expect(data.training?.equipment_profile?.[0]?.values).toMatchObject({ vest_kg: null });
    const b = await open(B);
    await importInto(b, data, 'replace');
    expect(await vestOf(b)).toEqual([{ vest_kg: null }]);
  });

  it('archive du schéma 24, « Fusionner » sur une base du 25 : le poids local est gardé', async () => {
    const a = await open(A);
    await (await a.data.repos.equipmentProfiles()).create(profile());
    const data = await archive(a, 24);
    const b = await open(B);
    await (await b.data.repos.equipmentProfiles()).create(profile({ vestKg: 15 }));
    await importInto(b, data, 'merge');
    expect(await vestOf(b)).toEqual([{ vest_kg: 15 }]);
  });

  it('poids hors bornes dans une archive : refusée à la lecture, jamais par un échec SQL', async () => {
    const a = await open(A);
    await (await a.data.repos.equipmentProfiles()).create(profile({ vestKg: 7.5 }));
    for (const bad of [0, -2, 61]) await expect(archive(a, EXPORT_SV, { vest_kg: bad })).rejects.toMatchObject({ code: 'invalid-data' });
  });
});
