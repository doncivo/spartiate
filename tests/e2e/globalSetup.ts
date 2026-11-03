import { startSyncFolderSim } from '../sim';
import { E2E_SYNC_SIM_PORT } from '../sim/ports';

/**
 * Lance le simulateur de dossier iCloud (Y-04, parcours à deux pages) sur un port fixe avant tous les tests et l'arrête à la fin :
 * le navigateur de développement l'atteint par `globalThis.__ctSyncSim` (tests/e2e/helpers/sync.ts). Aucun serveur ne reste lancé
 * après la suite : la fonction renvoyée le ferme. Les simulateurs d'agendas ont été retirés avec les calendriers (SPA-001b).
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const folder = await startSyncFolderSim(E2E_SYNC_SIM_PORT);
  return async () => {
    await folder.close();
  };
}
