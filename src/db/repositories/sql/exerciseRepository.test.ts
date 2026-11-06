import { afterEach, describe, expect, it } from 'vitest';
import type { CustomExerciseInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { RepositoryError } from '../common';
import { openBaseDb, type TestDb } from './testSetup';

const DEVICE = '60000000-0000-4000-8000-0000000000e1' as DeviceId;
const ID = '7f3a1c2e-0000-4000-8000-0000000000c1';
let db: TestDb;
afterEach(async () => db.close());

const input = (over: Partial<CustomExerciseInput> = {}): CustomExerciseInput => ({
  id: ID,
  nameFr: 'Tirage à la sangle',
  aliasesEn: ['strap row'],
  muscles: [{ id: 'lats', weight: 1 }, { id: 'biceps', weight: 0.4 }],
  equipment: ['resistance-strap'],
  pattern: 'pull-horizontal',
  kind: 'compound',
  metric: 'load-reps',
  bodyweightFraction: null,
  defaultRepRange: [8, 12],
  defaultRestSec: 90,
  instructions: { setup: 'Fixer la sangle', execution: 'Tirer', mistakes: ['Dos rond'] },
  media: null,
  strengthStandardKey: null,
  ...over,
});

describe('ExerciseRepository (exercices personnalisés, D-71)', () => {
  it('create : ligne is_custom = 1 publiée, JSON validé et relu à l’identique, colonnes de synchro posées', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    const created = await repo.create(input());
    expect(created).toMatchObject({ origin: 'custom', id: ID, nameFr: 'Tirage à la sangle', defaultRepRange: [8, 12], schemaVersion: 1, deletedAt: null, deviceId: DEVICE });
    expect(created.muscles).toEqual([{ id: 'lats', weight: 1 }, { id: 'biceps', weight: 0.4 }]);
    expect(created.instructions.mistakes).toEqual(['Dos rond']);
    expect(await repo.get(ID)).toEqual(created);
    const raw = await db.driver.select<{ is_custom: number; default_rep_min: number; muscles: string }>('SELECT is_custom, default_rep_min, muscles FROM exercise');
    expect(raw).toEqual([{ is_custom: 1, default_rep_min: 8, muscles: '[{"id":"lats","weight":1},{"id":"biceps","weight":0.4}]' }]);
    expect(await db.driver.select("SELECT field FROM sync_outbox WHERE table_name = 'exercise'")).toEqual([{ field: '*' }]);
  });

  it('collision d’identifiant refusée : même identifiant, y compris supprimé ; rien n’est écrasé', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    await repo.create(input());
    await expect(repo.create(input({ nameFr: 'Autre' }))).rejects.toMatchObject({ code: 'conflict' });
    expect((await repo.get(ID))?.nameFr).toBe('Tirage à la sangle');
    await repo.softDelete(ID);
    await expect(repo.create(input({ nameFr: 'Autre' }))).rejects.toBeInstanceOf(RepositoryError);
    expect(await repo.get(ID)).toBeNull();
    expect((await repo.get(ID, { includeDeleted: true }))?.nameFr).toBe('Tirage à la sangle');
  });

  it('identifiant non UUID refusé, y compris celui d’un exercice embarqué ; valeurs invalides refusées sans écriture', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    for (const bad of [input({ id: 'bench-press-barbell' }), input({ nameFr: ' ' }), input({ pattern: 'saut' as never }), input({ defaultRepRange: [12, 8] }), input({ muscles: [] })]) {
      await expect(repo.create(bad)).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT 1 FROM exercise')).toEqual([]);
  });

  it('update : champs fournis seulement, une entrée de file par colonne modifiée, hlc avancé', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    const created = await repo.create(input());
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const updated = await repo.update(ID, { nameFr: 'Tirage lesté', defaultRestSec: 120 });
    expect(updated).toMatchObject({ nameFr: 'Tirage lesté', defaultRestSec: 120, equipment: ['resistance-strap'] });
    expect(updated.hlc > created.hlc).toBe(true);
    expect((await db.driver.select<{ field: string }>('SELECT field FROM sync_outbox ORDER BY field')).map((r) => r.field)).toEqual(['default_rest_sec', 'name_fr']);
    await expect(repo.update(ID, { nameFr: '' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.update('7f3a1c2e-0000-4000-8000-0000000000ff', { nameFr: 'x' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('list : actifs seulement, par nom ; suppression logique puis restauration (« + »)', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    await repo.create(input({ id: '7f3a1c2e-0000-4000-8000-0000000000c2', nameFr: 'Zottman' }));
    await repo.create(input());
    expect((await repo.list()).map((e) => e.nameFr)).toEqual(['Tirage à la sangle', 'Zottman']);
    db.clock.advance(1_000);
    await repo.softDelete(ID);
    expect((await repo.list()).map((e) => e.nameFr)).toEqual(['Zottman']);
    expect((await repo.list({ includeDeleted: true })).map((e) => e.nameFr)).toEqual(['Tirage à la sangle', 'Zottman']);
    await expect(repo.softDelete(ID)).rejects.toMatchObject({ code: 'not-found' });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const restored = await repo.restore(ID);
    expect(restored.deletedAt).toBeNull();
    expect((await db.driver.select<{ field: string }>('SELECT field FROM sync_outbox ORDER BY field')).map((r) => r.field)).toEqual(['+', 'deleted_at']);
  });

  it('suppression d’un exercice personnalisé : une ligne de routine et ses données restent intactes (P-09)', async () => {
    db = await openBaseDb(DEVICE);
    const exercises = await db.data.repos.exercises();
    await exercises.create(input());
    const routines = await db.data.repos.trainingRoutines();
    await routines.create({
      id: '7f3a1c2e-0000-4000-8000-0000000000a1',
      name: 'R',
      mode: 'libre',
      days: [{ id: '7f3a1c2e-0000-4000-8000-0000000000b1', name: 'J', dayOrder: 0, exercises: [{ id: '7f3a1c2e-0000-4000-8000-0000000000d1', exerciseId: ID, exerciseName: 'Tirage à la sangle', sets: 3, repMin: 8, repMax: 12, rir: 2, restSec: 90, position: 0 }] }],
    });
    await exercises.softDelete(ID);
    const tree = await routines.get('7f3a1c2e-0000-4000-8000-0000000000a1');
    expect(tree?.days[0]?.exercises[0]).toMatchObject({ exerciseId: ID, exerciseName: 'Tirage à la sangle', deletedAt: null });
  });

  it('un JSON corrompu en base (version plus récente ou ligne reçue) ne fait pas échouer la lecture : valeur de repli, ligne conservée', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    await repo.create(input());
    await db.driver.execute("UPDATE exercise SET muscles = 'pas du json', instructions = '{\"x\":1}' WHERE id = ?", [ID]);
    const row = await repo.get(ID);
    expect(row).toMatchObject({ id: ID, nameFr: 'Tirage à la sangle', muscles: [], instructions: { setup: '', execution: '', mistakes: [] } });
  });
});
