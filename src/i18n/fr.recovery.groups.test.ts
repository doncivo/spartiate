import { describe, expect, it } from 'vitest';
import { RECOVERY_CONFIG } from '../domain/recovery/config';
import { recoveryFr } from './fr.recovery';

/** NUTRI-0292 (BL-142) : chaque groupe musculaire du moteur a son libellé français (le domaine ne porte plus que des identifiants neutres). */
describe('libellés des groupes musculaires', () => {
  it('un libellé par identifiant neutre', () => {
    const labels = recoveryFr as unknown as Record<string, string>;
    expect(labels['muscleGroup_legs']).toBe('Jambes');
    for (const key of Object.keys(RECOVERY_CONFIG.groupRecoveryClass)) expect(typeof labels[`muscleGroup_${key}`]).toBe('string');
  });
});
