/**
 * Essai Apple Intelligence (IOS-029b, H-41 proposée) : le modèle local d'Apple (Foundation Models, iOS 26) interrogé avec un texte
 * synthétique fixe, écrit dans le Swift. Le résultat est rendu tel quel ; aucune donnée de l'app n'est envoyée.
 */
export type AppleIntelligenceUnavailableReason = 'sdk-absent' | 'os-too-old' | 'device-not-eligible' | 'not-enabled' | 'model-not-ready' | 'unknown';

export interface AppleIntelligenceNativeError {
  readonly domain: string;
  readonly code: number;
  readonly description: string;
}

export type AppleIntelligenceResult =
  | { readonly kind: 'answered'; readonly prompt: string; readonly response: string; readonly elapsedMs: number | null }
  | { readonly kind: 'unavailable'; readonly reason: AppleIntelligenceUnavailableReason; readonly detail: string | null; readonly prompt: string | null }
  | { readonly kind: 'error'; readonly prompt: string | null; readonly error: AppleIntelligenceNativeError }
  /** Appel impossible (délai, plugin absent, réponse illisible) : code court, jamais un texte natif. */
  | { readonly kind: 'failed'; readonly code: string }
  /** PC, navigateur : aucun modèle local à interroger. */
  | { readonly kind: 'unsupported' };

export interface AppleIntelligence {
  /** Lance l'essai ; ne rejette jamais. */
  probe(): Promise<AppleIntelligenceResult>;
}
