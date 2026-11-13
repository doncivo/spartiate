import { describe, expect, it } from 'vitest';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { CAPTURE_TABLES_V12 } from '../../../../src/db/migrations/0012_body_progress';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';

/**
 * I6-02 (D-26 ; § 9, § 17.1, § 20.2) : catalogue de synchro de `measurement` (`measurement|AAAA-MM-JJ|kind`) et `progress_photo` (UUID, MÉTADONNÉES
 * SEULEMENT : aucune colonne ne porte le fichier ni de contenu d'image). Périmètre : (a) ordre et identifiants ; (b) copie figée de la 0012 = catalogue
 * vivant ; (c) types ; (d) valeurs masquées du journal des conflits ; (e) libellés ; (f) la table locale des fichiers n'est jamais au catalogue.
 */
const table = (name: string) => {
  const t = SYNC_CATALOGUE.table(name);
  if (!t) throw new Error(`${name} absente du catalogue`);
  return t;
};
const col = (tableName: string, name: string) => {
  const c = SYNC_CATALOGUE.column(tableName, name);
  if (!c) throw new Error(`${tableName}.${name}`);
  return c;
};

describe('catalogue de production : measurement et progress_photo (I6-02)', () => {
  it('juste avant food_favorite (FIX-0181) et data_reset (RESET-01, 26 tables), sans parent ni colonne locale', () => {
    expect(SYNC_TABLE_ORDER.slice(-7, -5)).toEqual(['measurement', 'progress_photo']);
    expect(SYNC_TABLE_ORDER).toHaveLength(29); // I6-06 : cardio_session en dernier. // I6-05 : supplement et supplement_intake après data_reset.
    expect(table('measurement').idKind).toBe('natural');
    expect(table('progress_photo').idKind).toBe('uuid');
    for (const name of ['measurement', 'progress_photo']) {
      expect(table(name).parents).toEqual([]);
      expect(table(name).local).toEqual([]);
      expect(table(name).publishWhen).toBeUndefined();
    }
  });

  it('copie figée de la migration 0012 = catalogue vivant (colonnes et ordre)', () => {
    for (const [name, columns] of CAPTURE_TABLES_V12) expect([...publishedColumns(table(name))], name).toEqual([...columns]);
  });

  it('progress_photo : métadonnées seulement (date, nom de fichier, création, suppression), le fichier n’est jamais publié', () => {
    expect([...publishedColumns(table('progress_photo'))]).toEqual(['date', 'file_name', 'created_at', 'deleted_at']);
    expect(SYNC_CATALOGUE.table('progress_photo_file')).toBeUndefined();
  });

  it('identifiants de measurement : forme naturelle seulement ; identifiant attendu des valeurs', () => {
    const t = table('measurement');
    expect(SYNC_CATALOGUE.isValidRowId(t, 'measurement|2026-11-09|waist')).toBe(true);
    for (const bad of ['measurement|2026-13-09|waist', 'measurement|2026-11-09|', '7d3c2e4f-0000-4000-8000-000000000001', 'day|2026-11-09']) expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
    expect(t.natural?.expected(new Map([['date', '2026-11-09'], ['kind', 'waist']]))).toBe('measurement|2026-11-09|waist');
    expect(SYNC_CATALOGUE.isValidRowId(table('progress_photo'), '7d3c2e4f-0000-4000-8000-000000000001')).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(table('progress_photo'), 'measurement|2026-11-09|waist')).toBe(false);
  });

  it('types', () => {
    const ok = (t: string, name: string, v: unknown) => SYNC_CATALOGUE.isValidValue(col(t, name), v);
    expect(ok('measurement', 'value', 82.5)).toBe(true);
    expect(ok('measurement', 'value', null)).toBe(false);
    expect(ok('measurement', 'value', Number.NaN)).toBe(false);
    expect(ok('measurement', 'kind', 'waist')).toBe(true);
    expect(ok('measurement', 'kind', null)).toBe(false);
    expect(ok('measurement', 'date', '2026-11-31')).toBe(false);
    expect(ok('progress_photo', 'file_name', 'a.jpg')).toBe(true);
    expect(ok('progress_photo', 'file_name', null)).toBe(false);
    expect(ok('progress_photo', 'date', '2026-11-09')).toBe(true);
  });

  it('données corporelles : seule la suppression est visible au journal des conflits', () => {
    for (const name of ['measurement', 'progress_photo']) expect(table(name).columns.filter((c) => c.conflictVisible).map((c) => c.name), name).toEqual(['deleted_at']);
  });

  it('libellés de synchro : report d’époque, champs', () => {
    expect(carryKindText('measurement')).toBe('Mensuration');
    expect(carryKindText('progress_photo')).toBe('Photo de progression (fiche seulement)');
    expect(syncFieldFr.measurement).toEqual({ deleted_at: 'suppression' });
    expect(syncFieldFr.progress_photo).toEqual({ deleted_at: 'suppression' });
  });
});
