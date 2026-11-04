import { detectOs, detectRuntime } from '../runtime';
import { createTauriHealthKit } from './tauriHealthKit';
import { unsupportedHealthKit } from './unavailable';
import type { HealthKit } from './types';

export type {
  HealthKit,
  HealthKitAvailability,
  HealthKitBodyMass,
  HealthKitPermission,
  HealthKitRead,
  HealthKitSource,
  HealthKitStepCount,
} from './types';
export { createTauriHealthKit } from './tauriHealthKit';
export { unsupportedHealthKit } from './unavailable';
export type { HealthKitInvoker } from './tauriHealthKit';
export {
  isHealthKitAvailability,
  isHealthKitBodyMass,
  isHealthKitPermission,
  isHealthKitStepCount,
  readResult,
} from './validation';

export const healthKit: HealthKit =
  detectRuntime() === 'tauri' && detectOs() === 'ios' ? createTauriHealthKit() : unsupportedHealthKit;
