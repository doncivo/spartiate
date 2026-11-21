import type { AppContainer } from '../../app/container';

/** BLESSURES-b : après une écriture des gênes, le rappel de check-in de l'iPhone est replanifié (service chargé à la demande ; `unsupported` sur le PC). */
export function replanInjuryReminders(container: AppContainer): void {
  void import('../../notifications').then(
    (m) => m.injuryNotificationsFor(container).replan(),
    () => undefined,
  );
}
