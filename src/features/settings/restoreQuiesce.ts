import type { AppContainer } from '../app/container';
import { quietWorkSettled, setRestoreQuiet } from '../../platform/quiet';
import { pauseSigning, resumeSigning } from '../signing/signingRun';
import { pauseSyncForRestore, resumeSyncAfterRestore } from '../sync/syncRestoreControl';

/** Attente maximale d'un cycle de synchro ou d'un passage de l'avis de signature avant de refuser la restauration. */
export const QUIESCE_TIMEOUT_MS = 10_000;

export interface QuiesceHandle {
  /** Relance ce qui a été arrêté (restauration refusée AVANT la fermeture de la base). */
  release(): void;
}

/**
 * Mise au calme avant le remplacement de la base (P-04-iOS critère 6, ADR 0009 avenant lot F B4 ; PC compris, la feuille est partagée) :
 * synchro (planificateur suspendu, cycle en cours attendu 10 s au plus), avis de signature (passages suspendus, passage
 * en cours attendu). Le planificateur de sauvegardes ne lance rien pendant une restauration
 * (`backupStore`, `isRestoring`). `sync-busy` / `busy` : rien n'est modifié, tout est relâché, l'utilisateur peut réessayer.
 */
export async function quiesceForRestore(container: AppContainer, timeoutMs: number = QUIESCE_TIMEOUT_MS): Promise<QuiesceHandle | 'sync-busy' | 'busy'> {
  // Revue I3 : drapeau posé d'abord (synchro de toute origine, agendas, Rappels Apple refusés), puis attente de ce qui est parti.
  setRestoreQuiet(true);
  const release = (): void => {
    setRestoreQuiet(false);
    resumeSigning(container);
    resumeSyncAfterRestore(container);
  };
  if (!(await pauseSyncForRestore(container, timeoutMs))) {
    release();
    return 'sync-busy';
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const paused = await Promise.race([pauseSigning(container).then(() => true), new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), timeoutMs)))]);
  if (timer !== undefined) clearTimeout(timer);
  if (!paused || !(await quietWorkSettled(timeoutMs))) {
    release();
    return 'busy';
  }
  return { release };
}
