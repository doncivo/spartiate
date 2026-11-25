/**
 * Signal « repos changé » (SHELL-0294b, § 13.3 b) : une action de la notification de fin de repos (« +30 s », « Passer ») a changé l'échéance
 * persistée hors de l'écran de séance ; l'écran ouvert la relit aussitôt (sinon il ne la relirait qu'au retour suivant au premier plan).
 * Aucune donnée ne passe par ce signal : la source de vérité reste la date de fin persistée (ADR 0013).
 */
const listeners = new Set<() => void>();

export function onRestChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function announceRestChanged(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // Un abonné en échec n'empêche pas les autres ; l'écran relira de toute façon l'échéance au retour au premier plan.
    }
  }
}
