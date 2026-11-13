import { describe, expect, it } from 'vitest';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { CAPTURE_TABLES_V18 } from '../../../../src/db/migrations/0018_cardio';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { failureKinds } from '../../../../src/features/sync/syncText';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';

/**
 * I6-06 (D-26, D-221) : catalogue de synchro de `cardio_session`, séances cardio saisies écrites par les DEUX appareils, identifiant UUID. Le tracé
 * (`cardio_track`) n'est PAS au catalogue : il reste sur l'appareil. Périmètre : (a) ordre ; (b) copie figée de la 0017 = catalogue vivant ; (c) types et
 * bornes ; (d) journal des conflits (la FC moyenne, donnée corporelle, y est masquée) ; (e) libellés de synchro.
 */
const table = () => {
  const t = SYNC_CATALOGUE.table('cardio_session');
  if (!t) throw new Error('cardio_session absente du catalogue');
  return t;
};
const col = (name: string) => {
  const c = SYNC_CATALOGUE.column('cardio_session', name);
  if (!c) throw new Error(name);
  return c;
};

describe('catalogue de production : cardio_session (I6-06)', () => {
  it('après data_reset, identifiant UUID, aucun parent ni colonne locale ni règle de publication ; le tracé jamais au catalogue', () => {
    expect(SYNC_TABLE_ORDER.indexOf('cardio_session')).toBeGreaterThan(SYNC_TABLE_ORDER.indexOf('data_reset'));
    expect(SYNC_CATALOGUE.tables.map((t) => t.name)).toEqual([...SYNC_TABLE_ORDER]);
    expect(table().idKind).toBe('uuid');
    expect(table().parents).toEqual([]);
    expect(table().local).toEqual([]);
    expect(table().publishWhen).toBeUndefined();
    expect(SYNC_CATALOGUE.table('cardio_track')).toBeUndefined();
  });

  it('copie figée de la migration 0018 = catalogue vivant (colonnes et ordre)', () => {
    expect(CAPTURE_TABLES_V18.map(([name]) => name)).toEqual(['cardio_session']);
    expect([...publishedColumns(table())]).toEqual([...CAPTURE_TABLES_V18[0][1]]);
  });

  it('types : type en texte court, durée et ressenti entiers, distance et FC facultatives, source fermée', () => {
    const ok = (name: string, v: unknown) => SYNC_CATALOGUE.isValidValue(col(name), v);
    expect(ok('kind', 'skierg')).toBe(true);
    expect(ok('kind', 'x'.repeat(33))).toBe(false);
    expect(ok('started_at', '2026-11-13T17:00:00.000Z')).toBe(true);
    expect(ok('started_at', '2026-11-13')).toBe(false);
    expect(ok('duration_sec', 2700)).toBe(true);
    expect(ok('duration_sec', 12.5)).toBe(false);
    expect(ok('distance_m', null)).toBe(true);
    expect(ok('distance_m', 7500.5)).toBe(true);
    expect(ok('avg_hr', null)).toBe(true);
    expect(ok('rpe', 7)).toBe(true);
    expect(ok('rpe', null)).toBe(false);
    expect(ok('source', 'gps')).toBe(true);
    expect(ok('source', 'watch')).toBe(false);
    expect(ok('notes', '')).toBe(true);
    expect(ok('notes', 'x'.repeat(2001))).toBe(false);
  });

  it('journal des conflits : la FC moyenne masquée, le reste visible', () => {
    expect(table().columns.filter((c) => !c.conflictVisible).map((c) => c.name)).toEqual(['avg_hr', 'created_at']);
  });

  it('libellés de synchro : report d’époque, version, champs', () => {
    expect(carryKindText('cardio_session')).toBe('Séance cardio');
    expect(failureKinds(['cardio_session'])).toBe('séances cardio');
    expect(Object.keys(syncFieldFr.cardio_session).sort()).toEqual(['deleted_at', 'distance_m', 'duration_sec', 'kind', 'notes', 'rpe', 'source', 'started_at']);
  });
});
