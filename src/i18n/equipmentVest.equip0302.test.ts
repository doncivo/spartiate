import { describe, expect, it } from 'vitest';
import { trainingFr } from './fr.training';

/** EQUIP-0302 (contre-relecture code) : le refus d'un nom de barre trop long interpole sa propre borne et la borne des listes. */
describe('EQUIP-0302 : texte du refus des barres', () => {
  it('errorProfileBarbells interpole {name} et {max}', () => {
    expect(trainingFr.errorProfileBarbells).toContain('{name}');
    expect(trainingFr.errorProfileBarbells).toContain('{max}');
  });
});
