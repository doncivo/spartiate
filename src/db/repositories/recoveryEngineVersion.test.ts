import { describe, expect, it } from 'vitest';
import { RECOVERY_ENGINE_VERSION } from './recoveryRepository';

/**
 * Relecture A (lot 0.29.2) : le moteur de récupération a changé (jour dans le fuseau de la mesure, nuit sous 180 min, baseline sur 30 jours, cardio, Exertion
 * au poids du corps) : la version écrite avec chaque résumé passe à 2, ce qui fait recalculer et réécrire les jours déjà stockés (`sameDay` compare la version).
 */
describe('RECOVERY_ENGINE_VERSION', () => {
  it('vaut 2 depuis le lot 0.29.2', () => {
    expect(RECOVERY_ENGINE_VERSION).toBe(2);
  });
});
