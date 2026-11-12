/**
 * Signal d'écriture locale publiable (0.1.3 k, SPA-008). Les dépôts de données le lèvent après une écriture que la synchro doit publier
 * (profil, pesée) ; la synchro (src/features/sync/startSync.ts) l'écoute pour lancer un cycle quelques secondes plus tard, au lieu
 * d'attendre l'échéance périodique. Aucun contenu ne transite : un simple « quelque chose a changé ». Les écritures de la synchro elle-même
 * (application de ce qui vient d'un autre appareil) ne passent jamais par ici : pas de boucle.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalWrite(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function notifyLocalWrite(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // Un écouteur défaillant ne doit jamais faire échouer l'écriture qui l'a levé.
    }
  }
}

/**
 * FIX-0173 : signal « un import Raccourcis vient d'être consigné » (état local `recovery_import_state`, jamais publié) : un écran qui affiche l'heure du
 * dernier import (ligne Apple Santé de Plus) se relit sans attendre d'être rouvert. Distinct du signal de synchro : il ne lance aucun cycle.
 */
const importListeners = new Set<Listener>();

export function onLocalImport(listener: Listener): () => void {
  importListeners.add(listener);
  return () => void importListeners.delete(listener);
}

export function notifyLocalImport(): void {
  for (const listener of [...importListeners]) {
    try {
      listener();
    } catch {
      // Même règle : un écouteur défaillant ne fait jamais échouer l'écriture.
    }
  }
}

/** Enveloppe des méthodes d'écriture d'un dépôt : le signal part après une écriture réussie, jamais après un échec. */
export function signalingWrites<T extends object, K extends keyof T>(repository: T, writes: readonly K[], notify: () => void = notifyLocalWrite): T {
  const wrapped: T = { ...repository };
  for (const name of writes) {
    const original = repository[name];
    if (typeof original !== 'function') continue;
    wrapped[name] = (async (...args: unknown[]) => {
      const result: unknown = await (original as (...a: unknown[]) => Promise<unknown>).apply(repository, args);
      notify();
      return result;
    }) as T[K];
  }
  return wrapped;
}
