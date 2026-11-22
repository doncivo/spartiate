import { describe, expect, it } from 'vitest';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { CAPTURE_TABLES_V21 } from '../../../../src/db/migrations/0021_exclusion_injury';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { failureKinds } from '../../../../src/features/sync/failureKinds';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';

/**
 * SYNC-0291 (D-26, BL-120, D-447, D-464) : catalogue de synchro de `injury`, gênes déclarées écrites par les DEUX appareils, identifiant UUID. Donnée de
 * santé : aucune colonne visible au journal des conflits (D-402 : jamais journalisée). Périmètre : ordre, copie figée = catalogue, types, libellés.
 */
const table = () => {
  const t = SYNC_CATALOGUE.table('injury');
  if (!t) throw new Error('injury absente du catalogue');
  return t;
};
const col = (name: string) => {
  const c = SYNC_CATALOGUE.column('injury', name);
  if (!c) throw new Error(name);
  return c;
};

describe('catalogue de production : injury (SYNC-0291)', () => {
  it('dernière de l’ordre, après exercise_exclusion ; UUID ; aucun parent ni colonne locale ni règle de publication', () => {
    expect(SYNC_TABLE_ORDER.slice(-2)).toEqual(['exercise_exclusion', 'injury']);
    expect(SYNC_CATALOGUE.tables.map((t) => t.name)).toEqual([...SYNC_TABLE_ORDER]);
    expect(table().idKind).toBe('uuid');
    expect(table().parents).toEqual([]);
    expect(table().local).toEqual([]);
    expect(table().publishWhen).toBeUndefined();
    expect(SYNC_CATALOGUE.isValidRowId(table(), '20000000-0000-4000-8000-000000000001')).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(table(), 'g1')).toBe(false);
  });

  it('copie figée de la migration 0021 = catalogue vivant (colonnes et ordre)', () => {
    expect(CAPTURE_TABLES_V21.map(([name]) => name)).toEqual(['exercise_exclusion', 'injury']);
    const frozen = CAPTURE_TABLES_V21.find(([name]) => name === 'injury');
    expect([...publishedColumns(table())]).toEqual([...(frozen?.[1] ?? [])]);
  });

  it('types : statut fermé, dates locales, note de 140 caractères au plus, motifs et réponses en JSON', () => {
    const ok = (name: string, v: unknown) => SYNC_CATALOGUE.isValidValue(col(name), v);
    expect(ok('status', 'active')).toBe(true);
    expect(ok('status', 'healed')).toBe(true);
    expect(ok('status', 'autre')).toBe(false);
    expect(ok('started_on', '2026-11-01')).toBe(true);
    expect(ok('started_on', null)).toBe(false);
    expect(ok('healed_on', null)).toBe(true);
    expect(ok('note', 'x'.repeat(140))).toBe(true);
    expect(ok('note', 'x'.repeat(141))).toBe(false);
    expect(ok('muscle_id', null)).toBe(true);
    expect(ok('patterns', '["squat"]')).toBe(true);
    expect(ok('patterns', 'pas du json')).toBe(false);
    expect(ok('checkins', '[{"on":"2026-11-15","answer":"same"}]')).toBe(true);
  });

  it('journal des conflits : aucune colonne visible, suppression comprise (donnée de santé)', () => {
    expect(table().columns.filter((c) => c.conflictVisible).map((c) => c.name)).toEqual([]);
  });

  it('libellés de synchro : report d’époque, version ; aucun libellé de champ', () => {
    expect(carryKindText('injury')).toBe('Gêne déclarée');
    expect(failureKinds(['injury'])).toBe('gênes déclarées');
    expect((syncFieldFr as Record<string, unknown>)['injury']).toBeUndefined();
  });
});
