import type { LiveActivity, LiveActivityAvailability, LiveActivityEnd, LiveActivityNativeError, LiveActivityReason, LiveActivityStart, LiveActivityStartInput } from './types';

export type LiveActivityInvoker = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const STATUS_COMMAND = 'live_activity_status';
const START_COMMAND = 'live_activity_start';
const END_COMMAND = 'live_activity_end';
const DESCRIPTION_MAX = 200;

function nativeErrorOf(value: unknown): LiveActivityNativeError | null {
  if (typeof value !== 'object' || value === null) return null;
  const { domain, code, description } = value as Record<string, unknown>;
  if (typeof domain !== 'string' || typeof code !== 'number' || !Number.isFinite(code) || typeof description !== 'string') return null;
  return { domain: domain.slice(0, 120), code, description: description.slice(0, DESCRIPTION_MAX) };
}

function codeOf(error: unknown): string | undefined {
  if (typeof error === 'string' && /^[a-z0-9-]{1,60}$/.test(error)) return error;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' && /^[a-z0-9-]{1,60}$/.test(code)) return code;
  }
  return undefined;
}

const reasonOf = (value: unknown): LiveActivityReason => (value === 'disabled' ? 'disabled' : value === 'unsupported' ? 'unsupported' : 'unknown');

function defaultInvoker(): LiveActivityInvoker {
  return async (command, args) => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(command, args);
  };
}

/** Adaptateur iPhone : Rust seul appelle le plugin Swift ; ici, les commandes `live_activity_*` (capability live-activity-ios.json). */
export function createTauriLiveActivity(options: { readonly invoke?: LiveActivityInvoker } = {}): LiveActivity {
  const invoke = options.invoke ?? defaultInvoker();
  return {
    async isAvailable(): Promise<LiveActivityAvailability> {
      try {
        const status = await invoke(STATUS_COMMAND);
        if (typeof status !== 'object' || status === null) return { available: false, reason: 'unknown', error: null };
        const { available, reason, lastError } = status as Record<string, unknown>;
        if (available === true) return { available: true };
        return { available: false, reason: available === false ? reasonOf(reason) : 'unknown', error: nativeErrorOf(lastError) };
      } catch {
        return { available: false, reason: 'unknown', error: null };
      }
    },

    async start(input: LiveActivityStartInput): Promise<LiveActivityStart> {
      try {
        const result = await invoke(START_COMMAND, { endDateMs: input.endDateMs, label: input.label });
        if (typeof result === 'object' && result !== null && (result as { started?: unknown }).started === true) return { started: true };
        return { started: false, reason: 'failed', error: nativeErrorOf((result as { error?: unknown } | null)?.error) };
      } catch (error) {
        return { started: false, reason: codeOf(error) === 'liveactivity-disabled' ? 'disabled' : 'failed', error: null };
      }
    },

    async end(): Promise<LiveActivityEnd> {
      try {
        const result = await invoke(END_COMMAND);
        if (typeof result === 'object' && result !== null && (result as { ended?: unknown }).ended === true) {
          const count = (result as { count?: unknown }).count;
          return { ended: true, count: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 0 };
        }
        return { ended: false, error: nativeErrorOf((result as { error?: unknown } | null)?.error) };
      } catch {
        return { ended: false, error: null };
      }
    },
  };
}
