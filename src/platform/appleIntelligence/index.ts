import { detectOs, detectRuntime } from '../runtime';
import { createTauriAppleIntelligence } from './tauriAppleIntelligence';
import { unsupportedAppleIntelligence } from './unavailable';
import type { AppleIntelligence } from './types';

export type { AppleIntelligence, AppleIntelligenceNativeError, AppleIntelligenceResult, AppleIntelligenceUnavailableReason } from './types';
export { createTauriAppleIntelligence, parseProbe } from './tauriAppleIntelligence';
export type { AppleIntelligenceInvoker } from './tauriAppleIntelligence';
export { unsupportedAppleIntelligence } from './unavailable';
export { createFakeAppleIntelligence, type FakeAppleIntelligence } from './fake';

/** iPhone (Tauri) : adaptateur réel ; ailleurs : stub `unsupported`. */
export function openAppleIntelligence(): AppleIntelligence {
  return detectRuntime() === 'tauri' && detectOs() === 'ios' ? createTauriAppleIntelligence() : unsupportedAppleIntelligence;
}
