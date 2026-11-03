import { syncErrorCodeOf } from '../../../platform/sync/types';
import { syncPairingWindowFr } from '../../../i18n/fr.syncPairing';

/**
 * Textes de la fenêtre `pairing` (Y-06 critère 22, décision D6) : lus directement dans `src/i18n/fr.syncPairing.ts` (`syncPairingWindowFr`), sans le reste
 * de `src/i18n`, pour tenir la liste blanche du bundle. Français seul (SPA-001b, D-64).
 */
export type PairingTexts = typeof syncPairingWindowFr;

export function pairingTexts(): PairingTexts {
  return syncPairingWindowFr;
}

/** `{name}` remplacé par sa valeur (même syntaxe que `src/i18n`). */
export function fill(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Texte d'une erreur de la fenêtre (jamais le message technique, jamais l'entrée). */
export function pairingErrorText(texts: PairingTexts, error: unknown): string {
  switch (syncErrorCodeOf(error)) {
    case 'invalid-pairing':
      return texts.errors.invalidPairing;
    case 'key-mismatch':
      return texts.errors.keyMismatch;
    case 'cloud-pending':
      return texts.errors.cloudPending;
    case 'pairing-expired':
      return texts.errors.pairingExpired;
    case 'consent-denied':
      return texts.errors.consentDenied;
    case 'not-foreground':
      return texts.errors.notForeground;
    case 'rate-limited':
      return texts.errors.rateLimited;
    case 'not-configured':
      return texts.errors.notConfigured;
    case 'wrong-window':
    case 'wrong-mode':
      return texts.errors.wrongWindow;
    default:
      return texts.errors.generic;
  }
}
