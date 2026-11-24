import { describe, expect, it } from 'vitest';
import { recoveryFr } from '../../i18n/fr.recovery';
import { RECOVERY_CONFIG } from './config';
import { muscleRecovery } from './muscleRecovery';
import type { RecoveryWorkout } from './types';

/** NUTRI-0292 (BL-142) : le domaine n'utilise plus de libellés français comme clés ; les libellés vivent dans src/i18n. */
const NEUTRAL = /^[a-z][a-z0-9_]*$/;

describe('BL-142 : clés neutres', () => {
  it('classes de récupération par groupe : clés neutres', () => {
    expect(Object.keys(RECOVERY_CONFIG.groupRecoveryClass).sort()).toEqual(['arms', 'back', 'chest', 'core', 'legs', 'shoulders']);
    for (const key of Object.keys(RECOVERY_CONFIG.groupRecoveryClass)) expect(key).toMatch(NEUTRAL);
  });
  it('groupe de chaque muscle : identifiant neutre connu', () => {
    for (const group of Object.values(RECOVERY_CONFIG.muscleGroups)) expect(group in RECOVERY_CONFIG.groupRecoveryClass).toBe(true);
  });
  it('chaque groupe a son libellé français dans src/i18n', () => {
    const labels = recoveryFr as unknown as Record<string, string>;
    expect(labels['muscleGroup_legs']).toBe('Jambes');
    for (const key of Object.keys(RECOVERY_CONFIG.groupRecoveryClass)) expect(typeof labels[`muscleGroup_${key}`]).toBe('string');
  });
  it('la ligne de récupération porte l\'identifiant neutre du groupe', () => {
    const w: RecoveryWorkout = { endedAt: '2026-11-07T10:00:00.000Z', sets: [{ kg: 100, reps: 5, difficulty: 'ok', isWarmup: false, completed: true, muscles: [{ id: 'quads', weight: 1 }] }] };
    expect(muscleRecovery({ workouts: [w], now: '2026-11-08T10:00:00.000Z' })[0]?.group).toBe('legs');
  });
});
