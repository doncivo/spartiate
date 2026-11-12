import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock, type ManualClock } from '../../../domain/clock';
import type { RecoveryWorkout } from '../../../domain/recovery';
import { asEntityId, type DeviceId, type LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { RecoverySampleRepository } from '../../../db/repositories/recoverySampleRepository';
import { ShortcutFolderError, type ShortcutFileRead, type ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { AUTO_IMPORT_INTERVAL_MS, createShortcutImportService, IMPORT_LOG_EVENTS, SLEEP_RULES_VERSION, type ImportLogEvent, type ShortcutImportDeps } from './service';

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

  it('lecteur non pris en charge (PC) : « unsupported », aucune lecture ; journal du seul geste manuel, pas de l’ouverture', async () => {
    const r = reader(async () => ALL_OK(), { kind: 'unsupported', automatic: false });
    const service = build(r);
    expect((await service.run('open')).status).toBe('unsupported');
    expect(logs).toEqual([]);
    const result = await service.run('manual');
    expect(result.status).toBe('unsupported');
    expect(r.read).not.toHaveBeenCalled();
    expect(logs.map((l) => l.event)).toEqual(['recovery-import-unsupported']);
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
    expect((await build(reader(async () => reads()), { clock: createManualClock('2026-11-08T11:00:00.000Z') }).run('manual')).recomputedDays).toBe(2);
  });

  it('I5-06 : après un changement de règle du sommeil, les 30 jours sont recalculés une fois, sans action d’Ali', async () => {
    const nights = Array.from({ length: 30 }, (_, k) => {
      const day = new Date(Date.parse('2026-11-08T12:00:00Z') - k * 86_400_000).toISOString().slice(0, 10);
      const before = new Date(Date.parse(day + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
      return before + 'T23:00:00+01:00;' + day + 'T07:00:00+01:00;Endormi';
    }).join('\n');
    const reads = (): ShortcutFileRead[] => [ok('sommeil.csv', nights)];
    // Les jours sont déjà calculés avec l'ancienne règle (version absente).
    await build(reader(async () => reads())).run('manual');
    let stored: number | null = null;
    const rules = { get: async () => stored, set: async (version: number) => void (stored = version) };
    const later = { clock: createManualClock('2026-11-08T11:00:00.000Z'), rules };
    const first = await build(reader(async () => reads()), later).run('manual');
    expect(first.recomputedDays).toBe(30);
    expect(stored).toBe(SLEEP_RULES_VERSION);
    expect(logs.some((l) => l.event === 'recovery-import-rules-recompute')).toBe(true);
    // Une seule fois : la version est à jour, retour aux deux jours.
    const second = await build(reader(async () => reads()), { clock: createManualClock('2026-11-08T11:30:00.000Z'), rules }).run('manual');
    expect(second.recomputedDays).toBe(2);
  });

  it('FIX-0115 : un import « 0 ajoutée » après une montée de version recalcule quand même, et le marqueur est posé', async () => {
    const nights = Array.from({ length: 10 }, (_, k) => {
      const day = new Date(Date.parse('2026-11-08T12:00:00Z') - k * 86_400_000).toISOString().slice(0, 10);
      const before = new Date(Date.parse(day + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
      return before + 'T23:00:00+01:00;' + day + 'T07:00:00+01:00;Endormi';
    }).join('\n');
    const reads = (): ShortcutFileRead[] => [ok('sommeil.csv', nights)];
    await build(reader(async () => reads())).run('manual');
    let stored: number | null = SLEEP_RULES_VERSION - 1;
    const rules = { get: async () => stored, set: async (version: number) => void (stored = version) };
    const again = await build(reader(async () => reads()), { clock: createManualClock('2026-11-08T11:00:00.000Z'), rules }).run('manual');
    expect(again.files.find((f) => f.type === 'sommeil')?.added).toBe(0);
    expect(again.recomputedDays).toBeGreaterThan(2);
    expect(stored).toBe(SLEEP_RULES_VERSION);
  });

  it('FIX-0115 : un événement de diagnostic du sommeil, des nombres seulement (nuits retenues, écartées par raison ; jamais de dette, § 22)', async () => {
    const nights = Array.from({ length: 10 }, (_, k) => {
      const day = new Date(Date.parse('2026-11-08T12:00:00Z') - k * 86_400_000).toISOString().slice(0, 10);
      const before = new Date(Date.parse(day + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
      return before + 'T23:00:00+01:00;' + day + 'T' + (k === 3 ? '01:30' : '07:00') + ':00+01:00;Endormi';
    }).join('\n');
    await build(reader(async () => [ok('sommeil.csv', nights)])).run('manual');
    const diag = logs.filter((l) => l.event === 'recovery-import-diag-sleep');
    expect(diag).toHaveLength(1);
    expect(Object.keys(diag[0]?.counts ?? {}).sort()).toEqual(['excluded_no_asleep', 'excluded_short', 'ignored_episodes', 'nights_known', 'retained', 'rules_version']);
    expect(diag[0]?.counts).toMatchObject({ excluded_short: 1, excluded_no_asleep: 0 });
    expect(Object.values(diag[0]?.counts ?? {}).every((v) => Number.isInteger(v))).toBe(true);
  });

  it('I5-06 : un échec de lecture de la version ne bloque pas l’import (recalcul habituel)', async () => {
    const rules = { get: async (): Promise<number | null> => Promise.reject(new Error('boom')), set: async () => undefined };
    const result = await build(reader(async () => [ok('pas.csv', PAS)]), { rules }).run('manual');
    expect(result.status).toBe('done');
    expect(result.recomputedDays).toBe(2);
  });

  it('jours sans aucune donnée : seuls aujourd’hui et la veille sont écrits', async () => {
    const first = await build(reader(async () => [ok('pas.csv', PAS)])).run('manual');
    expect(first.recomputedDays).toBe(2);
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

describe('lecture automatique du dossier sante (I5-03 point 1, D-90, H-26)', () => {
  let db: TestDb;
  let logs: { event: ImportLogEvent; counts: Record<string, number> }[];
  let clock: ManualClock;
  const folder = (reads: () => Promise<readonly ShortcutFileRead[] | null>) => reader(reads, { kind: 'folder', automatic: true });
  const picker = (reads: () => Promise<readonly ShortcutFileRead[] | null>) => reader(reads, { kind: 'picker', automatic: false });

  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
    logs = [];
    clock = createManualClock(NOW);
  });
  afterEach(async () => {
    await db.close();
  });

  const build = (r: ShortcutFilesReader, fallback?: ShortcutFilesReader) =>
    createShortcutImportService({
      reader: r,
      ...(fallback === undefined ? {} : { fallback }),
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock,
      timeZone: TZ,
      log: (event, counts) => logs.push({ event, counts }),
    });

  it('l’intervalle automatique est de 30 minutes', () => {
    expect(AUTO_IMPORT_INTERVAL_MS).toBe(30 * 60 * 1000);
  });

  it('à l’ouverture : lecture du dossier sans geste ; un second déclenchement dans les 30 minutes ne lit rien (« throttled »)', async () => {
    const r = folder(async () => ALL_OK());
    const service = build(r);
    expect((await service.run('open')).status).toBe('done');
    expect(r.read).toHaveBeenCalledTimes(1);
    clock.advance(AUTO_IMPORT_INTERVAL_MS - 1);
    expect((await service.run('open')).status).toBe('throttled');
    expect(r.read).toHaveBeenCalledTimes(1);
    clock.advance(1);
    expect((await service.run('open')).status).toBe('done');
    expect(r.read).toHaveBeenCalledTimes(2);
  });

  it('la limite vaut aussi après une réouverture de l’app : dernier import gardé en base, moins de 30 minutes', async () => {
    await build(folder(async () => ALL_OK())).run('open');
    clock.advance(10 * 60 * 1000);
    const again = folder(async () => ALL_OK());
    expect((await build(again).run('open')).status).toBe('throttled');
    expect(again.read).not.toHaveBeenCalled();
  });

  it('une tentative sans fichier (dossier vide) compte aussi pour la limite', async () => {
    const r = folder(async () => ABSENT());
    const service = build(r);
    expect((await service.run('open')).status).toBe('done');
    expect((await service.run('open')).status).toBe('throttled');
    expect(r.read).toHaveBeenCalledTimes(1);
  });

  it('« Importer maintenant » relit le dossier à tout moment, sans limite', async () => {
    const r = folder(async () => ALL_OK());
    const service = build(r);
    await service.run('open');
    expect((await service.run('manual')).status).toBe('done');
    expect((await service.run('manual')).status).toBe('done');
    expect(r.read).toHaveBeenCalledTimes(3);
  });

  it('le sélecteur reste en secours : « pick » lit le sélecteur, jamais le dossier ; annulation = « cancelled »', async () => {
    const f = folder(async () => ABSENT());
    const p = picker(async () => ALL_OK());
    const service = build(f, p);
    expect((await service.run('pick')).status).toBe('done');
    expect(p.read).toHaveBeenCalledTimes(1);
    expect(f.read).not.toHaveBeenCalled();
    const cancelled = picker(async () => null);
    expect((await build(f, cancelled).run('pick')).status).toBe('cancelled');
  });

  it('dossier de synchro non lié ou injoignable : « folder-unavailable », journal à nom fixe, rien d’écrit', async () => {
    const r = folder(async () => {
      throw new ShortcutFolderError('not-configured');
    });
    const result = await build(r).run('manual');
    expect(result.status).toBe('folder-unavailable');
    expect(logs.map((l) => l.event)).toContain('recovery-import-folder-unavailable');
    expect(IMPORT_LOG_EVENTS).toContain('recovery-import-folder-unavailable');
    expect(await (await db.data.repos.recoverySamples()).listImportStates()).toEqual([]);
  });

  it('un lecteur de sélecteur reste manuel : « open » ne lit rien (« needs-pick »)', async () => {
    const p = picker(async () => ALL_OK());
    expect((await build(p).run('open')).status).toBe('needs-pick');
    expect(p.read).not.toHaveBeenCalled();
  });
});

describe('statuts journalisés et diagnostic du dossier sante (I5-04 points 1 et 2)', () => {
  let db: TestDb;
  let logs: { event: ImportLogEvent; counts: Record<string, number> }[];
  let clock: ManualClock;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
    logs = [];
    clock = createManualClock(NOW);
  });
  afterEach(async () => {
    await db.close();
  });
  const build = (r: ShortcutFilesReader) =>
    createShortcutImportService({
      reader: r,
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock,
      timeZone: TZ,
      log: (event, counts) => logs.push({ event, counts }),
    });
  const events = (): ImportLogEvent[] => logs.map((l) => l.event);

  it('chaque statut hors « done » est journalisé sous un nom fixe de la liste', async () => {
    expect((await build(reader(async () => ALL_OK(), { kind: 'unsupported', automatic: false })).run('manual')).status).toBe('unsupported');
    expect(events()).toContain('recovery-import-unsupported');
    logs.length = 0;
    expect((await build(reader(async () => ALL_OK(), { kind: 'picker', automatic: false })).run('open')).status).toBe('needs-pick');
    expect(events()).toContain('recovery-import-needs-pick');
    logs.length = 0;
    const open = build(reader(async () => ABSENT(), { kind: 'folder', automatic: true }));
    await open.run('open');
    logs.length = 0;
    expect((await open.run('open')).status).toBe('throttled');
    expect(events()).toContain('recovery-import-throttled');
    logs.length = 0;
    let release: () => void = () => undefined;
    const slow = build(
      reader(
        () =>
          new Promise((resolve) => {
            release = () => resolve(ABSENT());
          }),
        { kind: 'folder', automatic: true },
      ),
    );
    const first = slow.run('manual');
    expect((await slow.run('manual')).status).toBe('busy');
    expect(events()).toContain('recovery-import-busy');
    release();
    await first;
    for (const name of ['recovery-import-unsupported', 'recovery-import-needs-pick', 'recovery-import-throttled', 'recovery-import-busy', 'recovery-import-done', 'recovery-import-diag-folder', 'recovery-import-diag-file']) {
      expect(IMPORT_LOG_EVENTS).toContain(name);
    }
  });

  it('une lecture manuelle qui finit est journalisée « done » avec ses comptes', async () => {
    await build(reader(async () => ABSENT(), { kind: 'folder', automatic: true })).run('manual');
    expect(logs.find((l) => l.event === 'recovery-import-done')?.counts).toEqual({ files: 4, imported: 0, absent: 4, unreadable: 0, failed: 0 });
  });

  it('le diagnostic du dossier est journalisé : dossier atteint, sante présent, un événement par fichier (état et taille), comptes seulement', async () => {
    const reads: ShortcutFileRead[] = [
      { name: 'hrv.csv', state: 'ok', text: fixture('hrv.csv'), size: 15360 },
      { name: 'fc-repos.csv', state: 'absent' },
      { name: 'sommeil.csv', state: 'unreadable', cloud: true, size: 2048 },
      { name: 'pas.csv', state: 'unreadable', size: 9 },
    ];
    const r = {
      ...reader(async () => reads, { kind: 'folder', automatic: true }),
      probe: () => ({ rootListed: true, santePresent: true, santeListed: true, devicesPresent: true, rootEntries: 3, santeEntries: 2, santeHydrated: false, santeListError: '' as const, rootProbe: [] }),
    };
    await build(r).run('manual');
    expect(logs.find((l) => l.event === 'recovery-import-diag-folder')?.counts).toEqual({ root_listed: 1, sante_present: 1, sante_listed: 1, devices_present: 1, root_entries: 3, sante_entries: 2, sante_hydrated: 0, sante_list_err: 0 });
    const files = logs.filter((l) => l.event === 'recovery-import-diag-file').map((l) => l.counts);
    // état : 0 absent, 1 présent, 2 à télécharger, 3 illisible
    expect(files).toEqual([
      { type_index: 0, state: 1, size: 15360 },
      { type_index: 1, state: 0, size: 0 },
      { type_index: 2, state: 2, size: 2048 },
      { type_index: 3, state: 3, size: 9 },
    ]);
    expect(JSON.stringify(logs)).not.toMatch(/48,5|hrv\.csv|2026-/);
  });

  it('I5-05 : la sonde journalise sante_hydrated et un événement par entrée de la racine, en codes fixes sans aucun nom', async () => {
    const r = {
      ...reader(async () => ABSENT(), { kind: 'folder', automatic: true }),
      probe: () => ({
        rootListed: true,
        santePresent: false,
        santeListed: false,
        devicesPresent: true,
        rootEntries: 3,
        santeEntries: 0,
        santeHydrated: true,
        santeListError: '' as const,
        rootProbe: [
          { isDir: true, availability: 'local' as const, eqDevices: true, eqSanteExact: false, eqSanteFolded: false },
          { isDir: false, availability: 'cloud' as const, eqDevices: false, eqSanteExact: true, eqSanteFolded: true },
          { isDir: false, availability: 'error' as const, eqDevices: false, eqSanteExact: false, eqSanteFolded: true },
        ],
      }),
    };
    await build(r).run('manual');
    expect(logs.find((l) => l.event === 'recovery-import-diag-folder')?.counts).toEqual({ root_listed: 1, sante_present: 0, sante_listed: 0, devices_present: 1, root_entries: 3, sante_entries: 0, sante_hydrated: 1, sante_list_err: 0 });
    // disponibilité : 0 locale, 1 nuage, 2 erreur
    expect(logs.filter((l) => l.event === 'recovery-import-diag-entry').map((l) => l.counts)).toEqual([
      { index: 0, is_dir: 1, avail: 0, eq_devices: 1, eq_sante_exact: 0, eq_sante_folded: 0 },
      { index: 1, is_dir: 0, avail: 1, eq_devices: 0, eq_sante_exact: 1, eq_sante_folded: 1 },
      { index: 2, is_dir: 0, avail: 2, eq_devices: 0, eq_sante_exact: 0, eq_sante_folded: 1 },
    ]);
    expect(IMPORT_LOG_EVENTS).toContain('recovery-import-diag-entry');
  });

  it('I5-05 : au plus 5 entrées de la racine journalisées (limite de débit du journal)', async () => {
    const entry = { isDir: true, availability: 'local' as const, eqDevices: false, eqSanteExact: false, eqSanteFolded: false };
    const r = {
      ...reader(async () => ABSENT(), { kind: 'folder', automatic: true }),
      probe: () => ({ rootListed: true, santePresent: false, santeListed: false, devicesPresent: false, rootEntries: 16, santeEntries: 0, santeHydrated: false, santeListError: '' as const, rootProbe: Array.from({ length: 16 }, () => entry) }),
    };
    await build(r).run('manual');
    expect(events().filter((e) => e === 'recovery-import-diag-entry')).toHaveLength(5);
  });

  it('I5-05 : un fichier lu par le sélecteur journalise sa vraie taille', async () => {
    const reads: ShortcutFileRead[] = [{ name: 'hrv.csv', state: 'ok', text: fixture('hrv.csv'), size: 15360 }, ...ABSENT().slice(1)];
    await build(reader(async () => reads, { kind: 'picker', automatic: false })).run('pick');
    expect(logs.filter((l) => l.event === 'recovery-import-diag-file')[0]?.counts).toEqual({ type_index: 0, state: 1, size: 15360 });
  });

  it('sans sonde : pas d’événement de dossier, les fichiers sont diagnostiqués quand même', async () => {
    await build(reader(async () => ABSENT(), { kind: 'folder', automatic: true })).run('manual');
    expect(events()).not.toContain('recovery-import-diag-folder');
    expect(events().filter((e) => e === 'recovery-import-diag-file')).toHaveLength(4);
  });
});

describe('I5-06 : raison de l’échec de lecture du dossier', () => {
  it('le journal porte sante_list_err en code (0 aucune, 1 absent, 2 nom refusé, 3 nuage, 4 autre) et le résultat porte la raison', async () => {
    const db = await openBaseDb(DEVICE);
    try {
      const logs: { event: ImportLogEvent; counts: Record<string, number> }[] = [];
      const unreadable: ShortcutFileRead[] = (['hrv.csv', 'fc-repos.csv', 'sommeil.csv', 'pas.csv'] as const).map((name) => ({ name, state: 'unreadable' }) as ShortcutFileRead);
      const r = {
        ...reader(async () => unreadable, { kind: 'folder', automatic: true }),
        probe: () => ({ rootListed: true, santePresent: true, santeListed: false, devicesPresent: true, rootEntries: 4, santeEntries: 0, santeHydrated: false, santeListError: 'unsafe-name' as const, rootProbe: [] }),
      };
      const service = createShortcutImportService({ reader: r, samples: () => db.data.repos.recoverySamples(), recovery: () => db.data.repos.recovery(), workouts: async () => [], clock: createManualClock(NOW), timeZone: TZ, log: (event, counts) => logs.push({ event, counts }) });
      const result = await service.run('manual');
      expect(logs.find((l) => l.event === 'recovery-import-diag-folder')?.counts).toMatchObject({ sante_list_err: 2 });
      expect(result.folderIssue).toBe('unsafe-name');
    } finally {
      await db.close();
    }
  });
});

/**
 * FIX-0172 (constat 2 de la relecture Codex du 12/11/2026, D-133) : le recalcul unique d'une nouvelle règle du sommeil part des échantillons
 * LOCAUX, même quand aucun fichier n'est importé (dossier inaccessible, fichiers absents, lecture limitée par les 30 minutes). Le marqueur
 * n'est posé qu'après un recalcul complet ; un recalcul interrompu est repris au lancement suivant ; un second passage n'écrit rien.
 */
describe('FIX-0172 : recalcul de règle indépendant de l’import', () => {
  let db: TestDb;
  let logs: { event: ImportLogEvent; counts: Record<string, number> }[];
  let stored: number | null;
  const rules = { get: async () => stored, set: async (version: number) => void (stored = version) };
  const LATER = '2026-11-08T11:00:00.000Z';
  const NIGHTS = Array.from({ length: 10 }, (_, k) => {
    const day = new Date(Date.parse('2026-11-08T12:00:00Z') - k * 86_400_000).toISOString().slice(0, 10);
    const before = new Date(Date.parse(day + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
    return before + 'T23:00:00+01:00;' + day + 'T07:00:00+01:00;Endormi';
  }).join('\n');
  const OLD_DAY = '2026-11-03';

  const service = (r: ShortcutFilesReader, overrides: Partial<ShortcutImportDeps> = {}) =>
    createShortcutImportService({
      reader: r,
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock: createManualClock(LATER),
      timeZone: TZ,
      log: (event, counts) => logs.push({ event, counts }),
      rules,
      ...overrides,
    });
  const needOf = async (day: string): Promise<number | undefined> => (await (await db.data.repos.recovery()).getDay(day as LocalDate))?.summary.sleepNeedMinutes;
  const hlcs = async (): Promise<string> => JSON.stringify(await db.driver.select('SELECT date, hlc FROM recovery_day ORDER BY date'));

  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
    logs = [];
    // Résumés calculés par une version précédente (marqueur ancien) ; l'un porte une valeur de l'ancienne règle.
    await createShortcutImportService({
      reader: reader(async () => [ok('sommeil.csv', NIGHTS)]),
      samples: () => db.data.repos.recoverySamples(),
      recovery: () => db.data.repos.recovery(),
      workouts: async () => [],
      clock: createManualClock(NOW),
      timeZone: TZ,
      log: () => undefined,
    }).run('manual');
    await db.driver.execute(`UPDATE recovery_day SET sleep_need_minutes = 630 WHERE date = '${OLD_DAY}'`);
    stored = SLEEP_RULES_VERSION - 1;
  });
  afterEach(async () => {
    await db.close();
  });

  it('dossier inaccessible : recalcul depuis les échantillons locaux, marqueur posé', async () => {
    const r = reader(async () => {
      throw new ShortcutFolderError('injoignable');
    });
    const result = await service(r).run('manual');
    expect(result.status).toBe('folder-unavailable');
    expect(result.recomputedDays).toBeGreaterThan(2);
    expect(await needOf(OLD_DAY)).toBe(450);
    expect(stored).toBe(SLEEP_RULES_VERSION);
  });

  it('fichiers absents : recalcul depuis les échantillons locaux, marqueur posé', async () => {
    const result = await service(reader(async () => ABSENT())).run('manual');
    expect(result.status).toBe('done');
    expect(result.files.every((f) => f.state === 'absent')).toBe(true);
    expect(await needOf(OLD_DAY)).toBe(450);
    expect(stored).toBe(SLEEP_RULES_VERSION);
  });

  it('lecture d’ouverture limitée par les 30 minutes : le recalcul de règle a lieu quand même, sans lire le dossier', async () => {
    const r = reader(async () => ABSENT(), { automatic: true });
    const result = await service(r, { clock: createManualClock('2026-11-08T10:10:00.000Z') }).run('open');
    expect(result.status).toBe('throttled');
    expect(r.read).not.toHaveBeenCalled();
    expect(await needOf(OLD_DAY)).toBe(450);
    expect(stored).toBe(SLEEP_RULES_VERSION);
  });

  it('recalcul interrompu : marqueur NON posé, puis repris au lancement suivant', async () => {
    const recovery = await db.data.repos.recovery();
    let calls = 0;
    const failing = {
      ...recovery,
      saveDay: async (output: Parameters<typeof recovery.saveDay>[0]) => {
        calls += 1;
        if (calls > 3) throw new Error('arrêt');
        return recovery.saveDay(output);
      },
    };
    const first = await service(reader(async () => ABSENT()), { recovery: async () => failing }).run('manual');
    expect(first.recomputeFailed).toBe(true);
    expect(stored).toBe(SLEEP_RULES_VERSION - 1);
    expect(logs.some((l) => l.event === 'recovery-import-rules-recompute')).toBe(false);
    await service(reader(async () => ABSENT())).run('manual');
    expect(await needOf(OLD_DAY)).toBe(450);
    expect(stored).toBe(SLEEP_RULES_VERSION);
  });

  it('idempotence : une fois le marqueur à jour, un second passage sans fichier n’écrit rien', async () => {
    await service(reader(async () => ABSENT())).run('manual');
    const before = await hlcs();
    const again = await service(reader(async () => ABSENT()), { clock: createManualClock('2026-11-08T11:30:00.000Z') }).run('manual');
    expect(again.recomputedDays).toBe(0);
    expect(await hlcs()).toBe(before);
  });

  it('installation neuve sans aucune donnée : aucun résumé inventé, marqueur posé', async () => {
    await db.close();
    db = await openBaseDb(DEVICE);
    stored = null;
    const result = await service(reader(async () => ABSENT())).run('manual');
    expect(result.recomputedDays).toBe(0);
    expect(await (await db.data.repos.recovery()).listDays('2026-10-01' as LocalDate, '2026-11-08' as LocalDate)).toEqual([]);
    expect(stored).toBe(SLEEP_RULES_VERSION);
  });
});
