import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '../types';
import {
  FOOD_GRAMS_MAX,
  OFF_CACHE_DAYS,
  computeTotals,
  energyMismatch,
  foodRefToId,
  isValidBarcode,
  offCacheState,
  parseFoodId,
  validateFoodDraft,
  validatePortion,
  type FoodDraft,
} from './food';

/** I4-02 : fiches (Perso / OFF en cache), portions, code-barres, totaux d'une prise, validité du cache OFF. Valeurs synthétiques. */

const per = (over: Partial<FoodDraft['per100g']> = {}): FoodDraft['per100g'] => ({ kcal: 100, proteinG: 10, fatG: 5, carbG: 8, fiberG: 2, ...over });
const custom = (over: Partial<FoodDraft> = {}): FoodDraft => ({ source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, per100g: per(), fetchedAt: null, ...over });
const off = (over: Partial<FoodDraft> = {}): FoodDraft => custom({ source: 'off', barcode: '4006381333931', fetchedAt: '2026-11-01T08:00:00.000Z' as IsoDateTime, ...over });

describe('code-barres (GS1)', () => {
  it('EAN-13, EAN-8, UPC-A et GTIN-14 valides (clé de contrôle)', () => {
    for (const ok of ['4006381333931', '96385074', '036000291452', '04006381333931']) expect(isValidBarcode(ok), ok).toBe(true);
  });
  it('mauvaise clé, longueur, caractères : refusés', () => {
    for (const bad of ['4006381333932', '123', '40063813339310000', 'abcdefgh', '4006381 333931', '', '4006381333931\n']) expect(isValidBarcode(bad), bad).toBe(false);
  });
});

describe('validateFoodDraft', () => {
  it('fiche valide : aucune erreur ; valeurs inconnues admises (jamais 0 imposé)', () => {
    expect(validateFoodDraft(custom())).toEqual([]);
    expect(validateFoodDraft(custom({ per100g: per({ kcal: 120, proteinG: null, fatG: null, carbG: null, fiberG: null }) }))).toEqual([]);
    expect(validateFoodDraft(custom({ barcode: '4006381333931' }))).toEqual([]);
  });
  it('nom : vide, espaces, trop long', () => {
    expect(validateFoodDraft(custom({ name: '   ' }))).toContain('name-empty');
    expect(validateFoodDraft(custom({ name: 'x'.repeat(121) }))).toContain('name-too-long');
    expect(validateFoodDraft(custom({ brand: 'y'.repeat(121) }))).toContain('brand-too-long');
  });
  it('fiche sans aucune valeur nutritionnelle : refusée', () => {
    expect(validateFoodDraft(custom({ per100g: per({ kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null }) }))).toContain('no-nutrient');
  });
  it('valeurs négatives, non finies, énergie impossible, macros au-delà de 100 g / 100 g', () => {
    expect(validateFoodDraft(custom({ per100g: per({ kcal: -1 }) }))).toContain('value-invalid');
    expect(validateFoodDraft(custom({ per100g: per({ proteinG: Number.NaN }) }))).toContain('value-invalid');
    expect(validateFoodDraft(custom({ per100g: per({ fatG: Number.POSITIVE_INFINITY }) }))).toContain('value-invalid');
    expect(validateFoodDraft(custom({ per100g: per({ kcal: 901 }) }))).toContain('energy-too-high');
    expect(validateFoodDraft(custom({ per100g: per({ proteinG: 60, fatG: 30, carbG: 20 }) }))).toContain('macros-exceed-100g');
    expect(validateFoodDraft(custom({ per100g: per({ fiberG: 101 }) }))).toContain('value-invalid');
  });
  it('code-barres invalide refusé pour toute source', () => {
    expect(validateFoodDraft(custom({ barcode: '1234567890123' }))).toContain('barcode-invalid');
  });
  it('provenance cohérente : OFF exige code-barres et date de récupération, Perso n’en a pas', () => {
    expect(validateFoodDraft(off())).toEqual([]);
    expect(validateFoodDraft(off({ barcode: null }))).toContain('off-needs-barcode');
    expect(validateFoodDraft(off({ fetchedAt: null }))).toContain('off-needs-fetched-at');
    expect(validateFoodDraft(custom({ fetchedAt: '2026-11-01T08:00:00.000Z' as IsoDateTime }))).toContain('custom-has-fetched-at');
  });
  it('source inconnue (Ciqual n’est jamais stocké) : refusée', () => {
    expect(validateFoodDraft({ ...custom(), source: 'ciqual' as never })).toContain('source-invalid');
  });
});

describe('energyMismatch : avertissement, pas une erreur', () => {
  it('kcal proche de 4P + 4G + 9L : cohérent ; très éloigné : signalé ; inconnu : jamais signalé', () => {
    expect(energyMismatch(per({ kcal: 150, proteinG: 10, fatG: 5, carbG: 16 }))).toBe(false);
    expect(energyMismatch(per({ kcal: 400, proteinG: 10, fatG: 5, carbG: 16 }))).toBe(true);
    expect(energyMismatch(per({ kcal: null }))).toBe(false);
    expect(energyMismatch(per({ proteinG: null }))).toBe(false);
  });
});

describe('validatePortion', () => {
  it('portion valide', () => expect(validatePortion({ label: '1 tranche', grams: 30, position: 0 })).toEqual([]));
  it('libellé vide ou trop long, grammes nuls, négatifs, énormes ou non finis, position négative', () => {
    expect(validatePortion({ label: ' ', grams: 30, position: 0 })).toContain('label-empty');
    expect(validatePortion({ label: 'x'.repeat(81), grams: 30, position: 0 })).toContain('label-too-long');
    for (const grams of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 5001]) expect(validatePortion({ label: 'a', grams, position: 0 }), String(grams)).toContain('grams-invalid');
    expect(validatePortion({ label: 'a', grams: 30, position: -1 })).toContain('position-invalid');
    expect(validatePortion({ label: 'a', grams: 30, position: 1.5 })).toContain('position-invalid');
  });
});

describe('computeTotals : grammes → totaux, l’inconnu reste inconnu', () => {
  it('150 g à 52 kcal / 100 g : 78 kcal ; arrondi au dixième', () => {
    expect(computeTotals(per({ kcal: 52, proteinG: 0.3, fatG: 0.2, carbG: 11.4 }), 150)).toEqual({ kcal: 78, proteinG: 0.5, fatG: 0.3, carbG: 17.1 });
  });
  it('valeur inconnue : null (jamais 0)', () => {
    expect(computeTotals(per({ kcal: 52, proteinG: null }), 100)).toEqual({ kcal: 52, proteinG: null, fatG: 5, carbG: 8 });
  });
  it('grammes invalides : null (aucun total)', () => {
    for (const g of [0, -1, Number.NaN, FOOD_GRAMS_MAX + 1]) expect(computeTotals(per(), g), String(g)).toBeNull();
  });
});

describe('références d’aliment', () => {
  it('Ciqual : « ciqual:<code> » ; fiche stockée : son UUID', () => {
    expect(foodRefToId({ kind: 'ciqual', code: '1000' })).toBe('ciqual:1000');
    const id = '6a5b4c3d-0000-4000-8000-000000000001';
    expect(foodRefToId({ kind: 'stored', id })).toBe(id);
    expect(parseFoodId('ciqual:1000')).toEqual({ kind: 'ciqual', code: '1000' });
    expect(parseFoodId(id)).toEqual({ kind: 'stored', id });
  });
  it('identifiant mal formé : null', () => {
    for (const bad of ['', 'ciqual:', 'ciqual:abc', 'ciqual:12 34', 'pomme', 'ciqual:1000;DROP']) expect(parseFoodId(bad), bad).toBeNull();
  });
});

describe('cache Open Food Facts : 90 jours (H-12)', () => {
  const now = '2026-11-08T12:00:00.000Z' as IsoDateTime;
  it('constante', () => expect(OFF_CACHE_DAYS).toBe(90));
  it('valide jusqu’à 90 jours inclus, expiré au-delà', () => {
    expect(offCacheState('2026-11-08T11:00:00.000Z', now)).toBe('fresh');
    expect(offCacheState('2026-08-10T12:00:00.000Z', now)).toBe('fresh');
    expect(offCacheState('2026-08-10T11:59:59.000Z', now)).toBe('expired');
    expect(offCacheState('2025-01-01T00:00:00.000Z', now)).toBe('expired');
  });
  it('date illisible ou dans le futur (au-delà de 24 h de dérive d’horloge) : invalide, jamais valide', () => {
    for (const bad of ['', 'hier', '2026-13-01T00:00:00.000Z', '2026-11-08']) expect(offCacheState(bad, now), bad).toBe('invalid');
    expect(offCacheState('2026-11-09T11:00:00.000Z', now)).toBe('fresh');
    expect(offCacheState('2026-11-09T13:00:00.000Z', now)).toBe('invalid');
  });
});
