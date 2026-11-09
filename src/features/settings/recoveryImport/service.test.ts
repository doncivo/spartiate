import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import type { RecoveryWorkout } from '../../../domain/recovery';
import { asEntityId, type DeviceId, type LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { RecoverySampleRepository } from '../../../db/repositories/recoverySampleRepository';
import type { ShortcutFileRead, ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { createShortcutImportService, IMPORT_LOG_EVENTS, type ImportLogEvent, type ShortcutImportDeps } from './service';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000011');
const NOW = '2026-11-08T10:00:00.000Z';
const TZ = 'Europe/Paris';
const fixture = (name: string): string => readFileSync(`tests/fixtures/recovery/${name}`, 'utf8');
const PAS = '2026-11-07T10:00:00+01:00;4000;pas\n2026-11-07T15:00:00+01:00;3000;pas\n';
const FC = '2026-11-08T07:00:00+01:00;55;bpm\n';

const ok = (name: ShortcutFileRead['name'], text: string): ShortcutFileRead => ({ name, state: 'ok', text });
const ALL_OK = (): ShortcutFileRead[] => [ok('hrv.csv', fixture('hrv.csv')), ok('fc-repos.csv', FC), ok('sommeil.csv', fixture('sommeil.csv')), ok('pas.csv', PAS)];
const ABSENT = (): ShortcutFileRead[] => (['hrv.csv', 'fc-repos.csv', 'sommeil.csv', 'pas.csv'] as const).map((name) => ({ name, state: 'absent' }) as ShortcutFileRead);

function reader(reads: () => Promise<readonly ShortcutFileRead[] | null>, options: { automatic?: boolean; kind?: ShortcutFilesReader['kind'] } = {}) {
  return { kind: options.kind ?? 'picker', automatic: options.automatic ?? true, read: vi.fn(reads) };
}

describe('service d’import des fichiers Raccourcis (I5-01 points 1.3, 1.6)', () => {
  let db: TestDb;
  let logs: { event: ImportLogEvent; counts: Record<string, number> }[];
  let workouts: RecoveryWorkout[];

  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
    logs = [];
    workouts = [];
  });
  afterEach(async () => {
    await db.close();
  });

  const build = (r: ShortcutFilesReader, overrides: Partial<ShortcutImportDeps> = {}) =>
    createShortcutImportService({
      reader: r,
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => workouts,
      clock: createManualClock(NOW),
      timeZone: TZ,
      log: (event, counts) => logs.push({ event, counts }),
      ...overrides,
    });

  it('lecteur non pris en charge (PC) : « unsupported », aucune lecture, aucun journal', async () => {
    const r = reader(async () => ALL_OK(), { kind: 'unsupported', automatic: false });
    const result = await build(r).run('manual');
    expect(result.status).toBe('unsupported');
    expect(r.read).not.toHaveBeenCalled();
    expect(logs).toEqual([]);
  });

  it('à l’ouverture, un lecteur non automatique ne lit rien (« needs-pick »)', async () => {
    const r = reader(async () => ALL_OK(), { automatic: false });
    const result = await build(r).run('open');
    expect(result.status).toBe('needs-pick');
    expect(r.read).not.toHaveBeenCalled();
  });

  it('au bouton, un lecteur non automatique lit ; annulation du sélecteur : « cancelled », rien d’écrit', async () => {
    const r = reader(async () => null, { automatic: false });
    const result = await build(r).run('manual');
    expect(result.status).toBe('cancelled');
    expect(r.read).toHaveBeenCalledTimes(1);
    expect(await (await db.data.repos.recoverySamples()).listImportStates()).toEqual([]);
  });

  it('dossier ou fichiers absents : état « absent » par fichier, jamais une erreur, rien d’enregistré', async () => {
    const result = await build(reader(async () => ABSENT())).run('open');
    expect(result.status).toBe('done');
    expect(result.files.map((f) => f.state)).toEqual(['absent', 'absent', 'absent', 'absent']);
    expect(result.recomputedDays).toBe(0);
    expect(await (await db.data.repos.recoverySamples()).listImportStates()).toEqual([]);
    expect(await (await db.data.repos.recovery()).getDay('2026-11-08' as LocalDate)).toBeNull();
  });

  it('importe les quatre fichiers : échantillons locaux, état par type avec comptes, rejets par raison', async () => {
    const result = await build(reader(async () => ALL_OK())).run('manual');
    expect(result.status).toBe('done');
    const hrv = result.files.find((f) => f.type === 'hrv');
    expect(hrv?.state).toBe('imported');
    expect(hrv?.rejected?.no_timezone).toBe(1);
    expect(hrv?.rejectedTotal).toBe(7);
    expect(hrv?.added).toBe(2);
    const samples = await db.data.repos.recoverySamples();
    const states = await samples.listImportStates();
    expect(states.map((s) => s.type)).toEqual(['fc-repos', 'hrv', 'pas', 'sommeil']);
    expect(states.find((s) => s.type === 'hrv')).toMatchObject({ importedAt: NOW, rejected: 7 });
    expect((await samples.listWindow('pas', '2026-11-01T00:00:00.000Z', NOW)).map((s) => s.value)).toEqual([7000]);
  });

  it('recalcule aujourd’hui et, parmi les jours récents qui ont des données et manquent, 30 jours au plus ; puis aujourd’hui et la veille', async () => {
    const nights = Array.from({ length: 40 }, (_, k) => {
      const day = new Date(Date.parse('2026-11-08T12:00:00Z') - k * 86_400_000).toISOString().slice(0, 10);
      const before = new Date(Date.parse(day + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
      return before + 'T23:00:00+01:00;' + day + 'T07:00:00+01:00;Endormi';
    }).join('\n');
    const reads = (): ShortcutFileRead[] => [ok('sommeil.csv', nights)];
    const service = build(reader(async () => reads()));
    const first = await service.run('manual');
    expect(first.recomputedDays).toBe(30);
    const recovery = await db.data.repos.recovery();
    expect((await recovery.listDays('2026-10-01' as LocalDate, '2026-11-08' as LocalDate)).length).toBe(30);
    expect(await recovery.getDay('2026-11-08' as LocalDate)).not.toBeNull();
    expect((await service.run('manual')).recomputedDays).toBe(2);
  });

  it('jours sans aucune donnée : seul aujourd’hui est écrit', async () => {
    const first = await build(reader(async () => [ok('pas.csv', PAS)])).run('manual');
    expect(first.recomputedDays).toBe(1);
  });

  it('muscles : une séance close récente alimente muscle_recovery', async () => {
    workouts = [
      {
        endedAt: '2026-11-08T08:00:00.000Z',
        sets: [{ kg: 80, reps: 8, difficulty: 'ok', isWarmup: false, completed: true, muscles: [{ id: 'chest', weight: 1 }] }],
      },
    ];
    await build(reader(async () => ALL_OK())).run('manual');
    const muscles = await (await db.data.repos.recovery()).listMuscles('2026-11-08' as LocalDate);
    expect(muscles.map((m) => m.muscleId)).toEqual(['chest']);
  });

  it('réimport du même fichier : idempotent (rien d’ajouté, mêmes échantillons)', async () => {
    const service = build(reader(async () => ALL_OK()));
    await service.run('manual');
    const second = await service.run('manual');
    expect(second.files.every((f) => f.state === 'imported' && f.added === 0)).toBe(true);
    expect(second.files.find((f) => f.type === 'hrv')?.duplicates).toBeGreaterThanOrEqual(2);
    const samples = await db.data.repos.recoverySamples();
    expect((await samples.listWindow('hrv', '2026-11-01T00:00:00.000Z', NOW)).length).toBe(2);
  });

  it('un fichier illisible n’empêche pas les autres', async () => {
    const reads = ALL_OK();
    reads[0] = { name: 'hrv.csv', state: 'unreadable' };
    const result = await build(reader(async () => reads)).run('manual');
    expect(result.files.find((f) => f.type === 'hrv')?.state).toBe('unreadable');
    expect(result.files.find((f) => f.type === 'sommeil')?.state).toBe('imported');
    expect(logs.some((l) => l.event === 'recovery-import-file-unreadable')).toBe(true);
  });

  it('une écriture qui échoue pour un fichier est isolée et journalisée par un nom fixe', async () => {
    const samples = await db.data.repos.recoverySamples();
    const failing: RecoverySampleRepository = {
      insertMany: (...args) => samples.insertMany(...args),
      upsertTotals: async () => {
        throw new Error('boom 4000');
      },
      listWindow: (...args) => samples.listWindow(...args),
      purgeOlderThan: (...args) => samples.purgeOlderThan(...args),
      recordImport: (...args) => samples.recordImport(...args),
      getImportState: (...args) => samples.getImportState(...args),
      listImportStates: () => samples.listImportStates(),
    };
    const result = await build(reader(async () => ALL_OK()), { samples: async () => failing }).run('manual');
    expect(result.files.find((f) => f.type === 'pas')?.state).toBe('failed');
    expect(result.files.find((f) => f.type === 'hrv')?.state).toBe('imported');
    expect(logs.some((l) => l.event === 'recovery-import-file-failed')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('boom');
  });

  it('un seul import à la fois : le second lancement simultané est « busy »', async () => {
    let release: (reads: readonly ShortcutFileRead[]) => void = () => undefined;
    const r = reader(() => new Promise((resolve) => (release = resolve)));
    const service = build(r);
    const first = service.run('manual');
    await Promise.resolve();
    const second = await service.run('manual');
    expect(second.status).toBe('busy');
    release(ALL_OK());
    expect((await first).status).toBe('done');
    expect(r.read).toHaveBeenCalledTimes(1);
    r.read.mockImplementation(async () => ALL_OK());
    expect((await service.run('manual')).status).toBe('done');
  });

  it('purge les échantillons de plus de 120 jours', async () => {
    const samples = await db.data.repos.recoverySamples();
    await samples.insertMany([{ type: 'hrv', startAt: '2026-06-01T03:00:00.000Z', endAt: '2026-06-01T03:00:00.000Z', value: 40, stage: null, source: 'hrv.csv' }], NOW);
    await build(reader(async () => ALL_OK())).run('manual');
    expect(await samples.listWindow('hrv', '2026-05-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')).toEqual([]);
  });

  it('un échec du recalcul est isolé : les échantillons restent importés', async () => {
    const recovery = await db.data.repos.recovery();
    const refusing = {
      ...recovery,
      saveDay: async (): Promise<never> => {
        throw new Error('refus');
      },
    };
    const result = await build(reader(async () => ALL_OK()), { recovery: async () => refusing }).run('manual');
    expect(result.status).toBe('done');
    expect(result.recomputeFailed).toBe(true);
    expect(result.files.find((f) => f.type === 'hrv')?.state).toBe('imported');
    expect(logs.some((l) => l.event === 'recovery-import-recompute-failed')).toBe(true);
  });

  it('journaux : noms fixes et comptes seulement, aucune valeur corporelle ni date de mesure', async () => {
    await build(reader(async () => ALL_OK())).run('manual');
    await build(reader(async () => ABSENT())).run('manual');
    expect(logs.length).toBeGreaterThan(0);
    for (const { event, counts } of logs) {
      expect(IMPORT_LOG_EVENTS).toContain(event);
      for (const [key, value] of Object.entries(counts)) {
        expect(key).toMatch(/^[a-z_]+$/);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
    const text = JSON.stringify(logs);
    for (const secret of ['48,5', '48.5', '4000', '7000', 'Profond', '2026-11', 'bpm', ';']) expect(text).not.toContain(secret);
  });

  it('correction de revue 1 : réimport du jour avec un total de pas plus grand : le total est remplacé, compté « mis à jour »', async () => {
    const service = build(reader(async () => [ok('pas.csv', PAS)]));
    await service.run('manual');
    const bigger = `${PAS}2026-11-07T21:00:00+01:00;2500;pas\n`;
    const second = await build(reader(async () => [ok('pas.csv', bigger)])).run('manual');
    const outcome = second.files.find((f) => f.type === 'pas');
    expect(outcome).toMatchObject({ state: 'imported', read: 1, added: 0, duplicates: 0, updated: 1 });
    const samples = await db.data.repos.recoverySamples();
    expect((await samples.listWindow('pas', '2026-11-01T00:00:00.000Z', NOW)).map((s) => s.value)).toEqual([9500]);
    const third = await build(reader(async () => [ok('pas.csv', bigger)])).run('manual');
    expect(third.files.find((f) => f.type === 'pas')).toMatchObject({ added: 0, duplicates: 1, updated: 0 });
  });

  it('correction de revue 1 : les autres types gardent « première valeur gagnante »', async () => {
    await build(reader(async () => [ok('fc-repos.csv', FC)])).run('manual');
    const other = await build(reader(async () => [ok('fc-repos.csv', '2026-11-08T07:00:00+01:00;70;bpm\n')])).run('manual');
    expect(other.files.find((f) => f.type === 'fc-repos')).toMatchObject({ added: 0, duplicates: 1, updated: 0 });
    const samples = await db.data.repos.recoverySamples();
    expect((await samples.listWindow('fc-repos', '2026-11-01T00:00:00.000Z', NOW)).map((s) => s.value)).toEqual([55]);
  });

  const CHEST_WORKOUT = (endedAt: string): RecoveryWorkout => ({
    endedAt,
    sets: Array.from({ length: 6 }, () => ({ kg: 100, reps: 10, difficulty: 'ok' as const, isWarmup: false, completed: true, muscles: [{ id: 'chest', weight: 1 }] })),
  });

  it('correction de revue 2 : import à 7 h, séance à 18 h, import le lendemain : Exertion et muscles du jour J corrigés', async () => {
    await build(reader(async () => ALL_OK()), { clock: createManualClock('2026-11-08T08:00:00.000Z') }).run('manual');
    const recovery = await db.data.repos.recovery();
    expect((await recovery.getDay('2026-11-08' as LocalDate))?.summary.exertion).toBe(0);
    workouts = [CHEST_WORKOUT('2026-11-08T17:00:00.000Z')];
    await build(reader(async () => ALL_OK()), { clock: createManualClock('2026-11-09T08:00:00.000Z') }).run('manual');
    expect((await recovery.getDay('2026-11-08' as LocalDate))?.summary.exertion).toBeGreaterThan(0);
    expect((await recovery.listMuscles('2026-11-08' as LocalDate)).map((m) => m.muscleId)).toEqual(['chest']);
  });

  it('correction de revue 2 : un jour passé plus ancien que la veille est recalculé si une séance est plus récente que son résumé', async () => {
    await build(reader(async () => ALL_OK()), { clock: createManualClock('2026-11-08T08:00:00.000Z') }).run('manual');
    workouts = [CHEST_WORKOUT('2026-11-08T17:00:00.000Z')];
    await build(reader(async () => ALL_OK()), { clock: createManualClock('2026-11-10T08:00:00.000Z') }).run('manual');
    const recovery = await db.data.repos.recovery();
    expect((await recovery.getDay('2026-11-08' as LocalDate))?.summary.exertion).toBeGreaterThan(0);
    const again = await build(reader(async () => ALL_OK()), { clock: createManualClock('2026-11-10T09:00:00.000Z') }).run('manual');
    expect(again.recomputedDays).toBe(2);
  });

  it('correction de revue 5 : le jour passé est calculé à la fin du jour LOCAL ; une séance finie à 0 h 30 (Paris) le lendemain n’entre pas dans ses muscles', async () => {
    workouts = [CHEST_WORKOUT('2026-11-08T23:30:00.000Z')];
    const sleepOnly = '2026-11-07T23:00:00+01:00;2026-11-08T07:00:00+01:00;Endormi\n';
    await build(reader(async () => [ok('sommeil.csv', sleepOnly)]), { clock: createManualClock('2026-11-10T10:00:00.000Z') }).run('manual');
    const recovery = await db.data.repos.recovery();
    expect(await recovery.getDay('2026-11-08' as LocalDate)).not.toBeNull();
    expect(await recovery.listMuscles('2026-11-08' as LocalDate)).toEqual([]);
    expect((await recovery.listMuscles('2026-11-09' as LocalDate)).map((m) => m.muscleId)).toEqual(['chest']);
    expect((await recovery.getDay('2026-11-08' as LocalDate))?.summary.computedAt).toBe('2026-11-08T22:59:59.999Z');
  });
});
