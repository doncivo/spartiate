import type { RemoteChanges } from '../../platform/sync/types';
import { defaultSyncLogger, type SyncLogger } from '../../sync';
import type { AppContainer } from '../app/container';

/**
 * Après chaque lot appliqué par la synchro (ADR 0011 section 8 ; Y-02 critère 18) : les écrans qui affichent des lignes reçues rechargent
 * leur liste. SPA-001b : les anciens écrans (tâches, routines, événements, checklists, espaces) sont retirés ; en I0 aucun écran
 * n'affiche encore profil ou pesée. Le crochet reste, avec son contrat (une relecture en échec est journalisée par code et rendue dans
 * `failed`), pour que les écrans de I1 s'y branchent sans toucher au moteur de synchro.
 */
export function applyRemoteChanges(_container: AppContainer, _change: RemoteChanges, _logger: SyncLogger = defaultSyncLogger): Promise<{ readonly failed: readonly string[] }> {
  return Promise.resolve({ failed: [] });
}
