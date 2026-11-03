import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { currentPurgeHorizon, defaultSyncLogger, purgeDeletedRows } from '../../../../src/sync';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/** Synchro de `profile` et `body_weight` sur le schéma 1 (D-65, D-67 : publication, conflit par champ, singleton, identités, tombstone, catalogue étranger). */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROFILE = 'profile|singleton';
const DAY = 86_400_000;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function twoDevices(): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return [a, b];
}

async function roundTrip(): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of devices) await d.cycle();
    syncFolders(devices);
  }
}

const advance = (ms: number): void => {
  for (const d of devices) d.clock.advance(ms);
};

/** Tampon d'écriture de l'appareil (les déclencheurs de capture font le reste). */
function stamp(d: SimDevice): { at: string; hlc: string; device: string } {
  return { at: new Date(d.clock.nowMs()).toISOString(), hlc: d.hlc.now(), device: d.id };
}

async function putProfile(d: SimDevice, set: Record<string, string | number | null>): Promise<void> {
  const exists = (await d.driver.select('SELECT 1 FROM profile WHERE id = ?', [PROFILE])).length > 0;
  if (!exists) {
    const s = stamp(d);
    await d.driver.execute('INSERT INTO profile (id, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?)', [PROFILE, s.at, s.at, s.device, s.hlc]);
  }
  const cols = Object.keys(set);
  if (cols.length === 0) return;
  const s = stamp(d);
  await d.driver.execute(`UPDATE profile SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [...Object.values(set), s.at, s.device, s.hlc, PROFILE]);
}

async function putWeight(d: SimDevice, date: string, source: 'manual' | 'health', kg: number): Promise<string> {
  const id = `weight|${date}|${source}`;
  const s = stamp(d);
  await d.driver.execute(
    'INSERT INTO body_weight (id, date, kg, source, timezone, health_uuid, measured_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, date, kg, source, 'Europe/Paris', source === 'health' ? 'h-1' : null, source === 'health' ? '2026-10-05T06:30:00.000Z' : null, s.at, s.at, s.device, s.hlc],
  );
  return id;
}

const profile = async (d: SimDevice) => (await d.driver.select('SELECT sex, birth_year, height_cm, goal, deleted_at FROM profile'))[0] as Record<string, unknown> | undefined;
const weights = (d: SimDevice) => d.driver.select<{ id: string; kg: number; source: string; deleted_at: string | null }>('SELECT id, kg, source, deleted_at FROM body_weight ORDER BY id');

describe('publication', () => {
  it('une ligne profile et une pesée circulent d’un appareil à l’autre', async () => {
    const [a, b] = await twoDevices();
    await putProfile(a, { sex: 'male', height_cm: 180 });
    await putWeight(a, '2026-10-05', 'manual', 82.4);
    await roundTrip();
    expect(await profile(b)).toMatchObject({ sex: 'male', height_cm: 180 });
    expect(await weights(b)).toEqual([{ id: 'weight|2026-10-05|manual', kg: 82.4, source: 'manual', deleted_at: null }]);
  });

  it('settings n’est pas publié : aucune clé de réglage dans sync_outbox, aucun déclencheur', async () => {
    const [a] = await twoDevices();
    await a.data.repos.settings.set('general.locale', 'fr');
    await a.data.repos.settings.set('general.firstWeekday', 'monday');
    expect(await a.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'settings'")).toEqual([]);
    expect(await a.driver.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_settings%'")).toEqual([]);
  });

  it('epoch_carry_report est locale : hors catalogue, sans déclencheur, rien dans la file', async () => {
    const [a] = await twoDevices();
    expect(SYNC_CATALOGUE.table('epoch_carry_report')).toBeUndefined();
    expect(await a.driver.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'epoch_carry_report'")).toEqual([]);
    await a.driver.execute(
      "INSERT INTO epoch_carry_report (id, epoch, cause, reporter, opener, mode, authors, restored, recreated, parent_replaced, overflow, overflow_by, banner, created_at) VALUES (1, 'e', 'reset', 'r', 'o', 'merge', '[]', '[]', '[]', '[]', 0, '[]', 0, '2026-10-05T08:00:00.000Z')",
    );
    expect(await a.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'epoch_carry_report'")).toEqual([]);
  });
});

describe('conflit par champ', () => {
  it('deux champs différents modifiés en même temps : les deux survivent, sans conflit', async () => {
    const [a, b] = await twoDevices();
    await putProfile(a, { sex: 'male' });
    await roundTrip();
    advance(1_000);
    await putProfile(a, { height_cm: 181 });
    await putProfile(b, { goal: 'loss' });
    await roundTrip();
    for (const d of [a, b]) expect(await profile(d)).toMatchObject({ sex: 'male', height_cm: 181, goal: 'loss' });
    expect(await a.driver.select('SELECT 1 FROM conflict_log')).toEqual([]);
    expect(await b.driver.select('SELECT 1 FROM conflict_log')).toEqual([]);
  });

  it('même champ : le plus récent gagne partout et le perdant est au journal des conflits', async () => {
    const [a, b] = await twoDevices();
    await putProfile(a, { goal: 'gain' });
    await roundTrip();
    advance(1_000);
    await putProfile(a, { goal: 'loss' });
    advance(1_000);
    await putProfile(b, { goal: 'maintain' });
    await roundTrip();
    for (const d of [a, b]) expect((await profile(d))?.['goal']).toBe('maintain');
    const logged = [...(await a.driver.select<{ field: string }>('SELECT field FROM conflict_log')), ...(await b.driver.select<{ field: string }>('SELECT field FROM conflict_log'))];
    expect(logged.some((c) => c.field === 'goal')).toBe(true);
  });
});

describe('singleton et identités', () => {
  it('profil créé sur les deux appareils avant la première synchro : une seule ligne, mêmes valeurs partout (la création entière la plus récente gagne champ par champ)', async () => {
    const [a, b] = await twoDevices();
    await putProfile(a, { sex: 'female' });
    advance(500);
    await putProfile(b, { birth_year: 1990 });
    await roundTrip();
    for (const d of [a, b]) expect(await d.driver.select('SELECT id FROM profile')).toEqual([{ id: PROFILE }]);
    const [pa, pb] = [await profile(a), await profile(b)];
    expect(pa).toEqual(pb);
    // L'insertion de B est plus récente : ses valeurs NULL (sexe) l'emportent champ par champ sur la valeur de A, son année de naissance reste.
    expect(pa).toMatchObject({ sex: null, birth_year: 1990 });
  });

  it('même jour : manual et health sont deux lignes ; la même identité sur deux appareils reste une ligne', async () => {
    const [a, b] = await twoDevices();
    await putWeight(a, '2026-10-05', 'manual', 80);
    await putWeight(a, '2026-10-05', 'health', 79.8);
    await roundTrip();
    expect((await weights(b)).map((w) => w.id)).toEqual(['weight|2026-10-05|health', 'weight|2026-10-05|manual']);
    advance(1_000);
    const s = stamp(b);
    await b.driver.execute("UPDATE body_weight SET kg = 81, updated_at = ?, hlc = ?, device_id = ? WHERE id = 'weight|2026-10-05|manual'", [s.at, s.hlc, s.device]);
    await roundTrip();
    const manual = (await weights(a)).filter((w) => w.source === 'manual');
    expect(manual).toEqual([{ id: 'weight|2026-10-05|manual', kg: 81, source: 'manual', deleted_at: null }]);
  });

  it('une identité qui ne correspond pas à (date, source) est refusée à la réception', async () => {
    const [a, b] = await twoDevices();
    // Ligne forgée sur A (identité incohérente), poussée dans la file : B doit la refuser.
    const s = stamp(a);
    await a.driver.execute('PRAGMA ignore_check_constraints = ON');
    await a.driver.execute(
      "INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES ('weight|2026-10-06|manual', '2026-10-05', 80, 'manual', 'Europe/Paris', ?, ?, ?, ?)",
      [s.at, s.at, s.device, s.hlc],
    );
    await a.driver.execute('PRAGMA ignore_check_constraints = OFF');
    await roundTrip();
    expect(await weights(b)).toEqual([]);
  });
});

describe('suppression', () => {
  it('la suppression d’une pesée circule comme deleted_at ; la trace sync_tombstone n’apparaît qu’à la purge', async () => {
    const [a, b] = await twoDevices();
    const id = await putWeight(a, '2026-10-05', 'manual', 80);
    await roundTrip();
    advance(1_000);
    const s = stamp(a);
    await a.driver.execute('UPDATE body_weight SET deleted_at = ?, updated_at = ?, hlc = ?, device_id = ? WHERE id = ?', [s.at, s.at, s.hlc, s.device, id]);
    await roundTrip();
    expect((await weights(b))[0]?.deleted_at).not.toBeNull();
    expect(await a.driver.select('SELECT 1 FROM sync_tombstone')).toEqual([]);
    expect(await b.driver.select('SELECT 1 FROM sync_tombstone')).toEqual([]);
    advance(31 * DAY);
    await roundTrip();
    for (const d of [a, b]) {
      const horizon = await currentPurgeHorizon(d.data.repos, d.id as never, d.clock.nowMs());
      await purgeDeletedRows({ data: d.data, logger: defaultSyncLogger, catalogue: SYNC_CATALOGUE }, horizon, d.clock.nowMs());
    }
    expect(await a.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
    expect((await a.driver.select('SELECT row_id FROM sync_tombstone')).length).toBe(1);
  });

  it('profile n’est jamais purgé, même supprimé depuis longtemps', async () => {
    const [a] = await twoDevices();
    await putProfile(a, { sex: 'male' });
    const s = stamp(a);
    await a.driver.execute('UPDATE profile SET deleted_at = ?, updated_at = ?, hlc = ?, device_id = ? WHERE id = ?', [s.at, s.at, s.hlc, s.device, PROFILE]);
    advance(400 * DAY);
    const horizon = await currentPurgeHorizon(a.data.repos, a.id as never, a.clock.nowMs());
    await purgeDeletedRows({ data: a.data, logger: defaultSyncLogger, catalogue: SYNC_CATALOGUE }, horizon, a.clock.nowMs());
    expect(await a.driver.select('SELECT id FROM profile')).toEqual([{ id: PROFILE }]);
    expect(await a.driver.select('SELECT 1 FROM sync_tombstone')).toEqual([]);
  });
});

describe('catalogue étranger', () => {
  it('une tâche publiée par un appareil au catalogue du banc n’est pas appliquée par un appareil I0', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const old = await createSimDevice(B_ID, { name: 'banc', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, old];
    await setupFirst(old);
    await old.cycle();
    await pair(old, a);
    await a.cycle();
    await old.createTask('étrangère');
    await roundTrip();
    expect(await a.driver.select("SELECT name FROM sqlite_master WHERE name = 'task'")).toEqual([]);
    expect(await a.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'task'")).toEqual([]);
  });
});
