import { describe, expect, it } from 'vitest';
import { at, START } from '../../../tests/fixtures/training/generation';
import { DEFAULT_GENERATION_CONFIG as C } from './config';
import { dayGroups, modeRules, recurringSlotCount, rotationPeriod, splitDayKind, validateSplit } from './programModes';

/** I3-01 : règles des modes (§ 12.3), des splits (§ 12.1 point 1) et de la variété (§ 12.1 point 3), D-73. */

describe('modes de programme (§ 12.3, D-73 point 1)', () => {
  it('Guidé : ordre, substitution, rotation et split ; Maison : Guidé avec un profil maison ; Libre : rien de tout cela ; Importé indisponible', () => {
    expect(modeRules('guide')).toEqual({ available: true, reorders: true, substitutes: true, rotates: true, usesSplit: true, requiresHomeProfile: false });
    expect(modeRules('maison')).toEqual({ available: true, reorders: true, substitutes: true, rotates: true, usesSplit: true, requiresHomeProfile: true });
    expect(modeRules('libre')).toEqual({ available: true, reorders: false, substitutes: false, rotates: false, usesSplit: false, requiresHomeProfile: false });
    expect(modeRules('importe').available).toBe(false);
  });
});

describe('splits (§ 12.1 point 1)', () => {
  it('jour du split : Haut / Bas alterne, PPL tourne par trois, Full Body et Custom constants', () => {
    expect([0, 1, 2, 3].map((d) => splitDayKind('upper-lower', d))).toEqual(['upper', 'lower', 'upper', 'lower']);
    expect([0, 1, 2, 3, 4, 5].map((d) => splitDayKind('ppl', d))).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs']);
    expect(splitDayKind('full-body', 2)).toBe('full-body');
    expect(splitDayKind('custom', 6)).toBe('custom');
  });

  it('groupes du jour : constantes de config pour les splits nommés, affectation explicite d’Ali pour Custom', () => {
    expect(dayGroups('upper-lower', 0, [], C)).toEqual(C.splitGroups.upper);
    expect(dayGroups('upper-lower', 1, [], C)).toEqual(C.splitGroups.lower);
    expect(dayGroups('ppl', 4, [], C)).toEqual(C.splitGroups.pull);
    expect(dayGroups('full-body', 0, [], C)).toHaveLength(11);
    expect(dayGroups('custom', 1, [['chest'], ['back', 'biceps']], C)).toEqual(['back', 'biceps']);
    expect(dayGroups('custom', 3, [['chest']], C)).toEqual([]);
  });

  it('bornes de jours : Full Body ≤ 3, Haut / Bas 4, PPL 5–6, Custom 1–7 (les groupes du jour demandé sont vérifiés par la génération)', () => {
    expect(validateSplit('full-body', 1, C)).toEqual([]);
    expect(validateSplit('full-body', 3, C)).toEqual([]);
    expect(validateSplit('full-body', 4, C)).toEqual(['split-days']);
    expect(validateSplit('upper-lower', 4, C)).toEqual([]);
    expect(validateSplit('upper-lower', 3, C)).toEqual(['split-days']);
    expect(validateSplit('ppl', 4, C)).toEqual(['split-days']);
    expect(validateSplit('ppl', 5, C)).toEqual([]);
    expect(validateSplit('ppl', 6, C)).toEqual([]);
    expect(validateSplit('ppl', 7, C)).toEqual(['split-days']);
    expect(validateSplit('custom', 1, C)).toEqual([]);
    expect(validateSplit('custom', 7, C)).toEqual([]);
    expect(validateSplit('custom', 8, C)).toEqual(['split-days']);
    expect(validateSplit('custom', 0, C)).toEqual(['split-days']);
  });
});

describe('variété (§ 12.1 point 3, D-73 point 5)', () => {
  it('Balanced : 70 % des emplacements de la séance, arrondi au-dessus (10 → 7, 7 → 5, 3 → 3, 1 → 1) ; Consistent : tous ; Varied : aucun', () => {
    expect(recurringSlotCount(10, 'balanced', C)).toBe(7);
    expect(recurringSlotCount(7, 'balanced', C)).toBe(5);
    expect(recurringSlotCount(3, 'balanced', C)).toBe(3);
    expect(recurringSlotCount(1, 'balanced', C)).toBe(1);
    expect(recurringSlotCount(0, 'balanced', C)).toBe(0);
    expect(recurringSlotCount(7, 'consistent', C)).toBe(7);
    expect(recurringSlotCount(7, 'varied', C)).toBe(0);
  });

  it('période : Balanced change toutes les 4 semaines depuis le début, Varied à chaque mésocycle (fourni, sinon semaines ÷ 5), Consistent jamais', () => {
    expect([0, 3, 4, 7, 8].map((w) => rotationPeriod('balanced', START, at(w, 6), null, C))).toEqual([0, 0, 1, 1, 2]);
    expect([0, 4, 5, 9, 10].map((w) => rotationPeriod('varied', START, at(w), null, C))).toEqual([0, 0, 1, 1, 2]);
    expect(rotationPeriod('varied', START, at(1), 3, C)).toBe(3);
    expect(rotationPeriod('consistent', START, at(40), 2, C)).toBe(0);
  });

  it('instant antérieur au début ou illisible : période 0 (jamais négative)', () => {
    expect(rotationPeriod('balanced', START, at(-9), null, C)).toBe(0);
    expect(rotationPeriod('balanced', 'pas une date' as typeof START, at(9), null, C)).toBe(0);
  });
});
