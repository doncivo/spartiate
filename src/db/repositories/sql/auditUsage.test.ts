import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { createMesocycleSpec, changeNextWeeks, nextMesocycleSpec } from '../../../domain/training/mesocycle';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import type { DeviceId, LocalDate, Weekday } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * AUDIT-USAGE (lot 0.27.0) : parcours d'Ali depuis le 15/11 rejoués sur base synthétique (aucune donnée réelle, D-292). Ce fichier garde
 * les parcours CONFORMES (caractérisation) ; les écarts sont prouvés par les tests rouges des tickets FIX-0271, PROG-04 et PROG-05
 * (docs/AUDIT-USAGE.md).
 */

const A = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const X = '60000000-0000-4000-8000-0000000000c1' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId, at: string): Promise<TestDb> => {
  const db = await openBaseDb(device, at);
  opened.push(db);
  return db;
};
const kcal = (k: number) => ({ kcal: k, proteinG: 150, fatG: 70, carbG: 250 });

/** Archive sv 18 faite le 14/11 sur un autre appareil : une cible manuelle acceptée prévue pour le lundi 16/11. */
async function archiveSv18(): Promise<ExportData> {
  const x = await open(X, '2026-11-14T18:00:00.000Z');
  await x.data.transaction(async (r) => (await r.nutritionTargets()).record({ weekStart: '2026-11-16' as LocalDate, target: kcal(2350), source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false }));
  const { bytes } = await buildExportArchive(await (await x.data.repos.exportImport()).readExportData(), { date: '2026-11-14T18:05:00.000Z', sv: 18 });
  return (await parseExportArchive(bytes, { currentSv: 19, currentYear: 2026 })).data;
}

describe('AUDIT-USAGE a : cible importée après l’onboarding', () => {
  it('check-in accepté AVANT un import « Remplacer » : la cible importée est en vigueur le jeudi 19/11', async () => {
    const data = await archiveSv18();
    const a = await open(A, '2026-11-15T10:00:00.000Z');
    await a.data.transaction(async (r) => (await r.nutritionTargets()).record({ weekStart: '2026-11-09' as LocalDate, target: kcal(3050), source: 'auto', accepted: true, engineVersion: 1, lowFloorConfirmed: false }));
    a.clock.advance(60_000);
    await a.data.transaction(async (r) => {
      const repo = await r.exportImport();
      await repo.applyImport(planImport(await repo.readExportData(), data, 'replace'), 2026);
    });
    expect((await (await a.data.repos.nutritionTargets()).effective('2026-11-19' as LocalDate))?.target.kcal).toBe(2350);
  });
});

describe('AUDIT-USAGE b : cycle', () => {
  it('une durée choisie pendant le cycle est celle du cycle répété', () => {
    const spec = createMesocycleSpec({ routineId: u(1), startDate: '2026-11-16' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
    if (spec === null) throw new Error('spec');
    const changed = changeNextWeeks(spec, 4, DEFAULT_GENERATION_CONFIG);
    if (changed === null) throw new Error('changed');
    const repeated = nextMesocycleSpec(changed, 'repeat', '2026-12-14' as LocalDate, DEFAULT_GENERATION_CONFIG);
    expect(repeated?.weeks).toBe(4);
    expect(repeated?.routineId).toBe(u(1));
  });
});

describe('AUDIT-USAGE d : charge corrigée depuis le journal', () => {
  it('la séance close corrigée (charge d’un seul côté → charge totale) est l’historique que lit la progression suivante', async () => {
    const db = await open(A, '2026-11-16T17:00:00.000Z');
    const w = await db.data.repos.workouts();
    await w.start({ source: 'empty', id: u(100), name: 'Séance' });
    const ex = await w.addExercise(u(100), { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
    for (const s of ex.sets) await w.validateSet(s.id, { reps: 8, loadKg: 40 });
    db.clock.advance(60_000);
    await db.data.transaction(async (r) => (await r.workouts()).close(u(100)));
    db.clock.advance(3_600_000);
    for (const s of ex.sets) await db.data.transaction(async (r) => (await r.workouts()).correctSet(s.id, { loadKg: 100 }));
    const history = await (await db.data.repos.progression()).history('bench-press-barbell');
    expect(history[0]?.sets.map((s) => s.loadKg)).toEqual([100, 100]);
  });
});

describe('AUDIT-USAGE e : cible de repos puis check-in « garder la cible »', () => {
  it('« Garder » trace une proposition refusée : la cible de repos enregistrée le lundi reste en vigueur', async () => {
    const db = await open(A, '2026-11-16T08:00:00.000Z');
    const repo = await db.data.repos.nutritionTargets();
    const rest = { rest: { kcal: 2150, proteinG: 150, fatG: 70, carbG: 180 }, trainingDays: [1, 2, 4, 5, 6] as Weekday[] };
    await db.data.transaction(async (r) => (await r.nutritionTargets()).record({ weekStart: '2026-11-16' as LocalDate, target: kcal(2350), source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false, restPlan: rest }));
    db.clock.advance(60_000);
    await db.data.transaction(async (r) => (await r.nutritionTargets()).record({ weekStart: '2026-11-16' as LocalDate, target: kcal(2300), source: 'auto', accepted: false, engineVersion: 1, lowFloorConfirmed: false }));
    const now = await repo.effective('2026-11-16' as LocalDate);
    expect(now?.target.kcal).toBe(2350);
    expect(now?.restPlan?.rest.kcal).toBe(2150);
  });
});
