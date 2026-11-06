import { detectOs, detectRuntime } from '../runtime';
import { createTauriLiveActivity } from './tauriLiveActivity';
import { unsupportedLiveActivity } from './unavailable';
import type { LiveActivity } from './types';

export type {
  LiveActivity,
  LiveActivityAvailability,
  LiveActivityEnd,
  LiveActivityNativeError,
  LiveActivityReason,
  LiveActivityStart,
  LiveActivityStartInput,
} from './types';
export { createTauriLiveActivity } from './tauriLiveActivity';
export type { LiveActivityInvoker } from './tauriLiveActivity';
export { unsupportedLiveActivity } from './unavailable';

export const liveActivity: LiveActivity = detectRuntime() === 'tauri' && detectOs() === 'ios' ? createTauriLiveActivity() : unsupportedLiveActivity;
