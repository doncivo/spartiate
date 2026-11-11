import { describe, expect, it } from 'vitest';
import { FACTOR_CODES } from '../../domain/recovery';
import { encodeFactors, parseFactors } from './recoveryFactorJson';

/** I6-01 : validation à la main du JSON de `recovery_factor.factors` (ADR 0008), sur le modèle de `recoveryJson.ts`. */
describe('parseFactors', () => {
  it('tableau de codes connus : valeur typée, sans doublon, dans l’ordre du catalogue de codes', () => {
    expect(parseFactors('["stress","alcohol","stress"]')).toEqual(['alcohol', 'stress']);
    expect(parseFactors('[]')).toEqual([]);
    expect(parseFactors(JSON.stringify([...FACTOR_CODES]))).toEqual([...FACTOR_CODES]);
  });

  it('un code inconnu (iPhone plus récent) est ignoré, les connus sont gardés ; la ligne reste lisible', () => {
    expect(parseFactors('["code_du_futur","travel"]')).toEqual(['travel']);
    expect(parseFactors('["autre"]')).toEqual([]);
  });

  it('texte illisible, nul, non tableau, élément qui n’est pas un texte, trop long : null', () => {
    expect(parseFactors(null)).toBeNull();
    expect(parseFactors('pas du json')).toBeNull();
    expect(parseFactors('{"a":1}')).toBeNull();
    expect(parseFactors('[1]')).toBeNull();
    expect(parseFactors('[null]')).toBeNull();
    expect(parseFactors(JSON.stringify(Array.from({ length: 33 }, () => 'alcohol')))).toBeNull();
  });

  it('encodeFactors : tableau JSON canonique (ordre du catalogue, sans doublon)', () => {
    expect(encodeFactors(['travel', 'alcohol', 'travel'])).toBe('["alcohol","travel"]');
    expect(encodeFactors([])).toBe('[]');
  });
});
