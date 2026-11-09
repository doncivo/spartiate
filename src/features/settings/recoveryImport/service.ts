import type { Clock } from '../../../domain/clock';
import {
  buildSleepNights,
  parseShortcutHrv,
  parseShortcutRestingHr,
  parseShortcutSleep,
  parseShortcutSteps,
  shiftDay,
  summarizeRecoveryDay,
  toNightRecords,
  type RecoveryWorkout,
  type ShortcutParseReport,
  type ShortcutRejections,
  type SleepStage,
} from '../../../domain/recovery';
import { localToUtcMs, utcToLocal } from '../../../domain/timeZone';
import type { LocalDate } from '../../../domain/types';
import type { RecoveryRepository } from '../../../db/repositories/recoveryRepository';
import type { RecoverySampleInput, RecoverySampleRepository, RecoverySampleType } from '../../../db/repositories/recoverySampleRepository';
import { SHORTCUT_FILE_NAMES, type ShortcutFileName, type ShortcutFilesReader } from '../../../platform/shortcutFiles';

/**
 * Import des fichiers Raccourcis et recalcul de la récupération (I5-01 points 1.3 et 1.6, D-69). Sans E/S directe : lecteur de fichiers, dépôts,
 * séances, horloge, fuseau et journal sont injectés. Un seul import à la fois ; une erreur d'un fichier n'empêche pas les autres ; aucun appel réseau.
 *
 * Journal : noms d'événements FIXES (`IMPORT_LOG_EVENTS`) et comptes entiers seulement, jamais une valeur corporelle, une date de mesure ou un texte
 * d'erreur (§ 22, données interdites).
 */

export const IMPORT_LOG_EVENTS = [
  'recovery-import-start',
  'recovery-import-cancelled',
  'recovery-import-file',
  'recovery-import-file-absent',
  'recovery-import-file-unreadable',
  'recovery-import-file-failed',
  'recovery-import-recompute',
  'recovery-import-recompute-failed',
  'recovery-import-purge',
  'recovery-import-purge-failed',
] as const;
export type ImportLogEvent = (typeof IMPORT_LOG_EVENTS)[number];
export type ImportLog = (event: ImportLogEvent, counts: Readonly<Record<string, number>>) => void;

export type ImportTrigger = 'open' | 'manual';

export interface FileOutcome {
  readonly type: RecoverySampleType;
  readonly state: 'imported' | 'absent' | 'unreadable' | 'failed';
  /** Lignes lues et acceptées (doublons d'export compris). */
  readonly read: number;
  readonly added: number;
  readonly duplicates: number;
  /** Totaux de pas dont la valeur a été remplacée (0 pour les autres types). */
  readonly updated: number;
  readonly rejectedTotal: number;
  /** Par raison ; null quand rien n'a été analysé. */
  readonly rejected: ShortcutRejections | null;
  readonly truncated: boolean;
}

export interface ImportRunResult {
  readonly status: 'unsupported' | 'needs-pick' | 'busy' | 'cancelled' | 'done';
  readonly files: readonly FileOutcome[];
  readonly recomputedDays: number;
  readonly recomputeFailed: boolean;
  /** Instant de fin du lancement (ISO UTC), pour l'écran. */
  readonly at: string | null;
}

export interface ShortcutImportDeps {
  readonly reader: ShortcutFilesReader;
  readonly samples: () => Promise<RecoverySampleRepository>;
  readonly recovery: () => Promise<RecoveryRepository>;
  /** Séances closes depuis cet instant (ISO UTC), dans la forme attendue par le moteur. */
  readonly workouts: (sinceIso: string) => Promise<readonly RecoveryWorkout[]>;
  readonly clock: Clock;
  /** Fuseau IANA de l'appareil. */
  readonly timeZone: string;
  readonly log: ImportLog;
}

export interface ShortcutImportService {
  run(trigger: ImportTrigger): Promise<ImportRunResult>;
  /** Résultat du dernier lancement de cette session (raisons de rejet par fichier), ou null. */
  lastRun(): ImportRunResult | null;
}

const TYPE_OF: Readonly<Record<ShortcutFileName, RecoverySampleType>> = { 'hrv.csv': 'hrv', 'fc-repos.csv': 'fc-repos', 'sommeil.csv': 'sommeil', 'pas.csv': 'pas' };
const RECOMPUTE_DAYS = 30;
const SAMPLE_WINDOW_DAYS = 60;
const WORKOUT_WINDOW_DAYS = 45;
const DAY_MS = 86_400_000;

interface Parsed {
  readonly report: ShortcutParseReport;
  readonly inputs: readonly RecoverySampleInput[];
}

function parseFile(type: RecoverySampleType, text: string, today: string, tz: string): Parsed {
  const source = `${type}.csv`;
  const point = (iso: string, value: number): RecoverySampleInput => ({ type, startAt: iso, endAt: iso, value, stage: null, source });
  if (type === 'hrv') {
    const r = parseShortcutHrv(text, today, tz);
    return { report: r, inputs: r.samples.map((s) => point(s.measuredAt, s.value)) };
  }
  if (type === 'fc-repos') {
    const r = parseShortcutRestingHr(text, today, tz);
    return { report: r, inputs: r.samples.map((s) => point(s.measuredAt, s.value)) };
  }
  if (type === 'pas') {
    // Un total par jour local, daté à midi UTC de ce jour (clé d'unicité du dépôt : un total plus récent remplace le précédent, `upsertTotals`).
    const r = parseShortcutSteps(text, today, tz);
    return { report: r, inputs: r.days.map((d) => point(`${d.day}T12:00:00.000Z`, d.steps)) };
  }
  const r = parseShortcutSleep(text, today, tz);
  return { report: r, inputs: r.segments.map((s) => ({ type, startAt: s.start, endAt: s.end, value: null, stage: s.stage, source })) };
}

export function createShortcutImportService(deps: ShortcutImportDeps): ShortcutImportService {
  let running = false;
  let last: ImportRunResult | null = null;

  const nowIso = (): string => new Date(deps.clock.nowMs()).toISOString();

  async function importFile(samples: RecoverySampleRepository, type: RecoverySampleType, text: string, today: string, at: string, index: number): Promise<FileOutcome> {
    try {
      const { report, inputs } = parseFile(type, text, today, deps.timeZone);
      const inserted = type === 'pas' ? await samples.upsertTotals(inputs, at) : { ...(await samples.insertMany(inputs, at)), updated: 0 };
      const duplicates = inserted.duplicates + report.duplicates;
      const newest = inputs.reduce<string | null>((max, s) => (max === null || s.endAt > max ? s.endAt : max), null);
      await samples.recordImport({ type, importedAt: at, newestSampleAt: newest, added: inserted.added + inserted.updated, duplicates, rejected: report.rejectedTotal });
      const outcome: FileOutcome = {
        type,
        state: 'imported',
        read: inputs.length + report.duplicates,
        added: inserted.added,
        duplicates,
        updated: inserted.updated,
        rejectedTotal: report.rejectedTotal,
        rejected: report.rejected,
        truncated: report.truncated,
      };
      deps.log('recovery-import-file', { type_index: index, read: outcome.read, added: outcome.added, duplicates, rejected: outcome.rejectedTotal });
      return outcome;
    } catch {
      deps.log('recovery-import-file-failed', { type_index: index });
      return { type, state: 'failed', read: 0, added: 0, duplicates: 0, updated: 0, rejectedTotal: 0, rejected: null, truncated: false };
    }
  }

  async function recompute(samples: RecoverySampleRepository, today: string, now: string): Promise<number> {
    const tz = deps.timeZone;
    const from = new Date(Date.parse(now) - SAMPLE_WINDOW_DAYS * DAY_MS).toISOString();
    const [sleep, hrv, rhr] = await Promise.all([samples.listWindow('sommeil', from, now), samples.listWindow('hrv', from, now), samples.listWindow('fc-repos', from, now)]);
    const segments = sleep.flatMap((s) => (s.stage === null ? [] : [{ start: s.startAt, end: s.endAt, stage: s.stage as SleepStage }]));
    const { nights } = buildSleepNights(segments, tz);
    const hrvSamples = hrv.flatMap((s) => (s.value === null ? [] : [{ measuredAt: s.startAt, day: utcToLocal(s.startAt, tz).date, value: s.value }]));
    const byDay = new Map<string, number>();
    for (const s of rhr) if (s.value !== null) byDay.set(utcToLocal(s.startAt, tz).date, s.value);
    const records = toNightRecords({ nights, hrv: hrvSamples, restingHrByDay: [...byDay].map(([day, value]) => ({ day, value })), timeZone: tz });

    const workouts = await deps.workouts(new Date(Date.parse(now) - WORKOUT_WINDOW_DAYS * DAY_MS).toISOString());
    const dataDays = new Set<string>(records.map((n) => n.day));
    for (const w of workouts) dataDays.add(utcToLocal(new Date(Date.parse(w.endedAt)).toISOString(), tz).date);

    const recovery = await deps.recovery();
    const oldest = shiftDay(today, -(RECOMPUTE_DAYS - 1));
    const computedAt = new Map((await recovery.listDays(oldest as LocalDate, today as LocalDate)).map((d) => [d.summary.day, d.summary.computedAt] as const));
    // Jours dont une mesure a été écrite par CET import (ajoutée ou remplacée) : sommeil = jour du réveil, hrv / fc-repos = jour de la mesure.
    const touched = new Set<string>();
    for (const [rows, useEnd] of [[sleep, true], [hrv, false], [rhr, false]] as const) {
      for (const r of rows) if (r.importedAt === now) touched.add(utcToLocal(useEnd ? r.endAt : r.startAt, tz).date);
    }
    const dayEndMs = (day: string): number => localToUtcMs(shiftDay(day, 1) as LocalDate, '00:00', tz) - 1;
    const stale = (day: string, at: string): boolean => {
      if (touched.has(day) && Date.parse(now) > Date.parse(at)) return true;
      const end = dayEndMs(day);
      return workouts.some((w) => {
        const ended = Date.parse(w.endedAt);
        return ended > Date.parse(at) && ended <= end;
      });
    };
    // Aujourd'hui et la veille : toujours. Un autre jour passé (29 au plus) : absent avec des données, ou périmé (séance close / mesure plus récente que son résumé).
    const days = [today, shiftDay(today, -1)];
    for (let k = 2; k < RECOMPUTE_DAYS; k += 1) {
      const day = shiftDay(today, -k);
      const at = computedAt.get(day);
      const wanted = at === undefined ? dataDays.has(day) : stale(day, at);
      if (wanted) days.push(day);
    }
    for (const day of days) {
      const output = summarizeRecoveryDay({ today: day, now: day === today ? now : new Date(dayEndMs(day)).toISOString(), timeZone: tz, nights: records, workouts });
      await recovery.saveDay(output);
    }
    return days.length;
  }

  async function execute(): Promise<ImportRunResult> {
    deps.log('recovery-import-start', {});
    let reads: Awaited<ReturnType<ShortcutFilesReader['read']>>;
    try {
      reads = await deps.reader.read(SHORTCUT_FILE_NAMES);
    } catch {
      reads = null;
    }
    if (reads === null) {
      deps.log('recovery-import-cancelled', {});
      return { status: 'cancelled', files: [], recomputedDays: 0, recomputeFailed: false, at: null };
    }
    const at = nowIso();
    const today = utcToLocal(at, deps.timeZone).date;
    const samples = await deps.samples();
    const files: FileOutcome[] = [];
    for (const [index, read] of reads.entries()) {
      const type = TYPE_OF[read.name];
      if (read.state === 'ok') {
        files.push(await importFile(samples, type, read.text, today, at, index));
        continue;
      }
      deps.log(read.state === 'absent' ? 'recovery-import-file-absent' : 'recovery-import-file-unreadable', { type_index: index });
      files.push({ type, state: read.state, read: 0, added: 0, duplicates: 0, updated: 0, rejectedTotal: 0, rejected: null, truncated: false });
    }
    let recomputedDays = 0;
    let recomputeFailed = false;
    if (files.some((f) => f.state === 'imported')) {
      try {
        const purged = await samples.purgeOlderThan(at);
        deps.log('recovery-import-purge', { purged });
      } catch {
        deps.log('recovery-import-purge-failed', {});
      }
      try {
        recomputedDays = await recompute(samples, today, at);
        deps.log('recovery-import-recompute', { days: recomputedDays });
      } catch {
        recomputeFailed = true;
        deps.log('recovery-import-recompute-failed', {});
      }
    }
    return { status: 'done', files, recomputedDays, recomputeFailed, at };
  }

  return {
    lastRun: () => last,
    async run(trigger) {
      const none: ImportRunResult = { status: 'unsupported', files: [], recomputedDays: 0, recomputeFailed: false, at: null };
      if (deps.reader.kind === 'unsupported') return none;
      if (trigger === 'open' && !deps.reader.automatic) return { ...none, status: 'needs-pick' };
      if (running) return { ...none, status: 'busy' };
      running = true;
      try {
        const result = await execute();
        if (result.status === 'done') last = result;
        return result;
      } finally {
        running = false;
      }
    },
  };
}
