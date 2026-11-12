import type { Clock } from '../../../domain/clock';
import { BODY_FILE_NAMES, BODY_METRIC_OF, parseBodyFile, type BodyFileName, type BodyMetric, type BodyParseResult } from '../../../domain/health/bodyShortcutFiles';
import type { HealthMetricKind } from '../../../domain/bodyProgress';
import { isRenphoDayEntry, planRenphoDay, renphoDayDraft } from '../../../domain/nutrition/renphoDay';
import type { ShortcutRejections } from '../../../domain/recovery/shortcutFiles';
import { addDays } from '../../../domain/localDate';
import { utcToLocal } from '../../../domain/timeZone';
import type { IsoDateTime, LocalDate } from '../../../domain/types';
import type { BodyWeightRepository } from '../../../db/repositories/bodyRepositories';
import type { MeasurementRepository } from '../../../db/repositories/bodyProgressRepository';
import type { MealEntryRecord, MealEntryRepository } from '../../../db/repositories/mealEntryRepository';
import { RepositoryError } from '../../../db/repositories/common';
import { ShortcutFolderError, type ShortcutFileRead, type ShortcutFilesReader } from '../../../platform/shortcutFiles';

/**
 * Import des fichiers Renpho / Apple Santé déposés par Raccourcis (I6-04, D-113). Sans E/S directe : lecteur, dépôts (une transaction), horloge, fuseau,
 * journal et état gardé sont injectés. Un seul import à la fois ; un fichier abîmé n'empêche pas les autres ; aucun appel réseau.
 *
 * - Poids : `saveHealth` (source Santé, une pesée par jour, la saisie manuelle n'est jamais remplacée, une pesée supprimée ne revient pas) ;
 * - masse grasse, masse maigre, tour de taille, taille : mesures `health_*` (clé stable date + genre + source) ;
 * - nutrition : règle « les deux selon les jours » (`planRenphoDay`) ; fibres : mesure `health_fiber_g` liée à l'entrée Renpho du jour.
 * Toute l'écriture est faite dans UNE transaction : un échec n'écrit rien.
 *
 * Journal : noms d'événements FIXES et comptes entiers seulement, jamais une valeur corporelle, une date de mesure ou un texte d'erreur (§ 22).
 */

export const BODY_IMPORT_LOG_EVENTS = [
  'body-import-start',
  'body-import-cancelled',
  'body-import-folder-unavailable',
  'body-import-unsupported',
  'body-import-needs-pick',
  'body-import-busy',
  'body-import-throttled',
  'body-import-file',
  'body-import-file-absent',
  'body-import-file-unreadable',
  'body-import-nutrition',
  'body-import-done',
  'body-import-failed',
] as const;
export type BodyImportLogEvent = (typeof BODY_IMPORT_LOG_EVENTS)[number];
export type BodyImportLog = (event: BodyImportLogEvent, counts: Readonly<Record<string, number>>) => void;

export type BodyImportTrigger = 'open' | 'manual' | 'pick';

/** Lecture automatique au plus une fois toutes les 30 minutes, comme l'import de la récupération (D-90). */
export const BODY_AUTO_IMPORT_INTERVAL_MS = 30 * 60 * 1000;
/** Fenêtre d'un fichier : 30 jours ; l'entrée Renpho d'un jour plus ancien que cette fenêtre élargie n'est plus rapprochée du journal. */
const RECONCILE_DAYS = 60;

export interface BodyFileOutcome {
  readonly name: BodyFileName;
  readonly metric: BodyMetric;
  readonly state: 'imported' | 'absent' | 'unreadable' | 'failed';
  /** Jours lus et acceptés. */
  readonly read: number;
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  /** Valeurs ignorées parce que la ligne avait été supprimée par Ali. */
  readonly skippedDeleted: number;
  readonly duplicates: number;
  readonly rejectedTotal: number;
  readonly rejected: ShortcutRejections | null;
  readonly truncated: boolean;
}

export interface NutritionOutcome {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  /** Entrées « Renpho — total du jour » supprimées parce que le journal a des repas ce jour-là. */
  readonly superseded: number;
  readonly skippedJournal: number;
  readonly skippedDeleted: number;
  readonly skippedNoEnergy: number;
}

export interface BodyImportResult {
  readonly status: 'unsupported' | 'needs-pick' | 'busy' | 'throttled' | 'folder-unavailable' | 'cancelled' | 'failed' | 'done';
  readonly files: readonly BodyFileOutcome[];
  readonly nutrition: NutritionOutcome;
  /** Instant de fin du lancement (ISO UTC). */
  readonly at: string | null;
  readonly trigger?: BodyImportTrigger;
}

/** Résumé gardé du dernier import (comptes seulement) pour l'écran, entre deux sessions. */
export interface BodyImportSummary {
  readonly at: string;
  readonly files: readonly { readonly name: BodyFileName; readonly state: BodyFileOutcome['state']; readonly read: number; readonly added: number; readonly updated: number; readonly rejected: number }[];
  readonly nutrition: NutritionOutcome;
}

export interface BodyImportRepos {
  readonly weights: BodyWeightRepository;
  readonly measurements: MeasurementRepository;
  readonly meals: MealEntryRepository;
}

export interface BodyImportDeps {
  readonly reader: ShortcutFilesReader;
  /** Secours : le sélecteur de fichiers (`run('pick')`) ; absent : le lecteur principal. */
  readonly fallback?: ShortcutFilesReader;
  /** Les dépôts d'une même transaction : tout ou rien. */
  readonly transaction: <T>(work: (repos: BodyImportRepos) => Promise<T>) => Promise<T>;
  readonly clock: Clock;
  readonly timeZone: string;
  readonly log: BodyImportLog;
  /** Dernier résumé gardé (réglage local) ; absent : pas de limite de 30 minutes entre sessions ni de résumé. */
  readonly state?: { readonly get: () => Promise<unknown>; readonly set: (summary: BodyImportSummary) => Promise<void> };
}

export interface HealthBodyImportService {
  run(trigger: BodyImportTrigger): Promise<BodyImportResult>;
  /** Résultat du dernier lancement de cette session, ou null. */
  lastRun(): BodyImportResult | null;
}

const EMPTY_NUTRITION: NutritionOutcome = { created: 0, updated: 0, unchanged: 0, superseded: 0, skippedJournal: 0, skippedDeleted: 0, skippedNoEnergy: 0 };
const MEASURE_KIND: Readonly<Partial<Record<BodyMetric, HealthMetricKind>>> = { body_fat: 'health_body_fat_pct', lean_mass: 'health_lean_mass_kg', waist: 'health_waist_cm', height: 'health_height_cm' };

const isBodyFileName = (name: string): name is BodyFileName => (BODY_FILE_NAMES as readonly string[]).includes(name);

const blank = (name: BodyFileName, state: BodyFileOutcome['state']): BodyFileOutcome => ({ name, metric: BODY_METRIC_OF[name], state, read: 0, added: 0, updated: 0, unchanged: 0, skippedDeleted: 0, duplicates: 0, rejectedTotal: 0, rejected: null, truncated: false });

interface Counts {
  added: number;
  updated: number;
  unchanged: number;
  skippedDeleted: number;
  refused: number;
}

export function createHealthBodyImportService(deps: BodyImportDeps): HealthBodyImportService {
  let running = false;
  let last: BodyImportResult | null = null;
  let lastAttemptMs: number | null = null;

  const nowIso = (): string => new Date(deps.clock.nowMs()).toISOString();
  const none: BodyImportResult = { status: 'unsupported', files: [], nutrition: EMPTY_NUTRITION, at: null };

  async function attemptedRecently(): Promise<boolean> {
    const now = deps.clock.nowMs();
    if (lastAttemptMs !== null && now - lastAttemptMs < BODY_AUTO_IMPORT_INTERVAL_MS) return true;
    try {
      const stored = await deps.state?.get();
      const at = typeof stored === 'object' && stored !== null ? (stored as { at?: unknown }).at : undefined;
      return typeof at === 'string' && now - Date.parse(at) < BODY_AUTO_IMPORT_INTERVAL_MS && now >= Date.parse(at);
    } catch {
      return false;
    }
  }

  async function applyWeights(repos: BodyImportRepos, parsed: BodyParseResult, today: LocalDate): Promise<Counts> {
    const counts: Counts = { added: 0, updated: 0, unchanged: 0, skippedDeleted: 0, refused: 0 };
    const before = new Map((await repos.weights.listRecent(5000)).filter((w) => w.source === 'health').map((w) => [w.date as string, w] as const));
    for (const d of parsed.days) {
      try {
        const after = await repos.weights.saveHealth({ kg: d.value, measuredAt: d.measuredAt as IsoDateTime, timezone: deps.timeZone, healthUuid: `raccourcis:${d.measuredAt}` }, today, { fromImport: true });
        const previous = before.get(after.date as string);
        if (after.deletedAt !== null) counts.skippedDeleted += 1;
        else if (previous === undefined) counts.added += 1;
        else if (previous.kg !== after.kg || previous.measuredAt !== after.measuredAt) counts.updated += 1;
        else counts.unchanged += 1;
      } catch (error) {
        if (!(error instanceof RepositoryError)) throw error;
        counts.refused += 1;
      }
    }
    return counts;
  }

  /** Une mesure importée : créée, mise à jour, inchangée, ou ignorée si Ali l'a supprimée (une suppression est respectée). */
  async function applyMeasure(measurements: MeasurementRepository, day: LocalDate, kind: HealthMetricKind, value: number, counts: Counts): Promise<void> {
    try {
      const existing = await measurements.find(day, kind);
      if (existing === null) {
        await measurements.save(day, kind, value);
        counts.added += 1;
      } else if (existing.deletedAt !== null) counts.skippedDeleted += 1;
      else if (existing.value === value) counts.unchanged += 1;
      else {
        await measurements.save(day, kind, value);
        counts.updated += 1;
      }
    } catch (error) {
      if (!(error instanceof RepositoryError)) throw error;
      counts.refused += 1;
    }
  }

  async function applyNutrition(repos: BodyImportRepos, parsedByMetric: ReadonlyMap<BodyMetric, BodyParseResult>, today: LocalDate): Promise<NutritionOutcome> {
    const value = (metric: BodyMetric): Map<string, number> => new Map((parsedByMetric.get(metric)?.days ?? []).map((d) => [d.day, d.value] as const));
    const energy = value('energy');
    const protein = value('protein');
    const carb = value('carb');
    const fat = value('fat');
    const fiber = value('fiber');
    const imported = new Set<string>([...energy.keys(), ...protein.keys(), ...carb.keys(), ...fat.keys(), ...fiber.keys()]);

    const from = addDays(today, -RECONCILE_DAYS);
    const entries = await repos.meals.listBetween(from, today, { includeDeleted: true });
    const byDay = new Map<string, { meals: boolean; live: MealEntryRecord | null; deleted: boolean }>();
    for (const entry of entries) {
      const slot = byDay.get(entry.date) ?? { meals: false, live: null, deleted: false };
      if (isRenphoDayEntry(entry)) {
        if (entry.deletedAt === null) slot.live = slot.live ?? entry;
        else slot.deleted = true;
      } else if (entry.deletedAt === null) slot.meals = true;
      byDay.set(entry.date, slot);
    }
    // Jours à traiter : ceux du fichier, et les jours dont l'entrée Renpho est encore vivante alors que le journal a des repas (rapprochement).
    const days = new Set<string>(imported);
    for (const [day, slot] of byDay) if (slot.live !== null && slot.meals) days.add(day);

    const out = { ...EMPTY_NUTRITION } as { -readonly [K in keyof NutritionOutcome]: NutritionOutcome[K] };
    for (const day of [...days].sort()) {
      const slot = byDay.get(day) ?? { meals: false, live: null, deleted: false };
      const totals = { kcal: energy.get(day) ?? null, proteinG: protein.get(day) ?? null, fatG: fat.get(day) ?? null, carbG: carb.get(day) ?? null, fiberG: fiber.get(day) ?? null };
      const plan = planRenphoDay({
        day: day as LocalDate,
        totals,
        journalHasMeals: slot.meals,
        renpho: { live: slot.live === null ? null : { id: slot.live.id, kcal: slot.live.kcal, proteinG: slot.live.proteinG, fatG: slot.live.fatG, carbG: slot.live.carbG }, deleted: slot.deleted },
      });
      switch (plan.action) {
        case 'create':
          await repos.meals.create(renphoDayDraft(day as LocalDate, totals));
          out.created += 1;
          break;
        case 'update':
          await repos.meals.update(plan.id, { kcal: totals.kcal, proteinG: totals.proteinG, fatG: totals.fatG, carbG: totals.carbG });
          out.updated += 1;
          break;
        case 'unchanged':
          out.unchanged += 1;
          break;
        case 'supersede':
          await repos.meals.softDelete(plan.id);
          out.superseded += 1;
          break;
        case 'skip':
          if (!imported.has(day)) break;
          if (plan.reason === 'journal') out.skippedJournal += 1;
          else if (plan.reason === 'deleted') out.skippedDeleted += 1;
          else out.skippedNoEnergy += 1;
          break;
      }
      // Fibres : liées à l'entrée du jour ; retirées dès que le journal a des repas (même si l'entrée Renpho a déjà été supprimée par la saisie).
      if (slot.meals) await repos.measurements.remove(day as LocalDate, 'health_fiber_g');
      else if (plan.fiber === 'save' && totals.fiberG !== null) await applyMeasure(repos.measurements, day as LocalDate, 'health_fiber_g', totals.fiberG, { added: 0, updated: 0, unchanged: 0, skippedDeleted: 0, refused: 0 });
    }
    return out;
  }

  async function execute(source: ShortcutFilesReader, trigger: BodyImportTrigger): Promise<BodyImportResult> {
    deps.log('body-import-start', {});
    let reads: readonly ShortcutFileRead[] | null;
    try {
      reads = await source.read(BODY_FILE_NAMES);
    } catch (error) {
      if (error instanceof ShortcutFolderError) {
        deps.log('body-import-folder-unavailable', {});
        return { ...none, status: 'folder-unavailable', trigger };
      }
      reads = null;
    }
    if (reads === null) {
      deps.log('body-import-cancelled', {});
      return { ...none, status: 'cancelled', trigger };
    }
    const at = nowIso();
    const today = utcToLocal(at, deps.timeZone).date as LocalDate;
    const outcomes = new Map<BodyFileName, BodyFileOutcome>();
    const parsedByMetric = new Map<BodyMetric, BodyParseResult>();
    for (const [index, read] of reads.entries()) {
      // Seuls les dix noms demandés sont pris en compte (le lecteur ne rend que la liste blanche).
      if (!isBodyFileName(read.name)) continue;
      const name = read.name;
      if (read.state !== 'ok') {
        deps.log(read.state === 'absent' ? 'body-import-file-absent' : 'body-import-file-unreadable', { type_index: index });
        outcomes.set(name, blank(name, read.state));
        continue;
      }
      const parsed = parseBodyFile(name, read.text, today, deps.timeZone);
      parsedByMetric.set(BODY_METRIC_OF[name], parsed);
      outcomes.set(name, { ...blank(name, 'imported'), read: parsed.days.length, duplicates: parsed.duplicates, rejectedTotal: parsed.rejectedTotal, rejected: parsed.rejected, truncated: parsed.truncated });
    }

    let nutrition: NutritionOutcome = EMPTY_NUTRITION;
    if (parsedByMetric.size > 0) {
      try {
        const written = await deps.transaction(async (repos) => {
          const counts = new Map<BodyFileName, Counts>();
          for (const [metric, parsed] of parsedByMetric) {
            const name = BODY_FILE_NAMES.find((n) => BODY_METRIC_OF[n] === metric);
            if (name === undefined) continue;
            if (metric === 'weight') counts.set(name, await applyWeights(repos, parsed, today));
            else {
              const kind = MEASURE_KIND[metric];
              if (kind === undefined) continue;
              const c: Counts = { added: 0, updated: 0, unchanged: 0, skippedDeleted: 0, refused: 0 };
              for (const d of parsed.days) await applyMeasure(repos.measurements, d.day as LocalDate, kind, d.value, c);
              counts.set(name, c);
            }
          }
          return { counts, nutrition: await applyNutrition(repos, parsedByMetric, today) };
        });
        nutrition = written.nutrition;
        for (const [name, c] of written.counts) {
          const base = outcomes.get(name);
          if (base !== undefined) outcomes.set(name, { ...base, added: c.added, updated: c.updated, unchanged: c.unchanged, skippedDeleted: c.skippedDeleted, rejectedTotal: base.rejectedTotal + c.refused });
        }
        deps.log('body-import-nutrition', { created: nutrition.created, updated: nutrition.updated, unchanged: nutrition.unchanged, superseded: nutrition.superseded, skipped_journal: nutrition.skippedJournal, skipped_deleted: nutrition.skippedDeleted, skipped_no_energy: nutrition.skippedNoEnergy });
      } catch {
        // Rien n'a été écrit (transaction annulée) : l'écran le dit, l'import suivant réessaie.
        deps.log('body-import-failed', {});
        return { ...none, status: 'failed', files: BODY_FILE_NAMES.map((n) => outcomes.get(n) ?? blank(n, 'absent')), trigger };
      }
    }
    const files = BODY_FILE_NAMES.map((n) => outcomes.get(n) ?? blank(n, 'absent'));
    for (const [index, f] of files.entries()) if (f.state === 'imported') deps.log('body-import-file', { type_index: index, read: f.read, added: f.added, updated: f.updated, unchanged: f.unchanged, duplicates: f.duplicates, rejected: f.rejectedTotal });
    const count = (state: BodyFileOutcome['state']): number => files.filter((f) => f.state === state).length;
    deps.log('body-import-done', { files: files.length, imported: count('imported'), absent: count('absent'), unreadable: count('unreadable') });
    try {
      await deps.state?.set({ at, files: files.map((f) => ({ name: f.name, state: f.state, read: f.read, added: f.added, updated: f.updated, rejected: f.rejectedTotal })), nutrition });
    } catch {
      /* le résumé n'est pas gardé : la limite de 30 minutes ne tient qu'en mémoire pour cette session */
    }
    return { status: 'done', files, nutrition, at, trigger };
  }

  return {
    lastRun: () => last,
    async run(trigger) {
      if (deps.reader.kind === 'unsupported') {
        if (trigger !== 'open') deps.log('body-import-unsupported', {});
        return none;
      }
      if (trigger === 'open' && !deps.reader.automatic) {
        deps.log('body-import-needs-pick', {});
        return { ...none, status: 'needs-pick' };
      }
      if (running) {
        deps.log('body-import-busy', {});
        return { ...none, status: 'busy' };
      }
      running = true;
      try {
        if (trigger === 'open' && (await attemptedRecently())) {
          deps.log('body-import-throttled', {});
          return { ...none, status: 'throttled' };
        }
        lastAttemptMs = deps.clock.nowMs();
        const result = await execute(trigger === 'pick' ? (deps.fallback ?? deps.reader) : deps.reader, trigger);
        if (result.status === 'done') last = result;
        return result;
      } finally {
        running = false;
      }
    },
  };
}
