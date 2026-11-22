import { afterEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { declareInjury, markHealed, recordCheckin, type InjuriesValue } from '../../../domain/training/injuries';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { createFakeNotificationScheduler } from '../../../platform/notifications';
import { createInjuryNotificationService } from '../../notifications/injuryNotifications';
import { loadInjuries, saveInjuries } from './injuriesStore';

/**
 * SYNC-0291 (BL-120, D-465) : lecture des gênes par la table publiée `injury`, reprise unique du réglage local `training.injuries`, écriture des
 * seules gênes changées ; le rappel de check-in de l'iPhone (D-404) lit la même source.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000ff' as DeviceId;
const TODAY = '2026-11-22' as LocalDate;
const U = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: TestDb;
afterEach(async () => db.close());
const one = (id: string, startedOn = '2026-11-01'): InjuriesValue => {
  const r = declareInjury({ v: 1, items: [] }, { id, muscleId: 'chest', patterns: [], startedOn: startedOn as LocalDate, note: null }, TODAY);
  if (!r.ok) throw new Error(r.issue);
  return r.value;
};

describe('injuriesStore (D-465)', () => {
  it('relecture 1, point 2 : deux lectures concurrentes au premier lancement : aucune n’échoue, aucun doublon', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await db.data.repos.settings.set('training.injuries', one('g1'));
    const [a, b] = await Promise.all([loadInjuries(db.data.repos), loadInjuries(db.data.repos)]);
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(1);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM injury')).toEqual([{ n: 1 }]);
  });

  it('relecture 1, point 4 : gêne au muscle trop long (CHECK à 64) : les autres sont reprises, le réglage est GARDÉ, jamais d’échec de lecture', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    const good = one(U(7)).items[0];
    await db.data.repos.settings.set('training.injuries', { v: 1, items: [good, { ...good, id: U(8), muscleId: 'm'.repeat(65) }] });
    expect((await loadInjuries(db.data.repos)).items.map((i) => i.id)).toEqual([U(7)]);
    expect(await db.data.repos.settings.get('training.injuries')).not.toBeNull();
    expect((await loadInjuries(db.data.repos)).items.map((i) => i.id)).toEqual([U(7)]);
  });

  it('réglage { v: 1, items } repris une fois puis remis à null ; rejoué sans doublon', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await db.data.repos.settings.set('training.injuries', one(U(1)));
    expect((await loadInjuries(db.data.repos)).items.map((i) => i.id)).toEqual([U(1)]);
    expect(await db.data.repos.settings.get('training.injuries')).toBeNull();
    await db.data.repos.settings.set('training.injuries', one(U(1)));
    expect((await loadInjuries(db.data.repos)).items).toHaveLength(1);
    expect(await db.data.repos.settings.get('training.injuries')).toBeNull();
  });

  it('saveInjuries : seule la gêne changée est écrite (une réponse : le champ checkins)', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    const empty = await loadInjuries(db.data.repos);
    const first = one(U(1));
    const both: InjuriesValue = { v: 1, items: [...first.items, ...one(U(2)).items] };
    await saveInjuries(db.data.repos, empty, both);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const current = await loadInjuries(db.data.repos);
    await saveInjuries(db.data.repos, current, recordCheckin(current, U(2), 'worse', TODAY));
    expect(await db.driver.select("SELECT row_id, field FROM sync_outbox WHERE table_name = 'injury'")).toEqual([{ row_id: U(2), field: 'checkins' }]);
    expect((await loadInjuries(db.data.repos)).items[1]?.checkins).toEqual([{ on: TODAY, answer: 'worse' }]);
  });

  it('rappel de check-in (iPhone) : une gêne lue dans la table est planifiée ; guérie : plus rien', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await saveInjuries(db.data.repos, { v: 1, items: [] }, one(U(3), '2026-11-20'));
    const scheduler = createFakeNotificationScheduler();
    await scheduler.requestPermission();
    const service = createInjuryNotificationService({
      scheduler,
      clock: { nowMs: () => Date.parse('2026-11-22T07:00:00Z'), zone: () => 'Europe/Paris' },
      injuries: () => loadInjuries(db.data.repos),
      log: () => undefined,
    });
    expect(await service.replan()).toMatchObject({ status: 'planned', planned: 1 });
    expect((await scheduler.pending())[0]).toMatchObject({ id: 'injury:2026-12-04', kind: 'injury' });
    const current = await loadInjuries(db.data.repos);
    await saveInjuries(db.data.repos, current, markHealed(current, U(3), TODAY));
    await service.replan();
    expect(await scheduler.pending()).toEqual([]);
  });
});
