import { SYNC_CATALOGUE, type SyncCatalogue } from '../../domain/sync/syncTables';
import type { RepositoryFactory } from './dataAccess';
import { createSqlRepositoriesFor } from './sql';

/**
 * Stockage de l'app : le catalogue de synchro et les repositories qui y correspondent, dans un seul objet (relecture sync-icloud du lot B,
 * point a). Les fournir séparément ferait tourner le moteur sur un autre schéma que les repositories : `bootstrapApp` n'accepte donc
 * que cet objet. Production : `SYNC_STORAGE` (catalogue I0) ; le banc de test fournit le sien.
 */
export interface SyncStorage {
  readonly catalogue: SyncCatalogue;
  readonly repositories: RepositoryFactory;
}

export const createStorage = (catalogue: SyncCatalogue): SyncStorage => ({ catalogue, repositories: createSqlRepositoriesFor(catalogue) });

export const SYNC_STORAGE: SyncStorage = createStorage(SYNC_CATALOGUE);
