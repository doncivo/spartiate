import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalDataJson, canonicalHash, EXPORT_SV, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { RecoveryDayOutput } from '../../../domain/recovery';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I5-01 (D-57, § 16.4) : l'archive porte les RÉSUMÉS de récupération (`recovery_day`, `muscle_recovery`, schéma 10), jamais les échantillons
 * importés ni l'état d'import (ils se relisent depuis les fichiers Raccourcis). Une archive de schéma 9 s'importe sans rien supprimer de ces
 * tables, même en « remplacer » ; une archive de schéma 12 est refusée. Politique du PC (lecteur, l'iPhone seul écrit ces tables) : son
 * import n'écrit ni ne supprime jamais ces tables (elles lui reviennent de l'iPhone par la synchro), le plan le dit (`skippedReadOnly`).
 */

const IPHONE = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const OTHER = '60000000-0000-4000-8000-0000000000a2' as DeviceId;
const PC = '60000000-0000-4000-8000-0000000000b1' as DeviceId;
const DAY = '2026-11-09' as LocalDate;
const HRV = 61.37;

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const ignored: string[] = [];
const openWriter = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};
const openReader = async (device: DeviceId = PC): Promise<TestDb> => {
  ignored.length = 0;
  const db = await openBaseDb(device, undefined, { recoveryWriter: false, onIgnoredWrite: (event) => ignored.push(event) });
  opened.push(db);
  return db;
};
const output = (day: LocalDate = DAY, over: Partial<RecoveryDayOutput['summary']> = {}): RecoveryDayOutput => ({
  summary: {
    day, level: 'C', recovery: 72, abstainReason: null, quality: 'good', exertion: 4.5, exertionPrevDay: 2, sleepMinutes: 450, sleepNeedMinutes: 480, sleepScore: 94,
    bedtimeSigmaMinutes: 22.5, targetZone: { from: 6, to: 8 }, hrvMs: HRV, restingHr: 47.21, learningNights: 14,
    contributors: [{ key: 'hrv', value: 0.4, weight: 0.7 }], explanationKeys: ['exertion_cardio_not_counted'], computedAt: '2026-11-09T07:00:00.000Z', ...over,
  },
  muscles: [{ day, muscleId: 'quads', group: 'Jambes', percent: 40, hours: 96, lastWorkedAt: '2026-11-08T18:00:00.000Z', readyAt: '2026-11-12T18:00:00.000Z' }],
});
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
const seed = async (db: TestDb): Promise<void> => {
  await (await db.data.repos.recovery()).saveDay(output());
  await (await db.data.repos.recoverySamples()).insertMany(
    [{ type: 'hrv', startAt: '2026-11-09T02:12:00.000Z', endAt: '2026-11-09T02:12:00.000Z', value: 77.77, stage: null, source: 'hrv.csv' }],
    '2026-11-09T07:00:00.000Z',
  );
  await (await db.data.repos.recoverySamples()).recordImport({ type: 'hrv', importedAt: '2026-11-09T07:00:00.000Z', newestSampleAt: '2026-11-09T02:12:00.000Z', added: 1, duplicates: 0, rejected: 0 });
};
const parse = async (data: ExportData, sv: number) => {
  const archive = await buildExportArchive(data, { date: '2026-11-09T10:00:00.000Z', sv });
  return parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
};
const apply = async (db: TestDb, incoming: ExportData, mode: 'merge' | 'replace', sv: number) => {
  const parsed = await parse(incoming, sv);
  return db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    const plan = planImport(await repo.readExportData(), parsed.data, mode);
    await repo.applyImport(plan, 2026);
    return plan;
  });
};
const recoveryCount = async (db: TestDb): Promise<[number, number]> => [
  Number((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM recovery_day WHERE deleted_at IS NULL'))[0]?.n),
  Number((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM muscle_recovery WHERE deleted_at IS NULL'))[0]?.n),
];

describe('export / import des résumés de récupération (I5-01)', () => {
  it('deux tables exportées en dernier, schéma 10 ; échantillons et état d’import jamais exportés', () => {
    expect(TRAINING_EXPORT_TABLES.slice(-6, -3)).toEqual(['recovery_day', 'muscle_recovery', 'recovery_factor']);
    expect(TABLE_SINCE_SV.recovery_day).toBe(10);
    expect(TABLE_SINCE_SV.muscle_recovery).toBe(10);
    expect(EXPORT_SV).toBe(15); // FIX-0181 : schéma 15 (favoris publiés).
    for (const t of ['recovery_sample', 'recovery_import_state']) expect((TRAINING_EXPORT_TABLES as readonly string[]).includes(t), t).toBe(false);
  });

  it('aller-retour iPhone → iPhone : résumés identiques (hash canonique), publiés comme toute écriture ; aucun échantillon dans l’archive', async () => {
    const source = await openWriter(IPHONE);
    await seed(source);
    const data = await read(source);
    expect(data.training?.recovery_day?.map((r) => [r.id, r.values['recovery'], r.values['hrv_ms']])).toEqual([['recovery|2026-11-09', 72, HRV]]);
    expect(data.training?.muscle_recovery?.map((r) => [r.id, r.values['percent']])).toEqual([['muscle|2026-11-09|quads', 40]]);
    const json = canonicalDataJson(data);
    for (const absent of ['recovery_sample', 'recovery_import_state', '77.77', 'hrv.csv']) expect(json, absent).not.toContain(absent);
    const target = await openWriter(OTHER);
    await apply(target, data, 'merge', 11);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect((await (await target.data.repos.recovery()).getDay(DAY))?.summary).toEqual(output().summary);
    expect(await target.driver.select('SELECT 1 FROM recovery_sample')).toEqual([]);
    expect(await target.driver.select("SELECT table_name FROM sync_outbox WHERE field = '*' AND table_name IN ('recovery_day', 'muscle_recovery') GROUP BY table_name ORDER BY table_name")).toEqual([
      { table_name: 'muscle_recovery' },
      { table_name: 'recovery_day' },
    ]);
  });

  it('archive de schéma 9 (sans ces clés) en « remplacer » : aucun résumé local supprimé', async () => {
    const db = await openWriter(IPHONE);
    await seed(db);
    const plain = await read(await openWriter(OTHER));
    await apply(db, { ...plain, training: {} }, 'replace', 9);
    expect(await recoveryCount(db)).toEqual([1, 1]);
  });

  it('archive de schéma 10 sans résumé en « remplacer » sur l’iPhone : supprimés (l’absence est une donnée)', async () => {
    const db = await openWriter(IPHONE);
    await seed(db);
    const other = await openWriter(OTHER);
    await (await other.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await apply(db, await read(other), 'replace', 10);
    expect(await recoveryCount(db)).toEqual([0, 0]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_sample')).toEqual([{ n: 1 }]); // les échantillons ne sont pas des données d'archive
  });

  it('archive de schéma 16 : refusée (future-version)', async () => {
    const db = await openWriter(IPHONE);
    await expect(parse(await read(db), 16)).rejects.toMatchObject({ code: 'future-version' });
  });
});

describe('PC lecteur : l’import n’écrit ni ne supprime jamais les résumés de récupération', () => {
  it('la lecture locale du PC marque ces tables en lecture seule (hors de la forme canonique)', async () => {
    const pc = await openReader();
    const local = await read(pc);
    expect(local.readOnlyTables).toEqual(['recovery_day', 'muscle_recovery']);
    expect(canonicalDataJson(local)).not.toContain('readOnly');
  });

  it('« fusionner » une archive de l’iPhone sur le PC : résumés ignorés et comptés, le reste importé ; rien en file pour ces tables', async () => {
    const iphone = await openWriter(IPHONE);
    await seed(iphone);
    await (await iphone.data.repos.dayCompleteness()).declare(DAY, 'complete');
    const pc = await openReader();
    const plan = await apply(pc, await read(iphone), 'merge', 10);
    expect(plan.skippedReadOnly).toBe(2);
    expect(plan.ops.filter((o) => o.table === 'recovery_day' || o.table === 'muscle_recovery')).toEqual([]);
    expect(await recoveryCount(pc)).toEqual([0, 0]);
    expect((await (await pc.data.repos.dayCompleteness()).get(DAY))?.state).toBe('complete');
    expect(await pc.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('recovery_day', 'muscle_recovery')")).toEqual([]);
  });

  it('« remplacer » sur le PC par une archive de schéma 10 sans résumé : les résumés reçus de l’iPhone restent', async () => {
    const pc = await openReader();
    // résumé reçu de l'iPhone (écriture de la synchro, gardée : jamais par le dépôt du PC)
    await pc.driver.execute('INSERT INTO sync_guard (id) VALUES (1)');
    {
      await pc.driver.execute(
        `INSERT INTO recovery_day (id, date, level, recovery, abstain_reason, quality, exertion, exertion_prev_day, sleep_minutes, sleep_need_minutes, sleep_score, bedtime_sigma_minutes,
           target_zone_from, target_zone_to, hrv_ms, resting_hr, learning_nights, contributors, explanation_keys, computed_at, engine_version, created_at, updated_at, device_id, hlc)
         VALUES ('recovery|2026-11-09', '2026-11-09', 'B', NULL, 'baseline_incomplete', 'insufficient', 1, 0, 400, 450, NULL, NULL, NULL, NULL, NULL, NULL, 3, '[]', '[]',
           '2026-11-09T07:00:00.000Z', 1, '2026-11-09T07:00:00.000Z', '2026-11-09T07:00:00.000Z', ?, ?)`,
        [IPHONE, `${String(Date.UTC(2026, 10, 9)).padStart(15, '0')}-0000-${IPHONE}`],
      );
    }
    await pc.driver.execute('DELETE FROM sync_guard');
    const plan = await apply(pc, await read(await openWriter(OTHER)), 'replace', 10);
    expect(plan.ops.filter((o) => o.table === 'recovery_day')).toEqual([]);
    expect(await recoveryCount(pc)).toEqual([1, 0]);
  });

  it('plan construit sans la marque de lecture seule (appel direct) : le dépôt du PC écarte quand même ces lignes et le journalise, sans valeur', async () => {
    const iphone = await openWriter(IPHONE);
    await seed(iphone);
    await (await iphone.data.repos.dayCompleteness()).declare(DAY, 'complete');
    const parsed = await parse(await read(iphone), 10);
    const pc = await openReader();
    const { readOnlyTables: _marked, ...unmarked } = await read(pc);
    const plan = planImport(unmarked, parsed.data, 'merge');
    expect(plan.writes.training.some((w) => w.table === 'recovery_day')).toBe(true);
    await pc.data.transaction(async (repos) => (await repos.exportImport()).applyImport(plan, 2026));
    expect(await recoveryCount(pc)).toEqual([0, 0]);
    expect((await (await pc.data.repos.dayCompleteness()).get(DAY))?.state).toBe('complete');
    expect(ignored).toEqual(['recovery-write-ignored']);
    expect(JSON.stringify(ignored)).not.toContain(String(HRV));
  });
});

describe('bornes des résumés validées à la lecture de l’archive (invalid-data à l’aperçu, jamais un échec de CHECK)', () => {
  type Training = NonNullable<ExportData['training']>;
  const lines = async (mutate: (training: Training) => Training): Promise<unknown> => {
    const db = await openWriter(IPHONE);
    await seed(db);
    const data = await read(db);
    return parse({ ...data, training: mutate(data.training ?? {}) }, 10).catch((e: unknown) => e);
  };
  const withValues = (table: 'recovery_day' | 'muscle_recovery', over: Record<string, string | number | null>, id?: string) => (t: Training): Training => ({
    ...t,
    [table]: (t[table] ?? []).map((r) => ({ id: id ?? r.id, values: { ...r.values, ...over } })),
  });
  it.each([
    ['recovery_day', { recovery: 101 }],
    ['recovery_day', { recovery: -1 }],
    ['recovery_day', { abstain_reason: 'baseline_incomplete' }],
    ['recovery_day', { recovery: null }],
    ['recovery_day', { exertion: -0.5 }],
    ['recovery_day', { exertion_prev_day: 1001 }],
    ['recovery_day', { sleep_minutes: 1441 }],
    ['recovery_day', { sleep_need_minutes: 0 }],
    ['recovery_day', { sleep_score: 101 }],
    ['recovery_day', { bedtime_sigma_minutes: -1 }],
    ['recovery_day', { target_zone_from: 9 }],
    ['recovery_day', { target_zone_to: null }],
    ['recovery_day', { hrv_ms: 0 }],
    ['recovery_day', { resting_hr: 301 }],
    ['recovery_day', { learning_nights: 366 }],
    ['recovery_day', { contributors: '{}' }],
    ['recovery_day', { explanation_keys: '"x"' }],
    ['recovery_day', { engine_version: 0 }],
    ['muscle_recovery', { percent: 101 }],
    ['muscle_recovery', { hours: 0 }],
    ['muscle_recovery', { muscle_group: '' }],
  ] as const)('%s %j : refusée en invalid-data', async (table, over) => {
    expect(await lines(withValues(table, over))).toMatchObject({ code: 'invalid-data' });
  });
  it('identifiant qui ne correspond pas à la date ou au muscle : refusé', async () => {
    expect(await lines(withValues('recovery_day', {}, 'recovery|2026-11-10'))).toMatchObject({ code: 'invalid-data' });
    expect(await lines(withValues('muscle_recovery', {}, 'muscle|2026-11-09|lats'))).toMatchObject({ code: 'invalid-data' });
  });
  it('abstention bien formée et valeurs aux bornes : acceptées', async () => {
    const ok = await lines((t) =>
      withValues('recovery_day', { recovery: null, abstain_reason: 'zero_variance', hrv_ms: null, resting_hr: 300, sleep_minutes: 1440, target_zone_from: null, target_zone_to: null, learning_nights: 365 })(
        withValues('muscle_recovery', { percent: 100, hours: 1000 })(t),
      ),
    );
    expect(ok).not.toBeInstanceOf(Error);
    expect(ok).toHaveProperty('data');
  });
});
