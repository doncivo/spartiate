import { describe, expect, it } from 'vitest';
import { migrations } from '../../../../src/db/migrations';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { publishedBackfills } from './backfillGuard';

/**
 * DATA-0293 (BL-098) : la garde « colonne publiée ajoutée nulle » tournait sur base vide : un remplissage par `UPDATE` dans une migration lui échappait.
 * Garde statique complémentaire : aucune migration ne modifie, par `UPDATE`, `INSERT OR REPLACE` ou `REPLACE INTO`, une colonne publiée d'une table du catalogue
 * (le remplissage ferait diverger deux appareils qui migrent à des moments différents, sans horloge propre : D-317 (1), ADR 0018). Les réglages locaux ne sont pas publiés.
 */
const catalogue = new Map(SYNC_CATALOGUE.tables.map((t) => [t.name, new Set(publishedColumns(t))]));

describe('garde de remplissage par migration (BL-098)', () => {
  it('détecte un UPDATE d’une colonne publiée, un REPLACE, et ignore une table locale ou une colonne non publiée', () => {
    expect(publishedBackfills(['ALTER TABLE routine_day ADD COLUMN weekday INTEGER', "UPDATE routine_day SET weekday = 1 WHERE name LIKE 'Lundi%'"], catalogue)).toEqual([{ table: 'routine_day', column: 'weekday' }]);
    expect(publishedBackfills(['update  workout_set\n set done = 1, reps = 3'], catalogue)).toEqual([{ table: 'workout_set', column: 'done' }, { table: 'workout_set', column: 'reps' }]);
    expect(publishedBackfills(['INSERT OR REPLACE INTO profile (id) VALUES (1)'], catalogue)).toEqual([{ table: 'profile', column: '*' }]);
    expect(publishedBackfills(["UPDATE settings SET value = 'x'", 'UPDATE recovery_sample SET value = 1', 'UPDATE routine_day SET updated_at = 1'], catalogue)).toEqual([]);
  });

  it('aucune migration du registre ne remplit une colonne publiée', () => {
    for (const m of migrations) expect(publishedBackfills(m.statements, catalogue), `${String(m.version)} ${m.name}`).toEqual([]);
  });
});
