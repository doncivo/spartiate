import { describe, expect, it } from 'vitest';
import { restTargetFromGap, restTargetFromKcal } from './restDay';
import type { Target } from './types';

/** NUTRI-0292 (C-037) : cible de repos cohérente (kcal = 4 P + 4 G + 9 L à l'arrondi près). Valeurs inventées. */
describe('C-037 : cible de repos', () => {
  it('glucides ramenés à 0 : les kcal sont recalculées sur protéines et lipides (jamais 0 g avec des kcal fantômes)', () => {
    const low: Target = { kcal: 2000, proteinG: 200, fatG: 100, carbG: 30 };
    expect(restTargetFromGap(low, -400)).toEqual({ kcal: 1700, proteinG: 200, fatG: 100, carbG: 0 });
  });

  it('glucides arrondis (comme le check-in), pas tronqués : 232,5 g donne 233 g', () => {
    const training: Target = { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 };
    expect(restTargetFromKcal(training, 2250).carbG).toBe(233);
  });

  it('cas ordinaire inchangé', () => {
    const training: Target = { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 };
    expect(restTargetFromGap(training, -200)).toEqual({ kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 });
  });
});
