import type { AppContainer } from '../../app/container';

/**
 * I6-05 (D-212) : après une écriture d'Ali (prise cochée, complément modifié), les rappels de l'iPhone sont replanifiés ; le service est chargé à
 * la demande et rend `unsupported` sur le PC sans rien lire. Jamais attendu par l'écran ; un échec est déjà journalisé par le service.
 */
export function replanSupplementReminders(container: AppContainer): void {
  void import('../../notifications').then(
    (m) => m.supplementNotificationsFor(container).replan(),
    () => undefined,
  );
}
