import { describe, expect, it } from 'vitest';
import type { LocalDate, LocalTime } from '../types';
import { aggregateDay } from './dayTotals';
import { toMealEntryInput, validateMealEntry, type MealEntryDraft } from './mealEntry';

/** I4-02 : validation d'une entrée de journal (méthode, provenance, grammes, macros, confiance) ; valeurs synthétiques. */

const STORED = '6a5b4c3d-0000-4000-8000-000000000001';
const entry = (over: Partial<MealEntryDraft> = {}): MealEntryDraft => ({
  date: '2026-11-08' as LocalDate,
  time: '12:30' as LocalTime,
  foodId: STORED,
  foodName: 'Fiche synthétique',
  source: 'custom',
  grams: 150,
  kcal: 150,
  proteinG: 15,
  fatG: 7.5,
  carbG: 12,
  method: 'search',
  confidence: null,
  ...over,
});

describe('validateMealEntry : recherche et scan', () => {
  it('entrée valide : aucune erreur ; macros inconnues admises (fiche incomplète)', () => {
    expect(validateMealEntry(entry())).toEqual([]);
    expect(validateMealEntry(entry({ kcal: 150, proteinG: null, fatG: null, carbG: null }))).toEqual([]);
    expect(validateMealEntry(entry({ kcal: null, proteinG: null, fatG: null, carbG: null }))).toEqual([]);
  });
  it('Ciqual : identifiant « ciqual:<code> » obligatoire pour la provenance Ciqual, et seulement pour elle', () => {
    expect(validateMealEntry(entry({ foodId: 'ciqual:1000', source: 'ciqual' }))).toEqual([]);
    expect(validateMealEntry(entry({ foodId: STORED, source: 'ciqual' }))).toContain('source-food-mismatch');
    expect(validateMealEntry(entry({ foodId: 'ciqual:1000', source: 'custom' }))).toContain('source-food-mismatch');
    expect(validateMealEntry(entry({ foodId: 'pomme', source: 'custom' }))).toContain('food-id-invalid');
  });
  it('scan : fiche stockée (Perso ou OFF) seulement ; Ciqual n’a pas de code-barres', () => {
    expect(validateMealEntry(entry({ method: 'scan', source: 'off' }))).toEqual([]);
    expect(validateMealEntry(entry({ method: 'scan', foodId: 'ciqual:1000', source: 'ciqual' }))).toContain('source-method-mismatch');
  });
  it('aliment obligatoire, grammes obligatoires et > 0', () => {
    expect(validateMealEntry(entry({ foodId: null }))).toContain('food-required');
    expect(validateMealEntry(entry({ grams: null }))).toContain('grams-required');
    for (const grams of [0, -1, Number.NaN, 10001]) expect(validateMealEntry(entry({ grams })), String(grams)).toContain('grams-invalid');
  });
  it('provenance « estimation » ou « manuel » interdite en recherche', () => {
    expect(validateMealEntry(entry({ source: 'estimate' }))).toContain('source-method-mismatch');
    expect(validateMealEntry(entry({ source: 'manual' }))).toContain('source-method-mismatch');
  });
});

describe('validateMealEntry : date, heure, nom, valeurs', () => {
  it('date et heure invalides', () => {
    expect(validateMealEntry(entry({ date: '2026-02-30' as LocalDate }))).toContain('date-invalid');
    expect(validateMealEntry(entry({ time: '24:00' as LocalTime }))).toContain('time-invalid');
    expect(validateMealEntry(entry({ time: '7:05' as LocalTime }))).toContain('time-invalid');
  });
  it('nom figé obligatoire, 120 caractères au plus', () => {
    expect(validateMealEntry(entry({ foodName: ' ' }))).toContain('name-empty');
    expect(validateMealEntry(entry({ foodName: 'x'.repeat(121) }))).toContain('name-too-long');
  });
  it('valeurs négatives ou non finies', () => {
    expect(validateMealEntry(entry({ kcal: -1 }))).toContain('value-invalid');
    expect(validateMealEntry(entry({ proteinG: Number.NaN }))).toContain('value-invalid');
    expect(validateMealEntry(entry({ carbG: Number.POSITIVE_INFINITY }))).toContain('value-invalid');
  });
  it('totaux incohérents avec les grammes : énergie au-delà de 900 kcal / 100 g, macros plus lourdes que la prise', () => {
    expect(validateMealEntry(entry({ grams: 100, kcal: 901 }))).toContain('energy-inconsistent');
    expect(validateMealEntry(entry({ grams: 100, kcal: 900 }))).toEqual([]);
    expect(validateMealEntry(entry({ grams: 100, proteinG: 60, fatG: 30, carbG: 20 }))).toContain('macros-exceed-grams');
  });
  it('méthode ou provenance hors liste', () => {
    expect(validateMealEntry(entry({ method: 'dictée' as never }))).toContain('method-invalid');
    expect(validateMealEntry(entry({ source: 'ia' as never }))).toContain('source-invalid');
  });
  it('confiance : entre 0 et 1 si fournie', () => {
    expect(validateMealEntry(entry({ confidence: 0.8 }))).toEqual([]);
    for (const confidence of [-0.1, 1.1, Number.NaN]) expect(validateMealEntry(entry({ confidence })), String(confidence)).toContain('confidence-invalid');
  });
});

describe('validateMealEntry : Quick Add', () => {
  const quick = (over: Partial<MealEntryDraft> = {}): MealEntryDraft =>
    entry({ method: 'quickadd', source: 'manual', foodId: null, foodName: 'Ajout rapide', grams: null, kcal: 400, proteinG: null, fatG: null, carbG: null, ...over });
  it('énergie obligatoire, sans aliment ni grammes, macros facultatives', () => {
    expect(validateMealEntry(quick())).toEqual([]);
    expect(validateMealEntry(quick({ proteinG: 20, fatG: 10, carbG: 30 }))).toEqual([]);
    expect(validateMealEntry(quick({ kcal: null }))).toContain('kcal-required');
  });
  it('provenance « manuel » seulement, pas d’aliment', () => {
    expect(validateMealEntry(quick({ source: 'custom' }))).toContain('source-method-mismatch');
    expect(validateMealEntry(quick({ foodId: STORED }))).toContain('food-id-invalid');
  });
});

describe('validateMealEntry : photo (schéma seulement, aucun flux ici)', () => {
  const photo = (over: Partial<MealEntryDraft> = {}): MealEntryDraft => entry({ method: 'photo', source: 'estimate', foodId: null, foodName: 'Pâtes (estimation)', confidence: 0.6, ...over });
  it('estimation corrigeable : confiance obligatoire, grammes obligatoires', () => {
    expect(validateMealEntry(photo())).toEqual([]);
    expect(validateMealEntry(photo({ confidence: null }))).toContain('confidence-required');
    expect(validateMealEntry(photo({ grams: null }))).toContain('grams-required');
    expect(validateMealEntry(photo({ source: 'custom' }))).toContain('source-method-mismatch');
  });
});

describe('toMealEntryInput : passage au moteur', () => {
  it('l’inconnu reste null', () => {
    const input = toMealEntryInput(entry({ kcal: null, proteinG: 12 }));
    expect(input).toEqual({ date: '2026-11-08', time: '12:30', kcal: null, proteinG: 12, fatG: 7.5, carbG: 12 });
  });
  it('une journée d’entrées à énergie inconnue n’a pas de total (jamais 0)', () => {
    const day = '2026-11-08' as LocalDate;
    const totals = aggregateDay(day, [toMealEntryInput(entry({ kcal: null })), toMealEntryInput(entry({ time: '19:00' as LocalTime }))]);
    expect(totals.kcal).toBeNull();
  });
});
