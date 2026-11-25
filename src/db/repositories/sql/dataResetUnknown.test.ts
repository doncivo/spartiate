import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId, Hlc } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * DATA-0293 (BL-041, vérification) : la remise à zéro retire les champs gardés pour un schéma plus récent (`sync_unknown`) dont le hlc est antérieur
 * ou égal à l'horizon ; ceux d'après l'horizon restent (réintégrables). Preuve de la filtration par horizon côté conservation déjà posée
 * (`tests/unit/sync/versions/fixA009bQa.test.ts`) ; ici, côté effacement. Valeurs synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-000000000041' as DeviceId;
const hlc = (n: number): Hlc => `${String(1_791_187_200_000 + n).padStart(15, '0')}-0000-${DEVICE}` as Hlc;
let db: TestDb;
afterEach(async () => db.close());

describe('remise à zéro : champs gardés et horizon (BL-041)', () => {
  it('wipe(horizon) retire les champs gardés d’avant l’horizon, garde ceux d’après', async () => {
    db = await openBaseDb(DEVICE);
    const insert = (row: string, at: Hlc) =>
      db.driver.execute("INSERT INTO sync_unknown (table_name, row_id, field, value, hlc, base_hlc, sv) VALUES ('workout_set', ?, 'added', '1', ?, NULL, 99)", [row, at]);
    await insert('7a1b0c2d-0000-4000-8000-000000000001', hlc(5));
    await insert('7a1b0c2d-0000-4000-8000-000000000002', hlc(10));
    await insert('7a1b0c2d-0000-4000-8000-000000000003', hlc(11));
    await (await db.data.repos.dataReset()).wipe(hlc(10));
    expect((await db.driver.select<{ row_id: string }>('SELECT row_id FROM sync_unknown ORDER BY row_id')).map((r) => r.row_id.slice(-1))).toEqual(['3']);
  });
});
