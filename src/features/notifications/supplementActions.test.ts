import { afterEach, describe, expect, it } from 'vitest';
import { supplementNotificationId } from '../../domain/supplementNotificationPlan';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { supplementNotificationsFr } from '../../i18n/fr.supplementNotifications';
import { createFakeNotificationActionSource, createFakeNotificationScheduler, type FakeNotificationActionSource } from '../../platform/notifications';
import { createSupplementActionProcessor, startSupplementActions, type SupplementActionDeps } from './supplementActions';
import { createSupplementNotificationService } from './supplementNotifications';

/**
 * FIX-0221 (D-250 à D-253) : action « Pris » de la notification de complément. Le plugin écrit l'action dans son fichier durable (app tuée comprise) ;
 * l'app la tire, coche la prise par le MÊME chemin d'écriture que la carte d'Aujourd'hui (`SupplementRepository.setTaken`, capture de synchro),
 * enregistre la clé appliquée, puis acquitte. Idempotent : ligne relue, deuxième action, action rejouée au lancement → une seule prise.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fd' as DeviceId;
const D = '2026-11-13' as LocalDate;
const T = '08:00' as LocalTime;
const NOW = Date.parse('2026-11-13T07:30:00Z');
let db: TestDb;
let opened = false;
afterEach(async () => {
  if (opened) await db.close();
  opened = false;
});

const draft = { name: 'Créatine secrète', dose: 5, unit: 'g', times: [T], days: 127, active: true };
const intakeRows = () => db.driver.select<{ id: string; deleted_at: string | null }>('SELECT id, deleted_at FROM supplement_intake ORDER BY id');
const intakeOutbox = () => db.driver.select<{ row_id: string }>("SELECT row_id FROM sync_outbox WHERE table_name = 'supplement_intake' ORDER BY seq");

async function setup(over: Partial<SupplementActionDeps> = {}) {
  db = await openBaseDb(DEVICE, '2026-11-01T08:00:00.000Z');
  opened = true;
  const repo = await db.data.repos.supplements();
  const a = await repo.create(draft);
  const b = await repo.create({ ...draft, name: 'Zinc' });
  const source = createFakeNotificationActionSource();
  const taken: number[] = [];
  const trouble: string[] = [];
  const logs: string[] = [];
  const processor = createSupplementActionProcessor({
    source,
    settings: db.data.repos.settings,
    supplements: () => db.data.repos.supplements(),
    nowMs: () => NOW,
    texts: { action: supplementNotificationsFr.actionTaken, placeholder: supplementNotificationsFr.hiddenPlaceholder },
    onTaken: (count) => taken.push(count),
    onTrouble: (kind) => trouble.push(kind),
    log: (code) => logs.push(code),
    ...over,
  });
  return { source, processor, taken, trouble, logs, a, b };
}

const press = (source: FakeNotificationActionSource, over: { sid?: string | null; at?: number; wake?: boolean } = {}): void =>
  source.push({ numericId: 70001, actionId: 'done', receivedAtMs: NOW - 60_000, sid: over.sid === undefined ? supplementNotificationId(D, T) : over.sid, deliveredAt: over.at ?? NOW - 600_000 }, { wake: over.wake ?? false });

describe('action « Pris » (FIX-0221)', () => {
  it('enregistre la catégorie « complément » : action « Pris » sans premier plan, texte neutre d’écran verrouillé', async () => {
    const { source, processor } = await setup();
    expect(await processor.register()).toBe(true);
    expect(source.registered).toEqual([{ id: 'sp.supplement', actions: [{ id: 'done', title: 'Pris', foreground: false }], hiddenPreviewsBodyPlaceholder: supplementNotificationsFr.hiddenPlaceholder }]);
    expect(JSON.stringify(source.registered)).not.toMatch(/Créatine|Zinc/);
  });

  it('coche les prises dues de ce moment (même chemin que l’app : ligne publiée), puis acquitte le fichier', async () => {
    const { source, processor, taken, a, b } = await setup();
    press(source);
    const result = await processor.run();
    expect(result).toMatchObject({ status: 'done', taken: 2, applied: 1 });
    expect((await intakeRows()).map((r) => [r.id, r.deleted_at])).toEqual([
      [`intake|${a.id}|${D}|${T}`, null],
      [`intake|${b.id}|${D}|${T}`, null],
    ].sort());
    expect((await intakeOutbox()).map((r) => r.row_id).sort()).toEqual([`intake|${a.id}|${D}|${T}`, `intake|${b.id}|${D}|${T}`].sort());
    expect(source.file).toEqual([]);
    expect(source.calls).toContain('ack:1');
    expect(taken).toEqual([2]);
  });

  it('idempotent : deux actions sur la même prise, puis la même ligne rejouée au lancement → une seule prise, aucune écriture de plus', async () => {
    const { source, processor, a } = await setup();
    press(source);
    press(source, { at: NOW - 300_000 }); // deuxième notification du même moment (reposée), deuxième « Pris »
    await processor.run();
    const outboxAfterFirst = (await intakeOutbox()).length;
    // Acquittement perdu (coupure) : la même ligne est relue au lancement suivant.
    press(source);
    source.failNext('ack');
    expect(await processor.run()).toMatchObject({ taken: 0 });
    press(source);
    expect(await processor.run()).toMatchObject({ taken: 0, applied: 0 });
    expect((await intakeRows()).filter((r) => r.id.includes(a.id))).toHaveLength(1);
    expect(await intakeOutbox()).toHaveLength(outboxAfterFirst);
  });

  it('prise décochée dans l’app après l’action : la ligne rejouée ne la recoche pas (clé déjà appliquée)', async () => {
    const { source, processor, a } = await setup();
    press(source);
    source.failNext('ack');
    await processor.run();
    await (await db.data.repos.supplements()).setTaken(a.id, D, T, false);
    await processor.run();
    expect((await intakeRows()).find((r) => r.id.includes(a.id))?.deleted_at).not.toBeNull();
  });

  it('déjà cochée dans l’app : rien de plus, pas de message', async () => {
    const { source, processor, taken, a, b } = await setup();
    const repo = await db.data.repos.supplements();
    await repo.setTaken(a.id, D, T, true);
    await repo.setTaken(b.id, D, T, true);
    press(source);
    expect(await processor.run()).toMatchObject({ taken: 0, applied: 1 });
    expect(taken).toEqual([]);
  });

  it('échec d’écriture : entrée gardée et rejouée, signalée (jamais un silence) ; réussite au passage suivant', async () => {
    let fail = true;
    const { source, processor, trouble, taken } = await setup({
      supplements: async () => {
        const repo = await db.data.repos.supplements();
        return { ...repo, setTaken: (...args: Parameters<typeof repo.setTaken>) => (fail ? Promise.reject(new Error('disk')) : repo.setTaken(...args)) };
      },
    });
    press(source);
    expect(await processor.run()).toMatchObject({ failed: 1, taken: 0 });
    expect(trouble).toEqual(['failed']);
    expect(source.file).toEqual([]); // l'entrée est dans la file locale, le fichier natif est acquitté
    fail = false;
    expect(await processor.run()).toMatchObject({ failed: 0, taken: 2 });
    expect(taken).toEqual([2]);
  });

  it('file locale non enregistrée : le fichier natif n’est PAS acquitté (rejoué plus tard, sans doublon)', async () => {
    const { source, processor, logs } = await setup({
      settings: {
        get: (key) => db.data.repos.settings.get(key),
        set: () => Promise.reject(new Error('disk')),
      } as SupplementActionDeps['settings'],
    });
    press(source);
    expect(await processor.run()).toMatchObject({ status: 'queue-failed' });
    expect(source.file).toHaveLength(1);
    expect(logs).toContain('supplement-action-queue-failed');
  });

  it('lignes illisibles ou écritures impossibles côté natif : signalées', async () => {
    const { source, processor, trouble } = await setup();
    source.addUnreadable(1);
    source.addWriteFailures(1);
    await processor.run();
    expect(trouble).toEqual(['lost']);
  });

  it('source en échec : rien d’écrit, code journalisé', async () => {
    const { source, processor, logs } = await setup();
    press(source);
    source.failNext('drain');
    expect(await processor.run()).toMatchObject({ status: 'source-failed' });
    expect(await intakeRows()).toEqual([]);
    expect(logs).toEqual(['supplement-action-source-failed']);
  });
});

describe('rappels de compléments : catégorie « complément » (FIX-0221)', () => {
  it('chaque notification de complément porte la catégorie `supplement` (bouton « Pris ») ; le texte reste sans nom', async () => {
    const scheduler = createFakeNotificationScheduler();
    const store = new Map<string, unknown>([['supplements.notificationPrefs', { v: 1, enabled: true }]]);
    const service = createSupplementNotificationService({
      scheduler,
      clock: { nowMs: () => NOW, zone: () => 'Europe/Paris' },
      settings: { get: (async (key: string) => store.get(key) ?? null) as never, set: (async () => undefined) as never },
      load: async () => ({ supplements: [{ id: '30000000-0000-4000-8000-000000000001', name: 'Créatine secrète', dose: 5, unit: 'g', times: [T], days: 127, active: true, since: '2026-11-01' as LocalDate }], intakes: [] }),
      log: () => undefined,
    });
    await service.replan();
    const pending = await scheduler.pending();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((r) => r.category === 'supplement')).toBe(true);
    expect(JSON.stringify(pending)).not.toMatch(/Créatine/);
  });
});

describe('déclencheurs de l’action « Pris » (FIX-0221)', () => {
  function env(source: FakeNotificationActionSource | null) {
    const listeners = new Set<() => void>();
    const document = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const calls: string[] = [];
    const processor = {
      register: async () => {
        calls.push('register');
        return true;
      },
      run: async () => {
        calls.push('run');
        return { status: 'done' as const, taken: 0, applied: 0, duplicates: 0, failed: 0 };
      },
    };
    return { document, calls, listeners, start: () => startSupplementActions({ document: document as never, source, makeProcessor: () => processor }) };
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('PC (aucune source) : rien n’est enregistré ni lu', async () => {
    const e = env(null);
    e.start();
    await flush();
    expect(e.calls).toEqual([]);
    expect(e.listeners.size).toBe(0);
  });

  it('iPhone : enregistrement puis tirage à l’ouverture, au retour au premier plan et au réveil du plugin ; arrêt propre', async () => {
    const source = createFakeNotificationActionSource();
    const e = env(source);
    const stop = e.start();
    await flush();
    expect(e.calls).toEqual(['register', 'run']);
    for (const fn of [...e.listeners]) fn();
    press(source, { wake: true });
    await flush();
    expect(e.calls).toEqual(['register', 'run', 'run', 'run']);
    stop();
    await flush();
    expect(e.listeners.size).toBe(0);
    press(source, { wake: true });
    await flush();
    expect(e.calls).toHaveLength(4);
  });
});
