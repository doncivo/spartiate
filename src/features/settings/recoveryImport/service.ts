import type { Clock } from '../../../domain/clock';
import {
  buildSleepNights,
  parseShortcutHrv,
  parseShortcutRestingHr,
  parseShortcutSleep,
  parseShortcutSteps,
  shiftDay,
  sleepDebtDiagnostic,
  summarizeRecoveryDay,
  toNightRecords,
  type NightRecord,
  type RecoveryCardio,
  type RecoveryWorkout,
  type ShortcutParseReport,
  type ShortcutRejections,
  type SleepStage,
} from '../../../domain/recovery';
import { localToUtcMs, utcToLocal } from '../../../domain/timeZone';
import type { LocalDate } from '../../../domain/types';
import type { RecoveryRepository } from '../../../db/repositories/recoveryRepository';
import type { RecoverySampleInput, RecoverySampleRepository, RecoverySampleType } from '../../../db/repositories/recoverySampleRepository';
import { SHORTCUT_FILE_NAMES, ShortcutFolderError, type ShortcutFileName, type ShortcutFileRead, type ShortcutFilesReader, type ShortcutSanteListError } from '../../../platform/shortcutFiles';

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
  'recovery-import-folder-unavailable',
  'recovery-import-unsupported',
  'recovery-import-needs-pick',
  'recovery-import-busy',
  'recovery-import-throttled',
  'recovery-import-done',
  'recovery-import-run-failed',
  'recovery-import-diag-folder',
  'recovery-import-diag-entry',
  'recovery-import-rules-recompute',
  'recovery-import-diag-sleep',
  'recovery-import-diag-file',
  'recovery-import-file',
  'recovery-import-file-absent',
  'recovery-import-file-unreadable',
  'recovery-import-file-failed',
  'recovery-import-recompute',
  'recovery-import-recompute-failed',
  'recovery-import-purge',
  'recovery-import-purge-failed',
  'recovery-import-after-failed',
  'recovery-import-reread',
] as const;
export type ImportLogEvent = (typeof IMPORT_LOG_EVENTS)[number];
export type ImportLog = (event: ImportLogEvent, counts: Readonly<Record<string, number>>) => void;

/**
 * `open` : ouverture de l'app et retour au premier plan (dossier, au plus une fois par `AUTO_IMPORT_INTERVAL_MS`) ; `manual` : « Importer maintenant »
 * (dossier) ; `pick` : sélecteur de fichiers, en secours ; `reread` (FIX-0172, D-135) : relecture unique du dossier après une ouverture qui n'a rien
 * apporté, comme `open` (lecteur automatique seulement) mais sans la limite des 30 minutes.
 */
export type ImportTrigger = 'open' | 'manual' | 'pick' | 'reread';

/** FIX-0172 (D-135) : délai de la relecture après la lecture d'ouverture (le raccourci « Lorsque Spartiate est ouverte » réécrit les fichiers). */
export const REREAD_DELAY_MS = 45_000;

/**
 * Une relecture est-elle utile après cette lecture d'ouverture ? Oui si et seulement si elle n'a rien importé de nouveau (aucune ligne ajoutée ni
 * remplacée) et qu'une lecture du dossier est possible : lue sans rien de nouveau, limitée par les 30 minutes ou dossier injoignable. Jamais sur PC
 * (« unsupported »), sans lecteur automatique (« needs-pick ») ni pendant un autre import (« busy »).
 */
export function shouldReread(result: Pick<ImportRunResult, 'status' | 'files'>): boolean {
  if (result.status !== 'done' && result.status !== 'throttled' && result.status !== 'folder-unavailable') return false;
  return result.files.every((f) => f.added === 0 && f.updated === 0);
}

/** I5-03 (D-90) : lecture automatique au plus une fois toutes les 30 minutes (en mémoire pour la session, et d'après le dernier import gardé en base). */
export const AUTO_IMPORT_INTERVAL_MS = 30 * 60 * 1000;

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
  /** `throttled` : lecture automatique déjà faite il y a moins de 30 minutes ; `folder-unavailable` : dossier de synchro non lié ou injoignable (D-90). */
  readonly status: 'unsupported' | 'needs-pick' | 'busy' | 'throttled' | 'folder-unavailable' | 'cancelled' | 'done';
  readonly files: readonly FileOutcome[];
  readonly recomputedDays: number;
  readonly recomputeFailed: boolean;
  /** Instant de fin du lancement (ISO UTC), pour l'écran. */
  readonly at: string | null;
  /** I5-05 : ce qui a lancé la lecture (dossier ou sélecteur), pour dire d'où vient « absent » ; absent des résultats sans lecture. */
  readonly trigger?: ImportTrigger;
  /** I5-06 : raison de l'échec de liste du dossier sante (lecture automatique), pour la phrase « illisible ». */
  readonly folderIssue?: Exclude<ShortcutSanteListError, ''>;
}

export interface ShortcutImportDeps {
  /** Lecteur principal : le dossier sante sur iPhone (automatique), rien sur PC. */
  readonly reader: ShortcutFilesReader;
  /** Secours : le sélecteur de fichiers (`run('pick')`) ; absent : le lecteur principal. */
  readonly fallback?: ShortcutFilesReader;
  readonly samples: () => Promise<RecoverySampleRepository>;
  readonly recovery: () => Promise<RecoveryRepository>;
  /** Séances closes depuis cet instant (ISO UTC), dans la forme attendue par le moteur. */
  readonly workouts: (sinceIso: string) => Promise<readonly RecoveryWorkout[]>;
  /** I6-06 (D-220) : séances cardio saisies commencées depuis cet instant (absent : aucune). */
  readonly cardio?: (sinceIso: string) => Promise<readonly RecoveryCardio[]>;
  readonly clock: Clock;
  /** Fuseau IANA de l'appareil. */
  readonly timeZone: string;
  readonly log: ImportLog;
  /** I5-06 : version de la règle du sommeil des résumés déjà calculés (réglage local) ; absente : pas de recalcul forcé. */
  readonly rules?: { readonly get: () => Promise<number | null>; readonly set: (version: number) => Promise<void> };
  /** I5-02 (point 2.3) : appelé après un recalcul réussi (heure de coucher proposée, replanification des notifications) ; un échec est sans effet sur l'import. */
  readonly afterRecompute?: (info: { readonly today: string; readonly nights: readonly NightRecord[]; readonly exertionToday: number }) => Promise<unknown>;
}

export interface ShortcutImportService {
  run(trigger: ImportTrigger): Promise<ImportRunResult>;
  /** Résultat du dernier lancement de cette session (raisons de rejet par fichier), ou null. */
  lastRun(): ImportRunResult | null;
}

const TYPE_OF: Readonly<Record<ShortcutFileName, RecoverySampleType>> = { 'hrv.csv': 'hrv', 'fc-repos.csv': 'fc-repos', 'sommeil.csv': 'sommeil', 'pas.csv': 'pas' };
const MAX_DIAG_ENTRIES = 5;
const LIST_ERR_CODE: Readonly<Record<ShortcutSanteListError, number>> = { '': 0, 'not-found': 1, 'unsafe-name': 2, cloud: 3, io: 4 };

/**
 * Version de la règle du sommeil. 2 (I5-06) : nuit = plus long épisode, siestes et blocs « Au lit » ignorés. 3 (FIX-0172) : dette à compensation
 * partielle (D-130), épisodes et réveil par les seuls segments endormis (D-131), stades Apple Watch (D-132). Un changement recalcule une fois
 * les 30 derniers jours, même sans fichier importé (D-133).
 */
export const SLEEP_RULES_VERSION = 3;
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
  /** Dernière tentative de cette session (ms), lecture automatique ou non : une tentative sans fichier compte aussi. */
  let lastAttemptMs: number | null = null;

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

  /** `imported` : au moins un fichier importé par CE lancement ; sans import (recalcul de règle seul, D-133), rien n'est inventé sur une base vide. */
  async function recompute(samples: RecoverySampleRepository, today: string, now: string, force: boolean, imported = true): Promise<number> {
    const tz = deps.timeZone;
    const from = new Date(Date.parse(now) - SAMPLE_WINDOW_DAYS * DAY_MS).toISOString();
    const [sleep, hrv, rhr] = await Promise.all([samples.listWindow('sommeil', from, now), samples.listWindow('hrv', from, now), samples.listWindow('fc-repos', from, now)]);
    const segments = sleep.flatMap((s) => (s.stage === null ? [] : [{ start: s.startAt, end: s.endAt, stage: s.stage as SleepStage }]));
    const { nights, ignoredGroups } = buildSleepNights(segments, tz);
    const hrvSamples = hrv.flatMap((s) => (s.value === null ? [] : [{ measuredAt: s.startAt, day: utcToLocal(s.startAt, tz).date, value: s.value }]));
    const byDay = new Map<string, number>();
    for (const s of rhr) if (s.value !== null) byDay.set(utcToLocal(s.startAt, tz).date, s.value);
    const records = toNightRecords({ nights, hrv: hrvSamples, restingHrByDay: [...byDay].map(([day, value]) => ({ day, value })), timeZone: tz });

    // FIX-0115 : diagnostic sans valeur (compteurs seulement, § 22) des nuits retenues et écartées.
    const debt = sleepDebtDiagnostic(records, today);
    deps.log('recovery-import-diag-sleep', {
      nights_known: records.length,
      retained: debt.retained,
      excluded_no_asleep: debt.excludedNoAsleep,
      excluded_short: debt.excludedShort,
      nights_short: debt.short,
      nights_long: debt.long,
      ignored_episodes: ignoredGroups,
      rules_version: SLEEP_RULES_VERSION,
    });

    const since = new Date(Date.parse(now) - WORKOUT_WINDOW_DAYS * DAY_MS).toISOString();
    const workouts = await deps.workouts(since);
    const cardio = (await deps.cardio?.(since)) ?? [];
    // I6-06 : une séance cardio compte le jour local de sa fin, comme une séance de musculation.
    const ends = [...workouts.map((w) => Date.parse(w.endedAt)), ...cardio.map((c) => Date.parse(c.startedAt) + c.durationSec * 1000)].filter((ms) => Number.isFinite(ms));
    const dataDays = new Set<string>(records.map((n) => n.day));
    for (const ms of ends) dataDays.add(utcToLocal(new Date(ms).toISOString(), tz).date);

    const recovery = await deps.recovery();
    const oldest = shiftDay(today, -(RECOMPUTE_DAYS - 1));
    const computedAt = new Map((await recovery.listDays(oldest as LocalDate, today as LocalDate)).map((d) => [d.summary.day, d.summary.computedAt] as const));
    if (!imported && records.length === 0 && computedAt.size === 0) return 0;
    // Jours dont une mesure a été écrite par CET import (ajoutée ou remplacée) : sommeil = jour du réveil, hrv / fc-repos = jour de la mesure.
    const touched = new Set<string>();
    for (const [rows, useEnd] of [[sleep, true], [hrv, false], [rhr, false]] as const) {
      for (const r of rows) if (r.importedAt === now) touched.add(utcToLocal(useEnd ? r.endAt : r.startAt, tz).date);
    }
    const dayEndMs = (day: string): number => localToUtcMs(shiftDay(day, 1) as LocalDate, '00:00', tz) - 1;
    const stale = (day: string, at: string): boolean => {
      if (touched.has(day) && Date.parse(now) > Date.parse(at)) return true;
      const end = dayEndMs(day);
      return ends.some((ended) => ended > Date.parse(at) && ended <= end);
    };
    // Aujourd'hui et la veille : toujours. Un autre jour passé (29 au plus) : absent avec des données, ou périmé (séance close / mesure plus récente que son résumé).
    const days = [today, shiftDay(today, -1)];
    for (let k = 2; k < RECOMPUTE_DAYS; k += 1) {
      const day = shiftDay(today, -k);
      const at = computedAt.get(day);
      // `force` (règle du sommeil changée, I5-06) : tout jour déjà calculé ou ayant des données est recalculé.
      const wanted = force ? at !== undefined || dataDays.has(day) : at === undefined ? dataDays.has(day) : stale(day, at);
      if (wanted) days.push(day);
    }
    let exertionToday = 0;
    for (const day of days) {
      const output = summarizeRecoveryDay({ today: day, now: day === today ? now : new Date(dayEndMs(day)).toISOString(), timeZone: tz, nights: records, workouts, cardio });
      await recovery.saveDay(output);
      if (day === today) exertionToday = output.summary.exertion;
    }
    try {
      await deps.afterRecompute?.({ today, nights: records, exertionToday });
    } catch {
      deps.log('recovery-import-after-failed', {});
    }
    return days.length;
  }

  /** La règle du sommeil des résumés déjà calculés est-elle plus ancienne que la courante ? Une lecture en échec ne bloque jamais l'import. */
  async function rulesOutdated(): Promise<boolean> {
    if (deps.rules === undefined) return false;
    try {
      const stored = await deps.rules.get();
      return stored === null || stored < SLEEP_RULES_VERSION;
    } catch {
      return false;
    }
  }

  async function markRulesCurrent(): Promise<void> {
    try {
      await deps.rules?.set(SLEEP_RULES_VERSION);
      deps.log('recovery-import-rules-recompute', { version: SLEEP_RULES_VERSION });
    } catch {
      /* la version n'est pas notée : le recalcul sera refait à l'import suivant */
    }
  }

  /**
   * FIX-0172 (constat 2, D-133) : recalcul unique d'une nouvelle règle du sommeil depuis les échantillons LOCAUX, quand ce lancement n'a importé
   * aucun fichier (dossier inaccessible, fichiers absents ou illisibles, lecture limitée par les 30 minutes, sélecteur annulé). Le marqueur
   * n'est posé qu'après un recalcul complet ; un échec est journalisé et repris au lancement suivant. null : règle déjà à jour.
   */
  async function recomputeRulesOnly(): Promise<{ readonly recomputedDays: number; readonly recomputeFailed: boolean } | null> {
    if (!(await rulesOutdated())) return null;
    const at = nowIso();
    try {
      const recomputedDays = await recompute(await deps.samples(), utcToLocal(at, deps.timeZone).date, at, true, false);
      await markRulesCurrent();
      deps.log('recovery-import-recompute', { days: recomputedDays });
      return { recomputedDays, recomputeFailed: false };
    } catch {
      deps.log('recovery-import-recompute-failed', {});
      return { recomputedDays: 0, recomputeFailed: true };
    }
  }

  /** Une lecture automatique a-t-elle eu lieu il y a moins de 30 minutes (cette session, ou dernier import gardé en base) ? */
  async function attemptedRecently(): Promise<boolean> {
    const now = deps.clock.nowMs();
    if (lastAttemptMs !== null && now - lastAttemptMs < AUTO_IMPORT_INTERVAL_MS) return true;
    try {
      const states = await (await deps.samples()).listImportStates();
      return states.some((state) => now - Date.parse(state.importedAt) < AUTO_IMPORT_INTERVAL_MS);
    } catch {
      return false;
    }
  }

  /** Diagnostic (I5-04 point 2) : dossier atteint, sante présent, puis par fichier l'état (0 absent, 1 présent, 2 à télécharger, 3 illisible) et la taille en octets. Comptes seulement. */
  function diagnose(source: ShortcutFilesReader, reads: readonly ShortcutFileRead[]): void {
    const probe = source.probe?.() ?? null;
    if (probe !== null) {
      deps.log('recovery-import-diag-folder', {
        root_listed: probe.rootListed ? 1 : 0,
        sante_present: probe.santePresent ? 1 : 0,
        sante_listed: probe.santeListed ? 1 : 0,
        devices_present: probe.devicesPresent ? 1 : 0,
        root_entries: probe.rootEntries,
        sante_entries: probe.santeEntries,
        sante_hydrated: probe.santeHydrated ? 1 : 0,
        // 0 aucune, 1 absent, 2 nom refusé par la garde de chemin, 3 nuage, 4 autre.
        sante_list_err: LIST_ERR_CODE[probe.santeListError],
      });
      // Une entrée de la racine par événement, en codes (disponibilité : 0 locale, 1 nuage, 2 erreur) ; 5 au plus : deux appuis dans la même minute tiennent sous la limite de 10 par minute du journal.
      for (const [index, entry] of probe.rootProbe.slice(0, MAX_DIAG_ENTRIES).entries()) {
        deps.log('recovery-import-diag-entry', {
          index,
          is_dir: entry.isDir ? 1 : 0,
          avail: entry.availability === 'local' ? 0 : entry.availability === 'cloud' ? 1 : 2,
          eq_devices: entry.eqDevices ? 1 : 0,
          eq_sante_exact: entry.eqSanteExact ? 1 : 0,
          eq_sante_folded: entry.eqSanteFolded ? 1 : 0,
        });
      }
    }
    for (const [index, read] of reads.entries()) {
      const state = read.state === 'ok' ? 1 : read.state === 'absent' ? 0 : read.cloud === true ? 2 : 3;
      deps.log('recovery-import-diag-file', { type_index: index, state, size: read.state === 'absent' ? 0 : (read.size ?? 0) });
    }
  }

  async function execute(source: ShortcutFilesReader): Promise<ImportRunResult> {
    deps.log('recovery-import-start', {});
    let reads: Awaited<ReturnType<ShortcutFilesReader['read']>>;
    try {
      reads = await source.read(SHORTCUT_FILE_NAMES);
    } catch (error) {
      if (error instanceof ShortcutFolderError) {
        deps.log('recovery-import-folder-unavailable', {});
        return { status: 'folder-unavailable', files: [], recomputedDays: 0, recomputeFailed: false, at: null, ...(await recomputeRulesOnly()) };
      }
      reads = null;
    }
    if (reads === null) {
      deps.log('recovery-import-cancelled', {});
      return { status: 'cancelled', files: [], recomputedDays: 0, recomputeFailed: false, at: null, ...(await recomputeRulesOnly()) };
    }
    diagnose(source, reads);
    const at = nowIso();
    const today = utcToLocal(at, deps.timeZone).date;
    const samples = await deps.samples();
    const files: FileOutcome[] = [];
    for (const [index, read] of reads.entries()) {
      const type = TYPE_OF[read.name as ShortcutFileName];
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
        const force = await rulesOutdated();
        recomputedDays = await recompute(samples, today, at, force);
        if (force) await markRulesCurrent();
        deps.log('recovery-import-recompute', { days: recomputedDays });
      } catch {
        recomputeFailed = true;
        deps.log('recovery-import-recompute-failed', {});
      }
    } else {
      const rules = await recomputeRulesOnly();
      if (rules !== null) ({ recomputedDays, recomputeFailed } = rules);
    }
    const count = (state: FileOutcome['state']): number => files.filter((f) => f.state === state).length;
    deps.log('recovery-import-done', { files: files.length, imported: count('imported'), absent: count('absent'), unreadable: count('unreadable'), failed: count('failed') });
    const issue = source.probe?.()?.santeListError ?? '';
    return { status: 'done', files, recomputedDays, recomputeFailed, at, ...(issue === '' ? {} : { folderIssue: issue }) };
  }

  return {
    lastRun: () => last,
    async run(trigger) {
      const none: ImportRunResult = { status: 'unsupported', files: [], recomputedDays: 0, recomputeFailed: false, at: null };
      if (deps.reader.kind === 'unsupported') {
        // Journal seulement pour un geste de l'utilisateur : le PC lance « open » à chaque ouverture, sans rien à dire.
        if (trigger !== 'open') deps.log('recovery-import-unsupported', {});
        return none;
      }
      if ((trigger === 'open' || trigger === 'reread') && !deps.reader.automatic) {
        deps.log('recovery-import-needs-pick', {});
        if (running) return { ...none, status: 'needs-pick' };
        running = true;
        try {
          return { ...none, status: 'needs-pick', ...(await recomputeRulesOnly()) };
        } finally {
          running = false;
        }
      }
      if (running) {
        deps.log('recovery-import-busy', {});
        return { ...none, status: 'busy' };
      }
      running = true;
      try {
        if (trigger === 'open' && (await attemptedRecently())) {
          deps.log('recovery-import-throttled', {});
          return { ...none, status: 'throttled', ...(await recomputeRulesOnly()) };
        }
        lastAttemptMs = deps.clock.nowMs();
        const result: ImportRunResult = { ...(await execute(trigger === 'pick' ? (deps.fallback ?? deps.reader) : deps.reader)), trigger };
        if (result.status === 'done') last = result;
        return result;
      } finally {
        running = false;
      }
    },
  };
}
