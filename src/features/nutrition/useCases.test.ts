import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effectiveTarget, type Proposal } from '../../domain/nutrition';
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

describe('I4-03 : loadNutritionSnapshot', () => {
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

describe('I4-03 : entryFromFood et quickAddDraft', () => {
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

describe('I4-03 : recordCheckInDecision : le moteur propose, Ali décide', () => {
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

describe('I4-03 : saveManualTarget : cible fixée par Ali (style manuel ou première cible)', () => {
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

describe('I4-07 : loadNutritionSnapshot et journée déclarée (D-81)', () => {
  const YESTERDAY = '2026-11-08' as LocalDate;
  const seedTwoMeals = async (): Promise<void> => {
    const repo = await db.data.repos.mealEntries();
    await repo.create(quickAddDraft({ date: YESTERDAY, time: t('13:00'), name: '', kcal: 900, proteinG: 40, fatG: 30, carbG: 100 }));
    await repo.create(quickAddDraft({ date: YESTERDAY, time: t('20:30'), name: '', kcal: 1000, proteinG: 50, fatG: 30, carbG: 110 }));
  };

  it('sans déclaration : deux prises en 7 h 30 restent une journée partielle déduite', async () => {
    await seedTwoMeals();
    const day = (await loadNutritionSnapshot(db.data, TODAY)).days.find((d) => d.date === YESTERDAY);
    expect(day).toMatchObject({ state: 'partial', origin: 'inferred', usableForTdee: false });
  });

  it('déclarée complète : la journée est complète (origine déclarée) et utilisable pour la dépense', async () => {
    await seedTwoMeals();
    await (await db.data.repos.dayCompleteness()).declare(YESTERDAY, 'complete');
    const day = (await loadNutritionSnapshot(db.data, TODAY)).days.find((d) => d.date === YESTERDAY);
    expect(day).toMatchObject({ state: 'complete', origin: 'declared', usableForTdee: true, kcal: 1900 });
  });

  it('déclarée incomplète : une journée de trois prises sur 12 h devient partielle', async () => {
    const repo = await db.data.repos.mealEntries();
    for (const time of ['07:00', '13:00', '19:00']) await repo.create(quickAddDraft({ date: YESTERDAY, time: t(time), name: '', kcal: 700, proteinG: 30, fatG: 20, carbG: 80 }));
    await (await db.data.repos.dayCompleteness()).declare(YESTERDAY, 'incomplete');
    const day = (await loadNutritionSnapshot(db.data, TODAY)).days.find((d) => d.date === YESTERDAY);
    expect(day).toMatchObject({ state: 'partial', origin: 'declared', usableForTdee: false });
  });

  it('déclarée complète sans aucune entrée : reste inconnue, jamais zéro', async () => {
    await (await db.data.repos.dayCompleteness()).declare(YESTERDAY, 'complete');
    const day = (await loadNutritionSnapshot(db.data, TODAY)).days.find((d) => d.date === YESTERDAY);
    expect(day).toMatchObject({ state: 'unknown', kcal: null, usableForTdee: false });
    expect(day?.reasons).toContain('declared-without-entries');
  });
});

describe('I4-08 point 8 : cible en vigueur (HLC), cohérente entre Journal, Aujourd’hui et Dashboard', () => {
  const MON = '2026-11-09' as LocalDate;
  const TUE = '2026-11-10' as LocalDate;
  const WED = '2026-11-11' as LocalDate;

  it('cible fixée le mardi, check-in du lundi accepté le mercredi : l’acceptation s’applique dès sa semaine, partout pareil', async () => {
    db.clock.advance(24 * 3_600_000);
    const manual = await saveManualTarget(db.data, { weekStart: TUE, target: { kcal: 2500, proteinG: 150, fatG: 70, carbG: 300 }, lowFloorConfirmed: false });
    expect(typeof manual).toBe('object');
    db.clock.advance(24 * 3_600_000);
    const p = proposal(2300);
    await recordCheckInDecision(db.data, { proposal: p, weekStart: MON, weightKg: 81, currentTarget: p.previousTarget, decision: { action: 'accept' }, lowFloorConfirmed: false });
    const repo = await db.data.repos.nutritionTargets();
    for (const day of [MON, TUE, WED]) {
      const snapshot = await loadNutritionSnapshot(db.data, day);
      expect(snapshot.target?.target.kcal).toBe(2300);
      expect(effectiveTarget(snapshot.targets, day)?.id).toBe(snapshot.target?.id);
      expect((await repo.effective(day))?.id).toBe(snapshot.target?.id);
    }
  });

  it('deux appareils : created_at trompeur (horloge en avance), HLC juste : la décision la plus récente gagne', async () => {
    const hlc = (ms: number, dev: string) => `${String(ms).padStart(15, '0')}-0000-${dev}`;
    const A = '60000000-0000-4000-8000-0000000000a1';
    const B = '60000000-0000-4000-8000-0000000000b2';
    const insert = (id: string, kcal: number, createdAt: string, h: string, dev: string) =>
      db.driver.execute(
        `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, created_at, updated_at, device_id, hlc) VALUES (?, '2026-11-09', ?, 150, 70, 300, 'manual', 1, NULL, ?, ?, ?, ?)`,
        [id, kcal, createdAt, createdAt, dev, h],
      );
    await insert('7f3c2b1a-0000-4000-8000-0000000000c1', 2600, '2026-12-31T08:00:00.000Z', hlc(Date.parse('2026-11-10T08:00:00.000Z'), B), B);
    await insert('7f3c2b1a-0000-4000-8000-0000000000c2', 2200, '2026-11-01T08:00:00.000Z', hlc(Date.parse('2026-11-11T08:00:00.000Z'), A), A);
    const snapshot = await loadNutritionSnapshot(db.data, WED);
    expect(snapshot.target?.target.kcal).toBe(2200);
    expect(effectiveTarget(snapshot.targets, WED)?.target.kcal).toBe(2200);
  });

  it('cible dont la semaine n’a pas commencé : jamais retenue', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-16' as LocalDate, target: { kcal: 2900, proteinG: 150, fatG: 70, carbG: 300 }, lowFloorConfirmed: false });
    expect((await loadNutritionSnapshot(db.data, WED)).target).toBeNull();
  });
});
