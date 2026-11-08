import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '../types';
import { FOOD_BRAND_MAX, FOOD_NAME_MAX, validateFoodDraft } from './food';
import { offCacheDecision, offProductToDraft, type OffRawProduct } from './offProduct';

/** I4-05 : fiche Open Food Facts brute -> brouillon de fiche `off`. Valeurs synthétiques ; une valeur absente ou illisible est `null`, jamais 0. */
const NOW = '2026-11-09T09:00:00.000Z' as IsoDateTime;
const raw = (over: Partial<OffRawProduct> = {}): OffRawProduct => ({
  code: '4006381333931',
  product_name: 'Skyr nature',
  brands: 'Marque A,Marque B',
  quantity: '150 g',
  nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, fat_100g: 0.2, carbohydrates_100g: 4, fiber_100g: 0 },
  ...over,
});

describe('offProductToDraft : fiche complète', () => {
  it('valeurs pour 100 g, source off, code et date de récupération ; première marque ; valide pour le dépôt', () => {
    const r = offProductToDraft(raw(), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toEqual({
      source: 'off',
      barcode: '4006381333931',
      name: 'Skyr nature',
      brand: 'Marque A',
      per100g: { kcal: 63, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: 0 },
      fetchedAt: NOW,
    });
    expect(r.missing).toEqual([]);
    expect(validateFoodDraft(r.draft)).toEqual([]);
  });
  it('un zéro réel d’OFF reste 0 (fibres 0 g annoncées)', () => {
    const r = offProductToDraft(raw(), NOW);
    expect(r.ok && r.draft.per100g.fiberG).toBe(0);
  });
});

describe('offProductToDraft : énergie', () => {
  it('kcal absent : kJ / 4,184 arrondi à l’entier', () => {
    const r = offProductToDraft(raw({ nutriments: { 'energy-kj_100g': 264, proteins_100g: 11 } }), NOW);
    expect(r.ok && r.draft.per100g.kcal).toBe(63);
  });
  it('kcal présent : prime sur les kJ', () => {
    const r = offProductToDraft(raw({ nutriments: { 'energy-kcal_100g': 70, 'energy-kj_100g': 999, proteins_100g: 1 } }), NOW);
    expect(r.ok && r.draft.per100g.kcal).toBe(70);
  });
  it('énergie absente avec macros : kcal reste null (jamais calculé ni 0), signalé manquant', () => {
    const r = offProductToDraft(raw({ nutriments: { proteins_100g: 11, fat_100g: 1, carbohydrates_100g: 4 } }), NOW);
    expect(r.ok && r.draft.per100g.kcal).toBeNull();
    expect(r.ok && r.missing).toContain('kcal');
  });
});

describe('offProductToDraft : valeurs absentes ou illisibles = null, jamais 0', () => {
  it('fiche incomplète acceptée avec la liste de ce qui manque', () => {
    const r = offProductToDraft(raw({ nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11 } }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.per100g).toEqual({ kcal: 63, proteinG: 11, fatG: null, carbG: null, fiberG: null });
    expect(r.missing).toEqual(['fatG', 'carbG', 'fiberG']);
  });
  it('texte, NaN, négatif, infini : null', () => {
    const r = offProductToDraft(
      raw({ nutriments: { 'energy-kcal_100g': 63, proteins_100g: '11', fat_100g: Number.NaN, carbohydrates_100g: -3, fiber_100g: Number.POSITIVE_INFINITY } }),
      NOW,
    );
    expect(r.ok && r.draft.per100g).toEqual({ kcal: 63, proteinG: null, fatG: null, carbG: null, fiberG: null });
  });
});

describe('offProductToDraft : refus typés', () => {
  it('sans énergie NI protéines, lipides, glucides : refusée (no-nutrition), les fibres seules ne suffisent pas', () => {
    expect(offProductToDraft(raw({ nutriments: {} }), NOW)).toEqual({ ok: false, reason: 'no-nutrition' });
    expect(offProductToDraft(raw({ nutriments: { fiber_100g: 3 } }), NOW)).toEqual({ ok: false, reason: 'no-nutrition' });
    expect(offProductToDraft(raw({ nutriments: { 'energy-kcal_100g': Number.NaN, proteins_100g: 'x' } }), NOW)).toEqual({ ok: false, reason: 'no-nutrition' });
  });
  it('code-barres invalide : invalid-code', () => {
    expect(offProductToDraft(raw({ code: '4006381333932' }), NOW)).toEqual({ ok: false, reason: 'invalid-code' });
  });
  it('sans nom ni marque : no-name ; sans nom mais avec marque : la marque sert de nom', () => {
    expect(offProductToDraft(raw({ product_name: '  ', brands: '' }), NOW)).toEqual({ ok: false, reason: 'no-name' });
    const r = offProductToDraft(raw({ product_name: undefined, brands: 'Marque A' }), NOW);
    expect(r.ok && r.draft.name).toBe('Marque A');
  });
  it('valeurs invraisemblables (énergie > 900 kcal, macros > 100 g) : implausible', () => {
    expect(offProductToDraft(raw({ nutriments: { 'energy-kcal_100g': 3500, proteins_100g: 1 } }), NOW)).toEqual({ ok: false, reason: 'implausible' });
    expect(offProductToDraft(raw({ nutriments: { 'energy-kcal_100g': 300, proteins_100g: 140 } }), NOW)).toEqual({ ok: false, reason: 'implausible' });
  });
});

describe('offProductToDraft : textes', () => {
  it('nom tronqué à 120, marque à 120, espaces compactés ; la fiche reste valide', () => {
    const r = offProductToDraft(raw({ product_name: `  ${'é'.repeat(300)}  `, brands: 'm'.repeat(300) }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.name).toHaveLength(FOOD_NAME_MAX);
    expect(r.draft.brand).toHaveLength(FOOD_BRAND_MAX);
    expect(validateFoodDraft(r.draft)).toEqual([]);
    const spaced = offProductToDraft(raw({ product_name: 'Skyr   \n nature' }), NOW);
    expect(spaced.ok && spaced.draft.name).toBe('Skyr nature');
  });
  it('marque vide : null ; code UPC-A d’OFF normalisé en 13 chiffres', () => {
    const r = offProductToDraft(raw({ code: '036000291452', brands: undefined }), NOW);
    expect(r.ok && r.draft.brand).toBeNull();
    expect(r.ok && r.draft.barcode).toBe('0036000291452');
  });
});

describe('offCacheDecision (cache 90 jours)', () => {
  it('fraîche : lecture du cache sans réseau ; expirée ou illisible : nouvel appel', () => {
    expect(offCacheDecision('2026-10-01T09:00:00.000Z', NOW)).toBe('use-cache');
    expect(offCacheDecision('2026-08-11T09:00:00.000Z', NOW)).toBe('use-cache');
    expect(offCacheDecision('2026-08-01T09:00:00.000Z', NOW)).toBe('refresh');
    expect(offCacheDecision('n’importe quoi', NOW)).toBe('refresh');
  });
});
