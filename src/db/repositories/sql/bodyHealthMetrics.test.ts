import { afterEach, describe, expect, it } from 'vitest';
import { HEALTH_METRIC_BOUNDS, HEALTH_METRIC_KINDS, isStoredMeasurementKind } from '../../../domain/bodyProgress/measurements';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-04 (D-113) : mesures importées de Santé (masse grasse, masse maigre, tour de taille, taille, fibres) rangées dans `measurement` sous des genres
 * propres à la source (`health_*`) : même table, même identité naturelle `date|genre`, aucune migration ; la saisie manuelle des zones n'est jamais touchée.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fc' as DeviceId;
const D = (day: number): LocalDate => `2026-11-${String(day).padStart(2, '0')}` as LocalDate;
let db: TestDb;
afterEach(async () => db.close());
const measures = async () => db.data.repos.measurements();

describe('genres de mesures importées', () => {
  it('liste fermée, format accepté par le CHECK SQL, bornes nommées', () => {
    expect([...HEALTH_METRIC_KINDS]).toEqual(['health_body_fat_pct', 'health_lean_mass_kg', 'health_waist_cm', 'health_height_cm', 'health_fiber_g']);
    for (const kind of HEALTH_METRIC_KINDS) {
      expect(kind.length).toBeLessThanOrEqual(32);
      expect(/^[a-z_]+$/.test(kind)).toBe(true);
      expect(isStoredMeasurementKind(kind)).toBe(true);
      expect(HEALTH_METRIC_BOUNDS[kind].max).toBeLessThan(1000);
    }
    expect(isStoredMeasurementKind('waist')).toBe(true);
    expect(isStoredMeasurementKind('health_unknown')).toBe(false);
  });
});

describe('MeasurementRepository : genres de Santé', () => {
  it('save, find (même supprimée), list d’un genre ; list() sans genre ne rend que les zones saisies', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await measures();
    const saved = await repo.save(D(8), 'health_body_fat_pct', 18.5);
    expect(saved).toMatchObject({ id: 'measurement|2026-11-08|health_body_fat_pct', kind: 'health_body_fat_pct', value: 18.5 });
    await repo.save(D(8), 'waist', 82);
    expect((await repo.list()).map((m) => m.kind)).toEqual(['waist']);
    expect((await repo.list('health_body_fat_pct')).map((m) => m.value)).toEqual([18.5]);
    expect(await repo.find(D(8), 'health_body_fat_pct')).toMatchObject({ value: 18.5, deletedAt: null });
    await repo.remove(D(8), 'health_body_fat_pct');
    expect((await repo.find(D(8), 'health_body_fat_pct'))?.deletedAt).not.toBeNull();
    expect(await repo.find(D(1), 'health_body_fat_pct')).toBeNull();
  });
  it('hors bornes du genre : refus, rien d’écrit ; la zone manuelle « waist » et le genre importé sont deux lignes', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await measures();
    await expect(repo.save(D(8), 'health_body_fat_pct', 2)).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.save(D(8), 'health_height_cm', 99)).rejects.toMatchObject({ code: 'invalid' });
    await repo.save(D(8), 'waist', 82);
    await repo.save(D(8), 'health_waist_cm', 83);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM measurement')).toEqual([{ n: 2 }]);
  });
});
