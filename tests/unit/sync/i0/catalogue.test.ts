import { describe, expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../../../../src/db/drivers/sqliteWasm';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE, createCatalogue } from '../../../../src/domain/sync/syncTables';
import { LEGACY_SYNC_CATALOGUE } from '../../../fixtures/legacy-schema/catalogue';

/** Catalogue I0 injecté (D-55, D-65, D-67) : deux tables, aucun réglage publié, identités naturelles sans repli UUID. */

const UUID = '11111111-1111-4111-8111-111111111111';

describe('catalogue I0 en production', () => {
  it('SYNC_TABLE_ORDER = profile, body_weight ; settings n’est pas publié', () => {
    expect([...SYNC_TABLE_ORDER]).toEqual(['profile', 'body_weight']);
    expect(SYNC_CATALOGUE.tables.map((t) => t.name)).toEqual(['profile', 'body_weight']);
    expect(SYNC_CATALOGUE.table('settings')).toBeUndefined();
    expect(SYNC_CATALOGUE.settingScope('general.timeFormat')).toBe('unknown');
    expect(SYNC_CATALOGUE.rank('body_weight')).toBe(1);
    expect(SYNC_CATALOGUE.rank('task')).toBe(2);
  });

  it('identités naturelles : profile|singleton et weight|date|source, aucun repli UUID', () => {
    const profile = SYNC_CATALOGUE.table('profile');
    const weight = SYNC_CATALOGUE.table('body_weight');
    if (!profile || !weight) throw new Error('catalogue');
    expect(SYNC_CATALOGUE.isValidRowId(profile, 'profile|singleton')).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(profile, UUID)).toBe(false);
    expect(SYNC_CATALOGUE.isValidRowId(weight, 'weight|2026-10-05|manual')).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(weight, 'weight|2026-10-05|health')).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(weight, 'weight|2026-02-30|manual')).toBe(false);
    expect(SYNC_CATALOGUE.isValidRowId(weight, 'weight|2026-10-05|scale')).toBe(false);
    expect(SYNC_CATALOGUE.isValidRowId(weight, UUID)).toBe(false);
  });

  it('purge : profile jamais, body_weight oui', () => {
    expect(SYNC_CATALOGUE.isPurgeable('profile', 'profile|singleton')).toBe(false);
    expect(SYNC_CATALOGUE.isPurgeable('body_weight', 'weight|2026-10-05|manual')).toBe(true);
    expect(SYNC_CATALOGUE.isPurgeable('task', UUID)).toBe(false);
  });

  it('colonnes publiées : jamais les colonnes techniques', () => {
    expect(SYNC_CATALOGUE.column('profile', 'height_cm')?.type).toBe('real');
    expect(SYNC_CATALOGUE.column('profile', 'hlc')).toBeUndefined();
    expect(SYNC_CATALOGUE.column('body_weight', 'measured_at')?.nullable).toBe(true);
    expect(SYNC_CATALOGUE.column('body_weight', 'kg')?.nullable).toBe(false);
    expect(SYNC_CATALOGUE.column('body_weight', 'device_id')).toBeUndefined();
  });

  it('le catalogue est égal au schéma : clé + colonnes publiées + colonnes techniques = PRAGMA table_info', async () => {
    const driver = await openSqliteWasmDriver();
    try {
      await migrate(driver, migrations);
      for (const t of SYNC_CATALOGUE.tables) {
        const info = await driver.select<{ name: string }>(`PRAGMA table_info(${t.name})`);
        const actual = info.map((c) => c.name).sort();
        const expected = [t.key, ...t.columns.map((c) => c.name), ...t.local, 'updated_at', 'device_id', 'hlc'].sort();
        expect(actual).toEqual(expected);
      }
    } finally {
      await driver.close();
    }
  });
});

describe('catalogue injecté', () => {
  it('l’ancien catalogue (banc) et le catalogue I0 sont deux objets distincts qui s’ignorent', () => {
    expect(LEGACY_SYNC_CATALOGUE).not.toBe(SYNC_CATALOGUE);
    expect(LEGACY_SYNC_CATALOGUE.table('task')).toBeDefined();
    expect(LEGACY_SYNC_CATALOGUE.table('profile')).toBeUndefined();
    expect(SYNC_CATALOGUE.table('task')).toBeUndefined();
  });

  it('createCatalogue refuse un ordre qui ne correspond pas aux tables', () => {
    expect(() => createCatalogue({ tables: [], order: ['profile'] })).toThrow();
  });
});
