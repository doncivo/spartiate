import { describe, expect, it } from 'vitest';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { CAPTURE_TABLES_V11 } from '../../../../src/db/migrations/0011_recovery_factor';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';

/**
 * I6-01 (D-26 ; § 16.7, § 20.2) : catalogue de synchro de `recovery_factor` (`recovery_factor|AAAA-MM-JJ`), écrite par les DEUX appareils (le journal
 * se coche sur l'iPhone ou sur le PC). Périmètre : (a) ordre et identifiant naturel ; (b) copie figée de la 0011 = catalogue vivant ; (c) types ;
 * (d) valeurs masquées du journal des conflits ; (e) libellés de synchro.
 */
const table = () => {
  const t = SYNC_CATALOGUE.table('recovery_factor');
  if (!t) throw new Error('recovery_factor absente du catalogue');
  return t;
};
const col = (name: string) => {
  const c = SYNC_CATALOGUE.column('recovery_factor', name);
  if (!c) throw new Error(name);
  return c;
};

describe('catalogue de production : recovery_factor (I6-01)', () => {
  it('22e de l’ordre (suivie des tables de I6-02), identifiant naturel, aucun parent ni colonne locale', () => {
    expect(SYNC_TABLE_ORDER[21]).toBe('recovery_factor');
    expect(SYNC_TABLE_ORDER.length).toBeGreaterThanOrEqual(22);
    expect(table().idKind).toBe('natural');
    expect(table().parents).toEqual([]);
    expect(table().local).toEqual([]);
    expect(table().publishWhen).toBeUndefined();
  });

  it('copie figée de la migration 0011 = catalogue vivant (colonnes et ordre)', () => {
    expect(CAPTURE_TABLES_V11.map(([name]) => name)).toEqual(['recovery_factor']);
    expect([...publishedColumns(table())]).toEqual([...CAPTURE_TABLES_V11[0][1]]);
  });

  it('identifiants : forme naturelle seulement, aucun repli UUID ; identifiant attendu des valeurs', () => {
    const t = table();
    expect(SYNC_CATALOGUE.isValidRowId(t, 'recovery_factor|2026-11-09')).toBe(true);
    for (const bad of ['recovery_factor|2026-13-09', 'recovery|2026-11-09', 'day|2026-11-09', '7d3c2e4f-0000-4000-8000-000000000001', 'recovery_factor|2026-11-9']) expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
    expect(t.natural?.expected(new Map([['date', '2026-11-09']]))).toBe('recovery_factor|2026-11-09');
  });

  it('types : date locale, tableau JSON, booléen 0/1', () => {
    const ok = (name: string, v: unknown) => SYNC_CATALOGUE.isValidValue(col(name), v);
    expect(ok('date', '2026-11-09')).toBe(true);
    expect(ok('date', '2026-11-31')).toBe(false);
    expect(ok('date', null)).toBe(false);
    expect(ok('factors', '["alcohol"]')).toBe(true);
    expect(ok('factors', '[]')).toBe(true);
    expect(ok('factors', null)).toBe(false);
    expect(ok('none', 0)).toBe(true);
    expect(ok('none', 1)).toBe(true);
    expect(ok('none', 2)).toBe(false);
    expect(ok('none', null)).toBe(false);
  });

  it('habitudes de vie : seule la suppression est visible au journal des conflits (aucune valeur n’y entre)', () => {
    expect(table().columns.filter((c) => c.conflictVisible).map((c) => c.name)).toEqual(['deleted_at']);
  });

  it('libellés de synchro : report d’époque, version, champs', () => {
    expect(carryKindText('recovery_factor')).toBe('Journal de facteurs du jour');
    expect(syncFieldFr.recovery_factor).toEqual({ deleted_at: 'suppression' });
  });
});
