import { LEGACY_SYNC_CATALOGUE } from '../../fixtures/legacy-schema/catalogue';
import { trashCutoff } from '../../../src/domain/taskTrash';
import type { Task } from '../../../src/domain/model';
import type { TaskId } from '../../../src/domain/types';
import type { AppContainer } from '../../../src/features/app/container';
import { currentPurgeHorizon, defaultSyncLogger, purgeDeletedRows } from '../../../src/sync';

/**
 * Kit de test générique de la purge et de la restauration par le chemin réel des repositories et de `src/sync/purge` (SPA-001b-front) :
 * remplace les cas d'usage de la corbeille de tâches (supprimés avec la feature), sans logique de tâche. En 001b-sync, seule la table
 * cible changera (profile / body_weight avec la base neuve).
 */
type PurgeDeps = Pick<AppContainer, 'clock' | 'data'> & Partial<Pick<AppContainer, 'sync' | 'hlc'>>;

/** Purge physique des lignes supprimées depuis plus de 30 jours ; avec synchro, horizon de la synchro et règle des traces (Y-09). */
export async function purgeExpired(deps: PurgeDeps): Promise<number> {
  if (!deps.sync || !deps.hlc) return deps.data.transaction((repos) => repos.tasks.purgeDeletedBefore(trashCutoff(deps.clock.nowMs())));
  const now = deps.clock.nowMs();
  const horizon = await currentPurgeHorizon(deps.data.repos, deps.hlc.deviceId, now);
  return (await purgeDeletedRows({ catalogue: LEGACY_SYNC_CATALOGUE, data: deps.data, logger: defaultSyncLogger }, horizon, now)).count;
}

/** Restaure une ligne supprimée et ses rappels (écriture tamponnée, capture réelle). */
export async function restoreDeleted(deps: Pick<AppContainer, 'data'>, id: TaskId): Promise<Task | null> {
  return deps.data.transaction(async (repos) => {
    const current = await repos.tasks.getById(id, { includeDeleted: true });
    if (!current || current.deletedAt === null) return null;
    const [back] = await repos.tasks.restore([id]);
    await repos.reminders.restoreForTarget({ type: 'task', id }, { deletedAt: current.deletedAt, hlc: current.hlc });
    return back ?? null;
  });
}
