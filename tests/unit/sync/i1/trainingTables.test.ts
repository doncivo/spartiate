import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { GYM_PROFILE } from '../../../fixtures/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/** I1-01 : les cinq tables d'entraînement dans le catalogue de production (D-26, D-71, P-09) et leur synchro entre deux appareils. */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const u = (n: number): string => `5c3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CUSTOM = u(1);

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

describe('catalogue de production étendu', () => {
  it('ordre topologique : profile, body_weight, exercise, equipment_profile, routine, routine_day, routine_exercise, puis workout, workout_set (I1-03), puis progression_profile, recommendation_decision (I2-01), puis mesocycle (I3-02), puis food, food_portion, meal_entry, nutrition_target (I4-02), puis day_completeness, recipe, recipe_ingredient (I4-07), puis recovery_day, muscle_recovery (I5-01)', () => {
    const expected = ['profile', 'body_weight', 'exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise', 'workout', 'workout_set', 'progression_profile', 'recommendation_decision', 'mesocycle', 'food', 'food_portion', 'meal_entry', 'nutrition_target', 'day_completeness', 'recipe', 'recipe_ingredient', 'recovery_day', 'muscle_recovery'];
    expect([...SYNC_TABLE_ORDER]).toEqual(expected);
    expect(SYNC_CATALOGUE.tables.map((t) => t.name)).toEqual(expected);
    expect(SYNC_CATALOGUE.table('settings')).toBeUndefined();
  });

  it('identifiants : UUID pour les cinq tables ; l’identifiant d’un exercice embarqué n’est jamais une ligne publiable', () => {
    for (const name of ['exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise']) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(name);
      expect(t.idKind).toBe('uuid');
      expect(t.purgeable).toBe(true);
      expect(SYNC_CATALOGUE.isValidRowId(t, CUSTOM)).toBe(true);
      expect(SYNC_CATALOGUE.isValidRowId(t, 'bench-press-barbell')).toBe(false);
    }
  });

  it('parents : routine_day → routine, routine_exercise → routine_day ; exercise_id est une référence logique, pas un parent', () => {
    expect(SYNC_CATALOGUE.table('routine_day')?.parents).toEqual([{ column: 'routine_id', table: 'routine' }]);
    expect(SYNC_CATALOGUE.table('routine_exercise')?.parents).toEqual([{ column: 'routine_day_id', table: 'routine_day' }]);
    expect(SYNC_CATALOGUE.table('exercise')?.parents).toEqual([]);
    expect(SYNC_CATALOGUE.childRelations('exercise')).toEqual([]);
    expect(SYNC_CATALOGUE.childRelations('routine').map((r) => `${r.table.name}.${r.column}`)).toEqual(['routine_day.routine_id']);
    expect(SYNC_CATALOGUE.column('routine_exercise', 'exercise_id')?.type).toBe('text');
    expect(SYNC_CATALOGUE.rank('routine_exercise')).toBeGreaterThan(SYNC_CATALOGUE.rank('routine_day'));
  });

  it('colonnes publiées et locales : is_custom est locale ; exercise_name est publiée (nom figé)', () => {
    expect(SYNC_CATALOGUE.column('exercise', 'is_custom')).toBeUndefined();
    expect(SYNC_CATALOGUE.table('exercise')?.local).toEqual(['is_custom']);
    expect(SYNC_CATALOGUE.column('exercise', 'name_fr')?.nullable).toBe(false);
    expect(SYNC_CATALOGUE.column('exercise', 'muscles')?.type).toBe('json');
    expect(SYNC_CATALOGUE.column('exercise', 'pattern')?.type).toBe('enum');
    expect(SYNC_CATALOGUE.column('routine_exercise', 'exercise_name')?.nullable).toBe(false);
    expect(SYNC_CATALOGUE.column('routine_exercise', 'rir')?.nullable).toBe(true);
    expect(SYNC_CATALOGUE.column('routine', 'mode')?.type).toBe('enum');
    expect(SYNC_CATALOGUE.column('equipment_profile', 'inventory')?.type).toBe('json');
    expect(SYNC_CATALOGUE.column('equipment_profile', 'hlc')).toBeUndefined();
  });
});

async function twoDevices(): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return [a, b];
}

async function roundTrip(): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of devices) await d.cycle();
    syncFolders(devices);
  }
}

const customInput = (id: string) => ({
  id,
  nameFr: 'Tirage à la sangle',
  aliasesEn: [],
  muscles: [{ id: 'lats', weight: 1 }],
  equipment: ['resistance-strap'],
  pattern: 'pull-horizontal' as const,
  kind: 'compound' as const,
  metric: 'load-reps' as const,
  bodyweightFraction: null,
  defaultRepRange: [8, 12] as [number, number],
  defaultRestSec: 90,
  instructions: { setup: '', execution: '', mistakes: [] },
  media: null,
  strengthStandardKey: null,
});

const line = (id: string, exerciseId: string, position: number) => ({ id, exerciseId, exerciseName: `Nom de ${exerciseId}`, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position });

describe('synchro entre deux appareils', () => {
  it('une routine, ses jours et ses lignes arrivent dans l’ordre des parents ; la référence embarquée reste sans ligne exercise', async () => {
    const [a, b] = await twoDevices();
    await a.data.transaction(async (repos) =>
      (await repos.trainingRoutines()).create({ id: u(10), name: 'Haut / Bas', mode: 'programme', days: [{ id: u(11), name: 'Haut A', dayOrder: 0, exercises: [line(u(12), 'bench-press-barbell', 0)] }] }),
    );
    await roundTrip();
    const tree = await (await b.data.repos.trainingRoutines()).get(u(10));
    expect(tree?.days[0]?.exercises[0]).toMatchObject({ exerciseId: 'bench-press-barbell', exerciseName: 'Nom de bench-press-barbell' });
    expect(await b.driver.select('SELECT 1 FROM exercise')).toEqual([]);
    expect(await b.driver.select('SELECT * FROM sync_parked')).toEqual([]);
  });

  it('référence reçue avant son exercice personnalisé : la ligne est importée telle quelle, puis se résout quand l’exercice arrive', async () => {
    const [a, b] = await twoDevices();
    await a.data.transaction(async (repos) =>
      (await repos.trainingRoutines()).create({ id: u(20), name: 'R', mode: 'libre', days: [{ id: u(21), name: 'J', dayOrder: 0, exercises: [line(u(22), CUSTOM, 0)] }] }),
    );
    await roundTrip();
    expect((await (await b.data.repos.trainingRoutines()).get(u(20)))?.days[0]?.exercises[0]?.exerciseId).toBe(CUSTOM);
    expect(await (await b.data.repos.exercises()).get(CUSTOM)).toBeNull();
    expect(await b.driver.select("SELECT 1 FROM sync_parked WHERE reason = 'missing-parent'")).toEqual([]);
    a.clock.advance(1_000);
    b.clock.advance(1_000);
    await (await a.data.repos.exercises()).create(customInput(CUSTOM));
    await roundTrip();
    expect((await (await b.data.repos.exercises()).get(CUSTOM))?.nameFr).toBe('Tirage à la sangle');
    expect((await (await b.data.repos.trainingRoutines()).get(u(20)))?.days[0]?.exercises[0]?.exerciseId).toBe(CUSTOM);
  });

  it('suppression d’un exercice personnalisé : la suppression circule, la ligne de routine garde son identifiant et son nom figé', async () => {
    const [a, b] = await twoDevices();
    await (await a.data.repos.exercises()).create(customInput(CUSTOM));
    await (await a.data.repos.trainingRoutines()).create({ id: u(30), name: 'R', mode: 'libre', days: [{ id: u(31), name: 'J', dayOrder: 0, exercises: [line(u(32), CUSTOM, 0)] }] });
    await roundTrip();
    a.clock.advance(1_000);
    b.clock.advance(1_000);
    await (await a.data.repos.exercises()).softDelete(CUSTOM);
    await roundTrip();
    for (const d of [a, b]) {
      expect(await (await d.data.repos.exercises()).get(CUSTOM)).toBeNull();
      expect((await (await d.data.repos.exercises()).get(CUSTOM, { includeDeleted: true }))?.deletedAt).not.toBeNull();
      expect((await (await d.data.repos.trainingRoutines()).get(u(30)))?.days[0]?.exercises[0]).toMatchObject({ exerciseId: CUSTOM, exerciseName: `Nom de ${CUSTOM}` });
    }
  });

  it('profil de matériel publié ; profil actif local : jamais dans la file ni sur l’autre appareil', async () => {
    const [a, b] = await twoDevices();
    const repo = await a.data.repos.equipmentProfiles();
    await repo.create({ id: u(40), name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: { barbell: 2.5 } });
    await repo.setActive(u(40));
    await roundTrip();
    expect((await (await b.data.repos.equipmentProfiles()).get(u(40)))?.increments).toEqual({ barbell: 2.5 });
    expect(await (await b.data.repos.equipmentProfiles()).getActiveId()).toBeNull();
    expect(await a.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'settings'")).toEqual([]);
  });

  it('conflit par champ sur une ligne de routine : séries modifiées sur A, repos sur B, les deux survivent', async () => {
    const [a, b] = await twoDevices();
    await (await a.data.repos.trainingRoutines()).create({ id: u(50), name: 'R', mode: 'libre', days: [{ id: u(51), name: 'J', dayOrder: 0, exercises: [line(u(52), 'plank', 0)] }] });
    await roundTrip();
    a.clock.advance(1_000);
    b.clock.advance(1_000);
    await (await a.data.repos.trainingRoutines()).updateExercise(u(52), { sets: 5 });
    await (await b.data.repos.trainingRoutines()).updateExercise(u(52), { restSec: 60 });
    await roundTrip();
    for (const d of [a, b]) expect((await (await d.data.repos.trainingRoutines()).get(u(50)))?.days[0]?.exercises[0]).toMatchObject({ sets: 5, restSec: 60 });
  });
});
