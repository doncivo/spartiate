import { afterEach, describe, expect, it } from 'vitest';
import type { CustomExerciseInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { GYM_PROFILE } from '../../../../tests/fixtures/training';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * DATA-0293 (BL-037) : la lecture tolérante rend une liste vide pour un JSON illisible (ligne d'une autre version) ; une modification sans rapport
 * ne doit jamais réécrire cette valeur en vide. Le dépôt garde la valeur d'origine en REFUSANT l'écriture (`'invalid'`), comme pour une saisie hors règles ;
 * une modification qui remplace elle-même la colonne illisible reste permise. Données synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-000000000037' as DeviceId;
const ID = '7f3a1c2e-0000-4000-8000-000000000037';
let db: TestDb;
afterEach(async () => db.close());

const input = (over: Partial<CustomExerciseInput> = {}): CustomExerciseInput => ({
  id: ID,
  nameFr: 'Tirage à la sangle',
  aliasesEn: ['strap row'],
  muscles: [{ id: 'lats', weight: 1 }],
  equipment: ['resistance-strap'],
  pattern: 'pull-horizontal',
  kind: 'compound',
  metric: 'load-reps',
  bodyweightFraction: null,
  defaultRepRange: [8, 12],
  defaultRestSec: 90,
  instructions: { setup: 'Fixer', execution: 'Tirer', mistakes: [] },
  media: null,
  strengthStandardKey: null,
  ...over,
});

describe('BL-037 : exercice dont un JSON est illisible', () => {
  it.each(['equipment', 'aliases_en'])('renommer ne réécrit pas « %s » illisible en liste vide : écriture refusée, valeur d’origine intacte', async (column) => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    await repo.create(input());
    await db.driver.execute(`UPDATE exercise SET ${column} = '{"v2":true}' WHERE id = ?`, [ID]);
    await expect(repo.update(ID, { nameFr: 'Autre nom' })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select(`SELECT name_fr, ${column} AS v FROM exercise`)).toEqual([{ name_fr: 'Tirage à la sangle', v: '{"v2":true}' }]);
  });

  it('une modification qui remplace elle-même la colonne illisible est permise ; sans JSON illisible, comportement inchangé', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.exercises();
    await repo.create(input());
    await expect(repo.update(ID, { nameFr: 'Nom sain' })).resolves.toMatchObject({ nameFr: 'Nom sain' });
    await db.driver.execute(`UPDATE exercise SET equipment = '{"v2":true}' WHERE id = ?`, [ID]);
    await expect(repo.update(ID, { equipment: ['dumbbell'] })).resolves.toMatchObject({ equipment: ['dumbbell'] });
  });
});

describe('BL-037 : profil de matériel dont un JSON est illisible', () => {
  it('renommer ne réécrit pas l’inventaire illisible en inventaire vide', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create({ id: ID, name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await db.driver.execute(`UPDATE equipment_profile SET inventory = '{"v2":true}' WHERE id = ?`, [ID]);
    await expect(repo.update(ID, { name: 'Salle 2' })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT name, inventory FROM equipment_profile')).toEqual([{ name: 'Salle', inventory: '{"v2":true}' }]);
  });
});
