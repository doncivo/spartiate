import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Proposal } from '../../domain/nutrition';
import type { SearchableFood } from '../../domain/nutrition/foodSearch';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { entryFromFood, loadNutritionSnapshot, quickAddDraft, recordCheckInDecision, saveManualTarget, saveNutritionPrefs } from './useCases';

/**
 * I4-03 : cas d'usage de Nutrition (sans interface). Base SQLite réelle (wasm). Journée sans entrée jamais à zéro ; une décision de check-in
 * passe par `resolveCheckIn` (plancher 1 200 / 800) et est tracée (`nutrition_target`), un refus est conservé sans changer la cible.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d1' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const WEEK = '2026-11-09' as LocalDate;
let db: TestDb;
const t = (s: string): LocalTime => s as LocalTime;

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  await db.close();
});

const food = (over: Partial<SearchableFood> = {}): SearchableFood => ({
  ref: 'ciqual:13013',
  provenance: 'ciqual',
  name: 'Banane',
  brand: null,
  barcode: null,
  per100g: { kcal: 90, proteinG: 1, fatG: 0.3, carbG: 20, fiberG: 2 },
  ...over,
});

describe('loadNutritionSnapshot', () => {
  it('base vide : aucune cible, aucune dépense, jours « unknown » (jamais zéro), préférences par défaut', async () => {
    const s = await loadNutritionSnapshot(db.data, TODAY);
    expect(s.today).toBe(TODAY);
    expect(s.target).toBeNull();
    expect(s.tdee.value).toBeNull();
    expect(s.days.length).toBe(60);
    expect(s.days.every((d) => d.state === 'unknown' && d.kcal === null)).toBe(true);
    expect(s.prefs.goal).toEqual({ kind: 'maintain' });
    expect(s.weighIns).toEqual([]);
  });

  it('entrées du jour et pesées relues ; la journée en cours est partielle', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: t('08:00'), name: '', kcal: 500, proteinG: null, fatG: null, carbG: null }));
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-08' as LocalDate, kg: 81.2, timezone: 'Europe/Paris' }, TODAY);
    const s = await loadNutritionSnapshot(db.data, TODAY);
    const day = s.days.find((d) => d.date === TODAY);
    expect(day).toMatchObject({ state: 'partial', kcal: 500, proteinG: null });
    expect(s.weighIns).toEqual([{ date: '2026-11-08', kg: 81.2 }]);
  });

  it('préférences enregistrées relues (activité déclarée)', async () => {
    await saveNutritionPrefs(db.data, { activity: 'light', style: 'guided', goal: { kind: 'loss', weeklyRateKg: 0.3 }, checkInWeekday: 3 });
    const s = await loadNutritionSnapshot(db.data, TODAY);
    expect(s.prefs).toEqual({ activity: 'light', style: 'guided', goal: { kind: 'loss', weeklyRateKg: 0.3 }, checkInWeekday: 3 });
  });
});

describe('entryFromFood et quickAddDraft', () => {
  it('aliment Ciqual : méthode search, provenance conservée, totaux au dixième', () => {
    const draft = entryFromFood(food(), 120, { date: TODAY, time: t('07:10') });
    expect(draft).toMatchObject({ method: 'search', source: 'ciqual', foodId: 'ciqual:13013', foodName: 'Banane', grams: 120, kcal: 108, proteinG: 1.2, confidence: null });
  });
  it('valeur inconnue de la fiche : reste null dans l’entrée', () => {
    const draft = entryFromFood(food({ per100g: { kcal: 90, proteinG: null, fatG: null, carbG: 20, fiberG: null } }), 100, { date: TODAY, time: t('07:10') });
    expect(draft).toMatchObject({ kcal: 90, proteinG: null, fatG: null, carbG: 20 });
  });
  it('grammes invalides : null (rien à enregistrer)', () => {
    expect(entryFromFood(food(), 0, { date: TODAY, time: t('07:10') })).toBeNull();
    expect(entryFromFood(food(), Number.NaN, { date: TODAY, time: t('07:10') })).toBeNull();
  });
  it('Quick Add : source manuelle, nom par défaut « Ajout rapide », macros omises = null', () => {
    const draft = quickAddDraft({ date: TODAY, time: t('16:30'), name: '  ', kcal: 300, proteinG: null, fatG: null, carbG: 40 });
    expect(draft).toMatchObject({ method: 'quickadd', source: 'manual', foodId: null, grams: null, kcal: 300, proteinG: null, carbG: 40, foodName: 'Ajout rapide' });
  });
});

const proposal = (kcal: number, over: Partial<Proposal> = {}): Proposal => ({
  target: { kcal, proteinG: 170, fatG: 75, carbG: Math.max(0, Math.round((kcal - 680 - 675) / 4)) },
  previousTarget: { kcal: 2650, proteinG: 170, fatG: 75, carbG: 300 },
  deltaKcal: kcal - 2650,
  initial: false,
  clampedBy: [],
  belowStandardFloor: kcal < 1200,
  options: ['accept', 'customize', 'refuse'],
  alternatives: [],
  applied: false,
  trace: { engineVersion: 1, tdee: 2700, desiredKcal: kcal, weeklyRateKg: 0, weightKg: 81 },
  ...over,
});
const decide = (p: Proposal, decision: Parameters<typeof recordCheckInDecision>[1]['decision'], lowFloorConfirmed = false) =>
  recordCheckInDecision(db.data, { proposal: p, weekStart: WEEK, weightKg: 81, currentTarget: p.previousTarget, decision, lowFloorConfirmed });
const rows = async () => (await db.data.repos.nutritionTargets()).list();

describe('recordCheckInDecision : le moteur propose, Ali décide', () => {
  it('accepter : cible de la proposition enregistrée (auto, acceptée, version du moteur)', async () => {
    const r = await decide(proposal(2700), { action: 'accept' });
    expect(r.record).toMatchObject({ source: 'auto', accepted: true, engineVersion: 1, weekStart: WEEK, target: { kcal: 2700 } });
    expect((await (await db.data.repos.nutritionTargets()).effective(WEEK))?.target.kcal).toBe(2700);
  });

  it('refuser : trace conservée (acceptée = faux), la cible en vigueur ne change pas, relançable', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-02' as LocalDate, target: { kcal: 2650, proteinG: 170, fatG: 75, carbG: 300 }, lowFloorConfirmed: false });
    const r = await decide(proposal(2700), { action: 'refuse' });
    expect(r.outcome).toMatchObject({ action: 'refuse', retryable: true });
    expect(r.record).toMatchObject({ source: 'auto', accepted: false });
    expect((await (await db.data.repos.nutritionTargets()).effective(WEEK))?.target.kcal).toBe(2650);
    expect(await rows()).toHaveLength(2);
  });

  it('personnaliser : valeurs d’Ali conservées, source manuelle, avertissements remontés', async () => {
    const r = await decide(proposal(2700), { action: 'customize', target: { kcal: 3000, proteinG: 170, fatG: 75, carbG: 400 } });
    expect(r.record).toMatchObject({ source: 'manual', accepted: true, engineVersion: null, target: { kcal: 3000 } });
    expect(r.outcome.warnings).toContain('beyond-weekly-delta');
  });

  it('personnaliser sous 1 200 kcal sans confirmation : rien n’est écrit', async () => {
    const r = await decide(proposal(2700), { action: 'customize', target: { kcal: 1100, proteinG: 130, fatG: 50, carbG: 30 } });
    expect(r.outcome.action).toBe('confirmation-required');
    expect(r.record).toBeNull();
    expect(await rows()).toEqual([]);
  });

  it('personnaliser sous 1 200 kcal avec confirmation : enregistré, signalé', async () => {
    const r = await decide(proposal(2700), { action: 'customize', target: { kcal: 1100, proteinG: 130, fatG: 50, carbG: 30 } }, true);
    expect(r.record).toMatchObject({ source: 'manual', accepted: true, target: { kcal: 1100 } });
    expect(r.outcome.warnings).toContain('below-floor');
  });

  it('sous 800 kcal : rejeté même confirmé, rien n’est écrit', async () => {
    const r = await decide(proposal(2700), { action: 'customize', target: { kcal: 700, proteinG: 100, fatG: 30, carbG: 20 } }, true);
    expect(r.outcome.action).toBe('rejected');
    expect(r.record).toBeNull();
    expect(await rows()).toEqual([]);
  });

  it('accepter une proposition sous 1 200 kcal exige la confirmation explicite', async () => {
    const low = proposal(1150);
    const refused = await decide(low, { action: 'accept' });
    expect(refused.outcome.action).toBe('confirmation-required');
    expect(refused.record).toBeNull();
    const ok = await decide(low, { action: 'accept' }, true);
    expect(ok.record).toMatchObject({ source: 'auto', accepted: true, target: { kcal: 1150 } });
  });
});

describe('saveManualTarget : cible fixée par Ali (style manuel ou première cible)', () => {
  it('enregistre une ligne manuelle acceptée, sans version de moteur', async () => {
    const record = await saveManualTarget(db.data, { weekStart: WEEK, target: { kcal: 2500, proteinG: 160, fatG: 70, carbG: 300 }, lowFloorConfirmed: false });
    expect(record).toMatchObject({ source: 'manual', accepted: true, engineVersion: null });
  });
  it('plancher : sous 1 200 sans confirmation, refus (confirmation-required) ; sous 800, refus', async () => {
    await expect(saveManualTarget(db.data, { weekStart: WEEK, target: { kcal: 1100, proteinG: 100, fatG: 40, carbG: 50 }, lowFloorConfirmed: false })).resolves.toBe('confirmation-required');
    await expect(saveManualTarget(db.data, { weekStart: WEEK, target: { kcal: 700, proteinG: 100, fatG: 40, carbG: 50 }, lowFloorConfirmed: true })).resolves.toBe('rejected');
    expect(await rows()).toEqual([]);
  });
});
