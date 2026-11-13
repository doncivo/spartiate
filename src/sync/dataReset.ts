import type { DataAccess, Repositories } from '../db/repositories';
import { DATA_RESET_TABLE, RESET_TABLES, laterHorizon, type DataResetCounts } from '../domain/dataReset';
import { isStrictHlc } from '../domain/sync/format';
import { hlcMs } from '../domain/sync/parse';
import type { SyncCatalogue } from '../domain/sync/syncTables';
import type { Hlc } from '../domain/types';
import { guarded } from './guarded';
import type { SyncLogger } from './log';
import { META } from './meta';

/**
 * RESET-01 (D-180 à D-186 ; ADR 0011, avenant 36) : « Repartir de zéro » et sa propagation.
 *
 * - `resetAllData` (appareil qui efface) : une transaction ; refus si une séance est en cours ; ligne `data_reset` posée HORS garde (capturée par la
 *   file d'envoi : c'est elle qui part vers les autres appareils), puis effacement SOUS garde (rien de l'effacement ne repart) et horizon mémorisé.
 * - `enforceDataReset` (chaque cycle, avant la publication) : un horizon plus récent que le dernier effacement fait ici (ligne reçue par un journal, un
 *   instantané ou une réintégration après mise à jour) déclenche le même effacement. Idempotent, rejouable après un arrêt.
 * - Filtre (`apply.ts`, `snapshot.ts`) : un champ antérieur à l'horizon n'est jamais appliqué (`isBeforeReset`).
 */

/** Horizon mémorisé (`sync_meta`) ; valeur absente ou illisible : null (illisible journalisé). */
async function readMetaHlc(repos: Repositories, key: string, logger: SyncLogger): Promise<Hlc | null> {
  const raw = await repos.sync.getMeta(key);
  if (raw === null) return null;
  if (isStrictHlc(raw)) return raw;
  logger.log('data-reset-meta-unreadable', { key });
  return null;
}

/** Plus grand horizon connu de cet appareil (mémorisé ou présent en table), pour les filtres d'application. */
export async function readResetHorizon(repos: Repositories, catalogue: SyncCatalogue, logger: SyncLogger): Promise<Hlc | null> {
  if (!catalogue.table(DATA_RESET_TABLE)) return null;
  const table = await (await repos.dataReset()).horizon();
  return laterHorizon(await readMetaHlc(repos, META.dataResetSeen, logger), table);
}

/**
 * Instant (ms) du dernier effacement fait ici (le plus tardif de l'horizon et de l'heure locale de l'effacement : un appareil qui apprend la remise
 * à zéro plus tard garde jusque-là des sauvegardes d'avant), ou null : sert à refuser la restauration d'une sauvegarde antérieure (D-185).
 */
export async function readResetAtMs(repos: Repositories): Promise<number | null> {
  const raw = await repos.sync.getMeta(META.dataResetApplied);
  if (raw === null || !isStrictHlc(raw)) return null;
  const wiped = Number(await repos.sync.getMeta(META.dataResetWipedAt));
  return Math.max(hlcMs(raw), Number.isFinite(wiped) ? wiped : 0);
}

/** Changements à émettre (`onRemoteChanges`) après un effacement : chaque table effacée, plus `data_reset` (rechargement complet de l'app). */
export function resetTouched(catalogue: SyncCatalogue): Map<string, Set<string>> {
  const touched = new Map<string, Set<string>>();
  for (const t of catalogue.tables) touched.set(t.name, new Set());
  touched.set(DATA_RESET_TABLE, new Set());
  return touched;
}

async function wipeTo(repos: Repositories, horizon: Hlc, nowMs: number): Promise<DataResetCounts> {
  const counts = await (await repos.dataReset()).wipe(horizon);
  await repos.sync.setMeta(META.dataResetSeen, horizon);
  await repos.sync.setMeta(META.dataResetApplied, horizon);
  await repos.sync.setMeta(META.dataResetWipedAt, String(Math.max(nowMs, hlcMs(horizon))));
  return counts;
}

const logCounts = (logger: SyncLogger, origin: 'local' | 'remote', counts: DataResetCounts): void =>
  logger.log('data-reset', { origin, rows: counts.rows, tables: counts.tables, settings: counts.settings, kept: Object.values(RESET_TABLES).filter((f) => f === 'kept').length });

export type ResetOutcome = { readonly kind: 'refused'; readonly reason: 'session-open' | 'unsupported' } | { readonly kind: 'done'; readonly horizon: Hlc; readonly counts: DataResetCounts };

/** Remise à zéro demandée sur cet appareil (Plus › Données › « Repartir de zéro »), après la confirmation « EFFACER ». */
export async function resetAllData(data: DataAccess, catalogue: SyncCatalogue, logger: SyncLogger): Promise<ResetOutcome> {
  if (!catalogue.table(DATA_RESET_TABLE)) return { kind: 'refused', reason: 'unsupported' };
  const outcome = await data.transaction(async (repos): Promise<ResetOutcome> => {
    const repo = await repos.dataReset();
    if (await repo.hasOpenWorkout()) return { kind: 'refused', reason: 'session-open' };
    const horizon = await repo.record();
    await repos.sync.setGuard();
    const counts = await wipeTo(repos, horizon, hlcMs(horizon));
    await repos.sync.clearGuard();
    return { kind: 'done', horizon, counts };
  });
  if (outcome.kind === 'done') logCounts(logger, 'local', outcome.counts);
  else logger.log('data-reset-refused', { reason: outcome.reason });
  return outcome;
}

/**
 * Effacement dû (horizon connu plus récent que le dernier effacement fait ici) : fait sous garde, en une transaction. Rend les tables touchées, ou
 * null s'il n'y avait rien à faire. Appelé par le cycle avant la publication : rien d'antérieur ne repart.
 */
export async function enforceDataReset(data: DataAccess, catalogue: SyncCatalogue, logger: SyncLogger, nowMs: number): Promise<Map<string, Set<string>> | null> {
  if (!catalogue.table(DATA_RESET_TABLE)) return null;
  const due = async (repos: Repositories): Promise<Hlc | null> => {
    const horizon = await readResetHorizon(repos, catalogue, logger);
    const applied = await readMetaHlc(repos, META.dataResetApplied, logger);
    return horizon !== null && (applied === null || horizon > applied) ? horizon : null;
  };
  // Lecture d'abord (trois requêtes courtes) : la transaction gardée n'est ouverte que si un effacement est dû, revérifié dedans.
  if ((await due(data.repos)) === null) return null;
  const counts = await guarded(data, async (repos) => {
    const horizon = await due(repos);
    return horizon === null ? null : wipeTo(repos, horizon, nowMs);
  });
  if (counts === null) return null;
  logCounts(logger, 'remote', counts);
  return resetTouched(catalogue);
}
