import { afterEach, describe, expect, it } from 'vitest';
import { summarizeRecoveryDay, type RecoveryDayOutput } from '../../../domain/recovery';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I5-01 point 1.5 : `RecoveryRepository` (tables `recovery_day` et `muscle_recovery`, migration 0010, publiées). Écriture idempotente du résumé du
 * jour et des muscles, lecture par date et par plage, remplacement et suppression logique des lignes d'un jour. Fixtures synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fa' as DeviceId;
const D = (day: number): LocalDate => `2026-11-${String(day).padStart(2, '0')}` as LocalDate;
const NOW = '2026-11-09T07:00:00.000Z';
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.recovery();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name IN ('recovery_day', 'muscle_recovery') ORDER BY seq");
const clearOutbox = () => db.driver.execute('DELETE FROM sync_outbox');

const output = (day: LocalDate = D(9), over: Partial<RecoveryDayOutput['summary']> = {}): RecoveryDayOutput => ({
  summary: {
    day, level: 'C', recovery: 72, abstainReason: null, quality: 'good', exertion: 4.5, exertionPrevDay: 2, sleepMinutes: 450, sleepNeedMinutes: 480, sleepScore: 94,
    bedtimeSigmaMinutes: 22.5, targetZone: { from: 8, to: 12 }, hrvMs: 62.5, restingHr: 51, learningNights: 14,
    contributors: [{ key: 'hrv', value: 0.4, weight: 0.7 }, { key: 'sleep', value: 0.94, weight: null }], explanationKeys: ['exertion_cardio_not_counted'], computedAt: NOW, ...over,
  },
  muscles: [
    { day, muscleId: 'lats', group: 'Dos', percent: 30, hours: 72, lastWorkedAt: '2026-11-08T18:00:00.000Z', readyAt: '2026-11-11T18:00:00.000Z' },
    { day, muscleId: 'quads', group: 'Jambes', percent: 40, hours: 96, lastWorkedAt: '2026-11-08T18:00:00.000Z', readyAt: '2026-11-12T18:00:00.000Z' },
  ],
});
/** I5-01 : la base de test écrit (comme l’iPhone) ; `null` serait un appareil lecteur. */
const must = <T>(value: T | null): T => {
  if (value === null) throw new Error("écriture écartée (lecteur)");
  return value;
};
const at = <T>(items: readonly T[], i: number): T => {
  const item = items[i];
  if (item === undefined) throw new Error('fixture');
  return item;
};
const abstention = (day: LocalDate = D(10)): RecoveryDayOutput => ({
  summary: {
    ...output(day).summary, level: 'A', recovery: null, abstainReason: 'baseline_incomplete', quality: 'insufficient', sleepMinutes: null, sleepScore: null, bedtimeSigmaMinutes: null,
    targetZone: null, hrvMs: null, restingHr: null, contributors: [], explanationKeys: [],
  },
  muscles: [],
});

describe('RecoveryRepository', () => {
  it('saveDay : une ligne par jour et par muscle, relues telles quelles, mises en file en ligne entière', async () => {
    db = await openBaseDb(DEVICE);
    const saved = must(await (await repo()).saveDay(output()));
    expect(saved.day).toMatchObject({ id: 'recovery|2026-11-09', summary: output().summary, engineVersion: 1, deletedAt: null, deviceId: DEVICE });
    expect(saved.muscles.map((m) => [m.id, m.muscleId, m.percent])).toEqual([['muscle|2026-11-09|lats', 'lats', 30], ['muscle|2026-11-09|quads', 'quads', 40]]);
    expect(await (await repo()).getDay(D(9))).toEqual(saved.day);
    expect(await (await repo()).listMuscles(D(9))).toEqual(saved.muscles);
    expect(await outbox()).toEqual([
      { row_id: 'recovery|2026-11-09', field: '*' },
      { row_id: 'muscle|2026-11-09|lats', field: '*' },
      { row_id: 'muscle|2026-11-09|quads', field: '*' },
    ]);
  });

  it('saveDay accepte la sortie réelle du moteur (summarizeRecoveryDay), nuits inconnues comprises', async () => {
    db = await openBaseDb(DEVICE);
    const out = summarizeRecoveryDay({ today: '2026-11-09', now: NOW, timeZone: 'Europe/Paris', nights: [], workouts: [] });
    const saved = must(await (await repo()).saveDay(out));
    expect(saved.day.summary).toEqual(out.summary);
    expect(saved.day.summary.recovery).toBeNull();
    expect(saved.muscles).toEqual([]);
  });

  it('abstention : recovery NULL avec sa raison, mesures inconnues NULL (jamais 0)', async () => {
    db = await openBaseDb(DEVICE);
    const saved = must(await (await repo()).saveDay(abstention()));
    expect(saved.day.summary).toMatchObject({ recovery: null, abstainReason: 'baseline_incomplete', sleepMinutes: null, hrvMs: null, restingHr: null, targetZone: null });
    expect(await db.driver.select('SELECT recovery, hrv_ms, sleep_minutes, target_zone_from FROM recovery_day')).toEqual([{ recovery: null, hrv_ms: null, sleep_minutes: null, target_zone_from: null }]);
  });

  it('idempotent : rejouer le même résumé n’écrit rien (ni file, ni horloge), même si seul l’instant de calcul change', async () => {
    db = await openBaseDb(DEVICE);
    const first = await (await repo()).saveDay(output());
    await clearOutbox();
    db.clock.advance(60_000);
    const again = await (await repo()).saveDay(output(D(9), { computedAt: '2026-11-09T07:05:00.000Z' }));
    expect(again).toEqual(first);
    expect(await outbox()).toEqual([]);
  });

  it('changement : seuls les champs modifiés sont mis en file ; un muscle absent est supprimé logiquement, un revenu est restauré', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).saveDay(output());
    await clearOutbox();
    db.clock.advance(60_000);
    const changed = output(D(9), { recovery: 80 });
    await (await repo()).saveDay({ summary: changed.summary, muscles: [{ ...at(changed.muscles, 1), percent: 55 }] });
    expect(await outbox()).toEqual([
      { row_id: 'recovery|2026-11-09', field: 'recovery' },
      { row_id: 'muscle|2026-11-09|quads', field: 'percent' },
      { row_id: 'muscle|2026-11-09|lats', field: 'deleted_at' },
    ]);
    expect((await (await repo()).listMuscles(D(9))).map((m) => [m.muscleId, m.percent])).toEqual([['quads', 55]]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM muscle_recovery')).toEqual([{ n: 2 }]);
    await clearOutbox();
    db.clock.advance(60_000);
    await (await repo()).saveDay(changed);
    expect((await outbox()).filter((o) => o.row_id.endsWith('lats')).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    expect((await (await repo()).listMuscles(D(9))).map((m) => m.muscleId)).toEqual(['lats', 'quads']);
  });

  it('getDay et listDays : lecture par date et par plage, ordre chronologique, jours sans ligne absents', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.saveDay(output(D(11)));
    await r.saveDay(abstention(D(10)));
    await r.saveDay(output(D(3)));
    expect(await r.getDay(D(5))).toBeNull();
    expect((await r.listDays(D(4), D(30))).map((d) => d.summary.day)).toEqual([D(10), D(11)]);
    expect((await r.listDays(D(1), D(30))).map((d) => d.summary.day)).toEqual([D(3), D(10), D(11)]);
    expect(await r.listMuscles(D(10))).toEqual([]);
  });

  it('deleteDay : supprime logiquement le jour et ses muscles ; rejouer est sans effet ; saveDay rétablit le jour', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.saveDay(output());
    await r.deleteDay(D(9));
    expect(await r.getDay(D(9))).toBeNull();
    expect(await r.listMuscles(D(9))).toEqual([]);
    await clearOutbox();
    await r.deleteDay(D(9));
    await r.deleteDay(D(20));
    expect(await outbox()).toEqual([]);
    db.clock.advance(1_000);
    await r.saveDay(output());
    expect((await r.getDay(D(9)))?.summary.recovery).toBe(72);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_day')).toEqual([{ n: 1 }]);
  });

  it('entrée invalide : rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const bad: RecoveryDayOutput[] = [
      output(D(9), { recovery: null }), // sans raison
      output(D(9), { recovery: 101 }),
      output(D(9), { level: 'Z' as 'A' }),
      { ...output(), muscles: [at(output(D(10)).muscles, 0)] }, // muscle d'un autre jour
      { ...output(), muscles: [at(output().muscles, 0), at(output().muscles, 0)] }, // muscle répété
      { ...output(), muscles: [{ ...at(output().muscles, 0), percent: 40.5 }] },
      output(D(9), { day: '2026-13-01' as LocalDate }),
    ];
    for (const [i, b] of bad.entries()) await expect(r.saveDay(b), String(i)).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_day')).toEqual([{ n: 0 }]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM muscle_recovery')).toEqual([{ n: 0 }]);
  });

  it('un JSON illisible en base est refusé à la lecture (`invalid`), jamais deviné', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.saveDay(output());
    await db.driver.execute("UPDATE recovery_day SET contributors = '[{\"key\":\"autre\",\"value\":1,\"weight\":null}]' WHERE date = '2026-11-09'");
    await expect(r.getDay(D(9))).rejects.toMatchObject({ code: 'invalid' });
  });

  it('plan de requête : la lecture par plage passe par l’index de date', async () => {
    db = await openBaseDb(DEVICE);
    const plan = await db.driver.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM recovery_day WHERE date >= '2026-11-01' AND date <= '2026-11-30' AND deleted_at IS NULL ORDER BY date");
    expect(plan.map((p) => p.detail).join(' ')).toMatch(/USING (COVERING )?INDEX/);
  });

  it('correction de revue 4 : « measure_missing_sleep » s’écrit (sans migration, rangée sous « baseline_incomplete ») et le rejeu est idempotent', async () => {
    db = await openBaseDb(DEVICE);
    const sleepless = { ...abstention(D(11)), summary: { ...abstention(D(11)).summary, abstainReason: 'measure_missing_sleep' as const } };
    must(await (await repo()).saveDay(sleepless));
    expect((await (await repo()).getDay(D(11)))?.summary.abstainReason).toBe('baseline_incomplete');
    await clearOutbox();
    await (await repo()).saveDay(sleepless);
    expect(await outbox()).toEqual([]);
  });
});
