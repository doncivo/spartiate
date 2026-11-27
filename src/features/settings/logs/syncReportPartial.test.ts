import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { asEntityId, type DeviceId } from '../../../domain/types';
import { buildLogExport } from './logExport';
import { readSyncReport } from './syncReport';

// SYNC-0302 (D-673) : l'export des journaux montre aussi l'heure de dernière synchro de cet appareil ; la mention « lecture partielle »
// l'accompagne quand `sync_meta.partialRead` désigne cette heure (jamais pour une autre heure ni pour un autre appareil).
const SELF = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000fd');
const PEER = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
const AT = '2026-11-07T10:00:00.000Z';

describe('SYNC-0302 : lecture partielle dans le bilan de l’export des journaux', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openBaseDb(SELF, AT);
    await db.driver.execute("INSERT INTO sync_state (device_id, is_self, platform, status, last_sync_at, cursor_segment, cursor_record) VALUES (?, 1, 'windows', 'active', ?, 1, 4)", [SELF, AT]);
    await db.driver.execute("INSERT INTO sync_state (device_id, is_self, platform, status, last_sync_at, cursor_segment, cursor_record) VALUES (?, 0, 'ios', 'active', ?, 2, 7)", [PEER, AT]);
  });
  afterEach(async () => {
    await db.close();
  });

  const exported = async (): Promise<string> => buildLogExport([], { version: '0.30.2', os: 'windows', schemaVersion: 1, now: new Date(AT), report: await readSyncReport(db.data.repos) }).text;

  it('heure de cet appareil suivie de « (lecture partielle) » quand la méta la désigne', async () => {
    await db.data.repos.sync.setMeta('partialRead', JSON.stringify({ at: AT }));
    const report = await readSyncReport(db.data.repos);
    expect(report.devices.find((d) => d.self)?.partialRead).toBe(true);
    expect(report.devices.find((d) => !d.self)?.partialRead).toBe(false);
    const lines = (await exported()).split('\r\n');
    expect(lines.find((l) => l.startsWith('Appareil 60000000'))).toContain(`dernière synchro ${AT} (lecture partielle)`);
    expect(lines.find((l) => l.startsWith('Appareil bbbbbbbb'))).not.toContain('lecture partielle');
  });

  it('aucune mention sans méta, ou si la méta désigne une autre heure', async () => {
    expect(await exported()).not.toContain('lecture partielle');
    await db.data.repos.sync.setMeta('partialRead', JSON.stringify({ at: '2026-11-06T10:00:00.000Z' }));
    expect(await exported()).not.toContain('lecture partielle');
  });
});
