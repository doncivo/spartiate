import type { PublishBlockedCause, SyncStatusWarning } from '../domain/syncBanners';
import { syncPublishCauseFr } from './fr.syncPublishCause';

/**
 * Y-FIX-02 (ADR 0011 §30) : texte d’une cause de `publish-blocked` (section AVERTISSEMENTS de Détails), à part du catalogue principal ;
 * importé seulement par des modules chargés à la demande. L’anglais est servi quand la langue courante est `en`.
 */
export const isPublishBlockedCause = (code: SyncStatusWarning): code is PublishBlockedCause => code in syncPublishCauseFr;

export function publishCauseText(code: PublishBlockedCause): string {
  return syncPublishCauseFr[code];
}
