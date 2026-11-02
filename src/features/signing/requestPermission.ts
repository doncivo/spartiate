import { logFailure } from '../../platform/desktop/log';
import type { AppContainer } from '../app/container';
import { withExcursion } from '../security/excursion';
import { replanSigning } from './signingRun';

/**
 * Demande l'autorisation des notifications, sur un GESTE de l'utilisateur seulement (bouton « Autoriser » de À propos), puis lance un
 * passage `permission`. Jamais appelée au démarrage ; un refus ou une erreur est relu par le passage.
 */
export async function requestPermissionOnGesture(container: AppContainer): Promise<void> {
  try {
    // I-03 : fenêtre d'autorisation d'iOS = excursion (aucun reverrouillage à son retour).
    await withExcursion('permission', () => container.notifications.requestPermission());
  } catch {
    logFailure('notifications', 'request-permission-failed');
  }
  await replanSigning(container, 'permission');
}
