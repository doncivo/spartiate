import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { DeviceId } from '../../../domain/types';
import { asEntityId } from '../../../domain/types';
import { buildLogExport } from './logExport';
import { readSyncReport } from './syncReport';

const SELF = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000fc');
const PEER = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
const SENTINEL = 'TITRE-SECRET-456';
const AT = '2026-11-07T10:00:00.000Z';
const HLC = '001794045600000-0000-bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';

/** 0.2.4 point 3 : bilan en tête de l'export, compteurs seulement (jamais le contenu d'une ligne). */
describe('bilan de synchro de l’export des journaux', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(SELF, AT);
  });
  afterEach(async () => {
    await db.close();
  });

  async function seed(): Promise<void> {
    const common = [AT, AT, SELF, '001794045600000-0000-60000000-0000-4000-8000-0000000000fc'];
    await db.driver.execute("INSERT INTO sync_state (device_id, is_self, platform, app_version, status, last_sync_at, last_seen_hlc, cursor_segment, cursor_record) VALUES (?, 1, 'windows', '0.2.4', 'active', ?, NULL, 1, 4)", [SELF, AT]);
    await db.driver.execute("INSERT INTO sync_state (device_id, is_self, platform, app_version, status, last_sync_at, last_seen_hlc, cursor_segment, cursor_record) VALUES (?, 0, 'ios', '0.2.4', 'active', ?, ?, 2, 7)", [PEER, AT, HLC]);
    await db.driver.execute(`INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES ('weight|2026-11-06|manual', '2026-11-06', 80, 'manual', 'Europe/Paris', ?, ?, ?, ?)`, common);
    await db.driver.execute(`INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc, deleted_at) VALUES ('weight|2026-11-05|manual', '2026-11-05', 81, 'manual', 'Europe/Paris', ?, ?, ?, ?, ?)`, [...common, AT]);
    await db.driver.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES ('w1', ?, ?, ?, 'empty', ?, ?, ?, ?)`, [SENTINEL, AT, AT, ...common]);
    await db.driver.execute(`INSERT INTO workout (id, name, started_at, source, created_at, updated_at, device_id, hlc) VALUES ('w2', ?, ?, 'empty', ?, ?, ?, ?)`, [SENTINEL, AT, ...common]);
    await db.driver.execute(`INSERT INTO sync_unknown (table_name, row_id, field, value, hlc, sv) VALUES ('workout', 'w9', 'futur', ?, ?, 99)`, [SENTINEL, HLC]);
    await db.driver.execute(`INSERT INTO conflict_log (table_name, row_id, field, kept_value, discarded_value, kept_device, discarded_device, kept_hlc, discarded_hlc, detected_at) VALUES ('workout', 'w1', 'name', ?, ?, ?, ?, ?, ?, ?)`, [SENTINEL, SENTINEL, SELF, PEER, HLC, HLC, AT]);
  }

  it('compteurs par table (lignes non supprimées, séances closes), file d’envoi, lignes mises de côté et conflits', async () => {
    await seed();
    const report = await readSyncReport(db.data.repos);
    expect(report.rows).toMatchObject({ body_weight: 1, workout: 1, profile: 0, exercise: 0, equipment_profile: 0, routine: 0, routine_day: 0, routine_exercise: 0, workout_set: 0 });
    expect(report.unknown).toBe(1);
    expect(report.conflicts).toBe(1);
    const outbox = await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox');
    expect(report.outbox).toBe(Number(outbox[0]?.n));
    expect(report.outbox).toBeGreaterThan(0);
    expect(report.devices.map((d) => d.id).sort()).toEqual(['60000000', 'bbbbbbbb']);
    const peer = report.devices.find((d) => d.id === 'bbbbbbbb');
    expect(peer).toMatchObject({ self: false, platform: 'ios', appVersion: '0.2.4', status: 'active', cursor: '2/7' });
    expect(peer?.lastSeen).toMatch(/^2026-/);
  });

  it('le fichier exporté porte le bilan en tête et aucun contenu de ligne (sentinelle)', async () => {
    await seed();
    const report = await readSyncReport(db.data.repos);
    const { text } = buildLogExport([], { version: '0.2.4', os: 'windows', schemaVersion: 4, now: new Date(AT), report });
    const lines = text.split('\r\n');
    expect(lines.some((l) => l.includes('body_weight') && l.includes('1'))).toBe(true);
    expect(text).toContain('bbbbbbbb');
    expect(text).toContain('2/7');
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain('Europe/Paris');
    expect(text).not.toContain('futur');
    // Le bilan est avant la première entrée du journal, après l’en-tête.
    expect(lines.indexOf(lines.find((l) => l.includes('Bilan')) ?? '')).toBeGreaterThan(0);
  });

  it('bilan indisponible : une ligne avec le code, jamais une exportation refusée', () => {
    const { text } = buildLogExport([], { version: '0.2.4', os: 'windows', schemaVersion: 4, now: new Date(AT), report: { unavailable: 'io' } });
    expect(text).toContain('indisponible');
    expect(text).toContain('io');
  });
});
