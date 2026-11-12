import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { isRenphoDayEntry, planRenphoDay, renphoDayDraft, RENPHO_DAY_ENTRY_NAME, type RenphoDayInput } from './renphoDay';
import { validateMealEntry } from './mealEntry';

/** I6-04 (D-113) : règle « les deux selon les jours » : le journal Spartiate fait foi, sinon une entrée unique « Renpho — total du jour ». */
const DAY = '2026-11-08' as LocalDate;
const TOTALS = { kcal: 2300, proteinG: 150, fatG: 70, carbG: 260, fiberG: 28 };
const base = (over: Partial<RenphoDayInput> = {}): RenphoDayInput => ({ day: DAY, totals: TOTALS, journalHasMeals: false, renpho: { live: null, deleted: false }, ...over });
const LIVE = { id: 'e1', kcal: 2300, proteinG: 150, fatG: 70, carbG: 260 };

describe('entrée « Renpho — total du jour »', () => {
  it('brouillon : Quick Add sans aliment, valide pour le journal, nom constant', () => {
    const d = renphoDayDraft(DAY, TOTALS);
    expect(d).toMatchObject({ date: DAY, foodId: null, foodName: RENPHO_DAY_ENTRY_NAME, source: 'manual', method: 'quickadd', grams: null, kcal: 2300, proteinG: 150, fatG: 70, carbG: 260 });
    expect(validateMealEntry(d)).toEqual([]);
    expect(RENPHO_DAY_ENTRY_NAME).toBe('Renpho — total du jour');
  });
  it('reconnaissance : nom et Quick Add manuel ; une entrée du même nom issue d’une recherche n’en est pas une', () => {
    expect(isRenphoDayEntry(renphoDayDraft(DAY, TOTALS))).toBe(true);
    expect(isRenphoDayEntry({ foodName: 'Poulet', method: 'quickadd', source: 'manual', foodId: null })).toBe(false);
    expect(isRenphoDayEntry({ foodName: RENPHO_DAY_ENTRY_NAME, method: 'search', source: 'custom', foodId: 'x' })).toBe(false);
  });
});

describe('plan d’un jour', () => {
  it('journal vide et rien d’importé : création', () => {
    expect(planRenphoDay(base())).toEqual({ action: 'create', fiber: 'save' });
  });
  it('des repas saisis par Ali : le journal fait foi, rien n’est écrit', () => {
    expect(planRenphoDay(base({ journalHasMeals: true }))).toEqual({ action: 'skip', reason: 'journal', fiber: 'none' });
  });
  it('des repas ET une entrée Renpho vivante : l’entrée Renpho est remplacée (supprimée), fibres retirées', () => {
    expect(planRenphoDay(base({ journalHasMeals: true, renpho: { live: LIVE, deleted: false } }))).toEqual({ action: 'supersede', id: 'e1', fiber: 'remove' });
  });
  it('réimport : même entrée mise à jour, jamais de doublon ; valeurs identiques : inchangée', () => {
    expect(planRenphoDay(base({ totals: { ...TOTALS, kcal: 2500 }, renpho: { live: LIVE, deleted: false } }))).toEqual({ action: 'update', id: 'e1', fiber: 'save' });
    expect(planRenphoDay(base({ renpho: { live: LIVE, deleted: false } }))).toEqual({ action: 'unchanged', id: 'e1', fiber: 'save' });
  });
  it('entrée supprimée par Ali : elle ne revient pas', () => {
    expect(planRenphoDay(base({ renpho: { live: null, deleted: true } }))).toEqual({ action: 'skip', reason: 'deleted', fiber: 'none' });
  });
  it('sans énergie (macros seules) : rien n’est créé ni modifié', () => {
    expect(planRenphoDay(base({ totals: { ...TOTALS, kcal: null } }))).toEqual({ action: 'skip', reason: 'no-energy', fiber: 'none' });
    expect(planRenphoDay(base({ totals: { ...TOTALS, kcal: null }, renpho: { live: LIVE, deleted: false } }))).toEqual({ action: 'skip', reason: 'no-energy', fiber: 'none' });
  });
  it('macro inconnue : null, jamais zéro ; fibres inconnues : rien à enregistrer', () => {
    expect(planRenphoDay(base({ totals: { kcal: 2000, proteinG: null, fatG: null, carbG: null, fiberG: null } }))).toEqual({ action: 'create', fiber: 'none' });
    expect(renphoDayDraft(DAY, { kcal: 2000, proteinG: null, fatG: null, carbG: null, fiberG: null })).toMatchObject({ proteinG: null, fatG: null, carbG: null });
  });
});
