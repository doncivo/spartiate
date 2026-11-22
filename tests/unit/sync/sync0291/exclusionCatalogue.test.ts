import { describe, expect, it } from 'vitest';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { exclusionId, expectedExclusionId, isExclusionExerciseId, isExclusionId } from '../../../../src/domain/sync/naturalIds';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { CAPTURE_TABLES_V21 } from '../../../../src/db/migrations/0021_exclusion_injury';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { failureKinds } from '../../../../src/features/sync/failureKinds';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';

/**
 * SYNC-0291 (D-26, BL-109, D-447) : catalogue de synchro de `exercise_exclusion`, exercices écartés écrits par les DEUX appareils. Identifiant naturel
 * `exclusion|<exercice>` : le même exercice écarté des deux côtés donne UNE ligne. Périmètre : (a) ordre et identifiant ; (b) copie figée de la 0021 =
 * catalogue vivant ; (c) journal des conflits ; (d) libellés de synchro.
 */
const table = () => {
  const t = SYNC_CATALOGUE.table('exercise_exclusion');
  if (!t) throw new Error('exercise_exclusion absente du catalogue');
  return t;
};

describe('catalogue de production : exercise_exclusion (SYNC-0291)', () => {
  it('après cardio_session (rangs des tables existantes inchangés), identifiant naturel, aucun parent ni colonne locale ni règle de publication', () => {
    expect(SYNC_TABLE_ORDER.indexOf('cardio_session')).toBe(28);
    expect(SYNC_TABLE_ORDER[29]).toBe('exercise_exclusion');
    expect(SYNC_CATALOGUE.tables.map((t) => t.name)).toEqual([...SYNC_TABLE_ORDER]);
    expect(table().idKind).toBe('natural');
    expect(table().parents).toEqual([]);
    expect(table().local).toEqual([]);
    expect(table().publishWhen).toBeUndefined();
    expect(table().purgeable).toBe(true);
  });

  it('copie figée de la migration 0021 = catalogue vivant (colonnes et ordre)', () => {
    const frozen = CAPTURE_TABLES_V21.find(([name]) => name === 'exercise_exclusion');
    expect([...publishedColumns(table())]).toEqual([...(frozen?.[1] ?? [])]);
  });

  it('identifiants : exclusion|<exercice> (1 à 118 caractères, sans « | »), aucun repli UUID nu ; identifiant attendu des valeurs', () => {
    const t = table();
    expect(exclusionId('squat-barbell')).toBe('exclusion|squat-barbell');
    for (const ok of ['exclusion|squat-barbell', 'exclusion|20000000-0000-4000-8000-000000000001', `exclusion|${'a'.repeat(118)}`]) {
      expect(isExclusionId(ok), ok).toBe(true);
      expect(SYNC_CATALOGUE.isValidRowId(t, ok), ok).toBe(true);
    }
    for (const bad of ['20000000-0000-4000-8000-000000000001', 'exclusion|', 'exclusion|a|b', `exclusion|${'a'.repeat(119)}`, 'excl|squat']) {
      expect(isExclusionId(bad), bad).toBe(false);
      expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
    }
    expect(isExclusionExerciseId('squat-barbell')).toBe(true);
    expect(isExclusionExerciseId('a|b')).toBe(false);
    expect(expectedExclusionId(new Map([['exercise_id', 'squat-barbell']]))).toBe('exclusion|squat-barbell');
    expect(expectedExclusionId(new Map([['exercise_id', 'a|b']]))).toBeNull();
    expect(t.natural?.expected(new Map([['exercise_id', 'row-cable']]))).toBe('exclusion|row-cable');
  });

  it('journal des conflits : seule la suppression (remis d’un côté, écarté de l’autre) y est visible', () => {
    expect(table().columns.filter((c) => c.conflictVisible).map((c) => c.name)).toEqual(['deleted_at']);
  });

  it('libellés de synchro : report d’époque, version, champs', () => {
    expect(carryKindText('exercise_exclusion')).toBe('Exercice écarté');
    expect(failureKinds(['exercise_exclusion'])).toBe('exercices écartés');
    expect(syncFieldFr.exercise_exclusion).toEqual({ deleted_at: 'remise' });
  });
});
