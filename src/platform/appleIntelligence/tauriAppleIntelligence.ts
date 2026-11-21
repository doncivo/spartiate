import type { AppleIntelligence, AppleIntelligenceNativeError, AppleIntelligenceResult, AppleIntelligenceUnavailableReason } from './types';

export type AppleIntelligenceInvoker = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const PROBE_COMMAND = 'apple_intelligence_probe';
const RESPONSE_MAX = 2000;
const DESCRIPTION_MAX = 300;
const PROMPT_MAX = 500;
const BAD_REPLY: AppleIntelligenceResult = { kind: 'failed', code: 'bad-reply' };

const text = (value: unknown, max: number): string | null => (typeof value === 'string' ? value.slice(0, max) : null);

/** Motif du système (`String(describing: reason)` côté Swift) ramené à un code connu ; le détail brut reste affiché. */
function modelReason(detail: string | null): AppleIntelligenceUnavailableReason {
  if (detail === null) return 'unknown';
  if (detail.includes('deviceNotEligible')) return 'device-not-eligible';
  if (detail.includes('appleIntelligenceNotEnabled')) return 'not-enabled';
  if (detail.includes('modelNotReady')) return 'model-not-ready';
  return 'unknown';
}

function nativeErrorOf(value: unknown): AppleIntelligenceNativeError | null {
  if (typeof value !== 'object' || value === null) return null;
  const { domain, code, description } = value as Record<string, unknown>;
  if (typeof domain !== 'string' || typeof code !== 'number' || !Number.isFinite(code) || typeof description !== 'string') return null;
  return { domain: domain.slice(0, 120), code, description: description.slice(0, DESCRIPTION_MAX) };
}

/** Code de Rust (`appleintelligence-timeout`, …) ; tout autre rejet : `failed`, jamais un texte natif. */
function codeOf(error: unknown): string {
  if (typeof error === 'string' && /^[a-z0-9-]{1,60}$/.test(error)) return error;
  return 'failed';
}

/** Lecture de la réponse du Swift (via Rust) ; toute forme inattendue → `bad-reply`. */
export function parseProbe(value: unknown): AppleIntelligenceResult {
  if (typeof value !== 'object' || value === null) return BAD_REPLY;
  const raw = value as Record<string, unknown>;
  const prompt = text(raw['prompt'], PROMPT_MAX);
  switch (raw['status']) {
    case 'answered': {
      const response = text(raw['response'], RESPONSE_MAX);
      if (prompt === null || response === null) return BAD_REPLY;
      const elapsed = raw['elapsedMs'];
      return { kind: 'answered', prompt, response, elapsedMs: typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null };
    }
    case 'unavailable': {
      const detail = text(raw['detail'], DESCRIPTION_MAX);
      const reason = raw['reason'] === 'sdk-absent' ? 'sdk-absent' : raw['reason'] === 'os-too-old' ? 'os-too-old' : modelReason(detail);
      return { kind: 'unavailable', reason, detail, prompt };
    }
    case 'error': {
      const error = nativeErrorOf(raw['error']);
      return error === null ? BAD_REPLY : { kind: 'error', prompt, error };
    }
    default:
      return BAD_REPLY;
  }
}

function defaultInvoker(): AppleIntelligenceInvoker {
  return async (command, args) => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(command, args);
  };
}

/** Adaptateur iPhone : Rust seul appelle le plugin Swift ; ici, la commande `apple_intelligence_probe` (capability apple-intelligence-ios.json). */
export function createTauriAppleIntelligence(options: { readonly invoke?: AppleIntelligenceInvoker } = {}): AppleIntelligence {
  const invoke = options.invoke ?? defaultInvoker();
  return {
    async probe(): Promise<AppleIntelligenceResult> {
      try {
        return parseProbe(await invoke(PROBE_COMMAND));
      } catch (error) {
        return { kind: 'failed', code: codeOf(error) };
      }
    },
  };
}
