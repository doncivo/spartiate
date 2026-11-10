import { describe, expect, it } from 'vitest';
import type { NightRecord } from '../../domain/recovery';
import type { LocalDateTime } from '../../domain/types';
import { recoveryNotificationsFr } from '../../i18n/fr.recoveryNotifications';
import { createFakeNotificationScheduler, createUnavailableNotificationScheduler, NotificationSchedulerError, type FakeNotificationScheduler, type NotificationScheduler } from '../../platform/notifications';
import { createRecoveryNotificationService, type RecoveryNotificationDeps } from './recoveryNotifications';

/** Service des notifications de récupération (I5-02 point 2.3) : iPhone seulement, désactivé par défaut, texte neutre, plafond de 64 partagé. */
const NOW_MS = Date.parse('2026-11-10T06:00:00Z'); // 07:00 à Paris
const ZONE = 'Europe/Paris';

function memorySettings() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: async (key: string): Promise<unknown> => store.get(key) ?? null,
    set: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
  };
}

function setup(over: Partial<RecoveryNotificationDeps> = {}, scheduler: NotificationScheduler = createFakeNotificationScheduler()) {
  const settings = memorySettings();
  let score: number | null = 62;
  const service = createRecoveryNotificationService({
    scheduler,
    clock: { nowMs: () => NOW_MS, zone: () => ZONE },
    settings: settings as unknown as RecoveryNotificationDeps['settings'],
    todayScore: async () => score,
    log: () => undefined,
    ...over,
  });
  return { service, settings, scheduler, setScore: (v: number | null) => { score = v; } };
}
const fakeOf = (s: NotificationScheduler): FakeNotificationScheduler => s as FakeNotificationScheduler;
const replaces = (s: NotificationScheduler) => fakeOf(s).calls.filter((c) => c.type === 'replace');
const PROPOSAL = { v: 1, day: '2026-11-10', time: '23:00' };

describe('replan', () => {
  it('PC (implémentation vide) : « unsupported », aucun effet, même avec les deux interrupteurs allumés', async () => {
    const { service, settings } = setup({}, createUnavailableNotificationScheduler());
    settings.store.set('recovery.notificationPrefs', { v: 1, bedtime: true, morning: true });
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    expect(await service.replan()).toMatchObject({ status: 'unsupported', planned: 0 });
  });

  it('planificateur indisponible (faux) : rien n’est lu ni planifié', async () => {
    const { service, scheduler } = setup();
    fakeOf(scheduler).setAvailability('unavailable');
    await service.setPrefs({ v: 1, bedtime: true, morning: true });
    expect(replaces(scheduler)).toEqual([]);
  });

  it('désactivé par défaut : aucune planification, aucun appel replace', async () => {
    const { service, scheduler } = setup();
    expect(await service.replan()).toMatchObject({ status: 'off', planned: 0 });
    expect(fakeOf(scheduler).calls).toEqual([]);
  });

  it('coucher : 7 notifications à 22 h 30, texte neutre composé depuis le catalogue', async () => {
    const { service, scheduler, settings } = setup();
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    await service.setPrefs({ v: 1, bedtime: true, morning: false });
    const pending = await scheduler.pending();
    expect(pending).toHaveLength(7);
    expect(pending[0]).toMatchObject({ kind: 'bedtime', id: 'bedtime:2026-11-10', fireAt: '2026-11-10T22:30', title: recoveryNotificationsFr.notifBedtimeTitle, body: recoveryNotificationsFr.notifBedtimeBody });
  });

  it('matin : une seule notification, texte neutre, aucun chiffre ni valeur corporelle', async () => {
    const { service, scheduler } = setup();
    await service.setPrefs({ v: 1, bedtime: false, morning: true });
    const pending = await scheduler.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ kind: 'morning', fireAt: '2026-11-10T08:00', body: 'Ta récupération du jour est prête' });
    for (const n of pending) expect(`${n.title} ${n.body}`).not.toMatch(/\d|score|HRV|poids|fréquence|%/i);
  });

  it('matin : aucune notification si le score est null (abstention)', async () => {
    const { service, scheduler, setScore } = setup();
    setScore(null);
    await service.setPrefs({ v: 1, bedtime: false, morning: true });
    expect(await scheduler.pending()).toEqual([]);
  });

  it('coucher sans proposition (« pas encore ») : aucune notification', async () => {
    const { service, scheduler, settings } = setup();
    settings.store.set('recovery.bedtimeProposal', { v: 1, day: '2026-11-10', time: null });
    await service.setPrefs({ v: 1, bedtime: true, morning: false });
    expect(await scheduler.pending()).toEqual([]);
  });

  it('autorisation refusée ou non décidée : rien n’est planifié et l’autorisation n’est JAMAIS redemandée', async () => {
    for (const permission of ['denied', 'undetermined'] as const) {
      const { service, scheduler } = setup();
      fakeOf(scheduler).setPermission(permission);
      await service.setPrefs({ v: 1, bedtime: true, morning: true });
      expect(await service.replan()).toMatchObject({ status: 'permission' });
      expect(fakeOf(scheduler).calls.map((c) => c.type)).not.toContain('requestPermission');
      expect(replaces(scheduler)).toEqual([]);
    }
  });

  it('demande explicite sur geste : requestPermission puis planification', async () => {
    const { service, scheduler, settings } = setup();
    fakeOf(scheduler).setPermission('undetermined');
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    expect(await service.requestPermissionAndReplan({ v: 1, bedtime: true, morning: false })).toMatchObject({ status: 'planned', planned: 7 });
    expect(fakeOf(scheduler).calls.map((c) => c.type)).toContain('requestPermission');
  });

  it('replan idempotent : le second passage ne repose rien (aucun doublon)', async () => {
    const { service, scheduler, settings } = setup();
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    await service.setPrefs({ v: 1, bedtime: true, morning: true });
    expect(await scheduler.pending()).toHaveLength(8);
    await service.replan();
    expect(await scheduler.pending()).toHaveLength(8);
    const report = replaces(scheduler).length;
    expect(report).toBeGreaterThanOrEqual(2);
    expect((await scheduler.replace(await scheduler.pending())).scheduled).toBe(0);
  });

  it('les notifications d’autres natures sont conservées, et le plafond de 64 est partagé sans éviction des autres', async () => {
    const { service, scheduler, settings } = setup();
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    await scheduler.replace([{ id: 'task:x', fireAt: '2026-11-12T09:00' as LocalDateTime, title: 'T', body: 'b', kind: 'task' }]);
    fakeOf(scheduler).setOutsidePlan(60);
    await service.setPrefs({ v: 1, bedtime: true, morning: false });
    const pending = await scheduler.pending();
    expect(pending.find((n) => n.id === 'task:x')).toBeDefined();
    expect(pending.length + 60).toBeLessThanOrEqual(64);
    expect(pending.filter((n) => n.kind === 'bedtime')).toHaveLength(3);
  });

  it('éteindre les interrupteurs annule seulement les notifications de récupération', async () => {
    const { service, scheduler, settings } = setup();
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    await scheduler.replace([{ id: 'task:x', fireAt: '2026-11-12T09:00' as LocalDateTime, title: 'T', body: 'b', kind: 'task' }]);
    await service.setPrefs({ v: 1, bedtime: true, morning: true });
    await service.setPrefs({ v: 1, bedtime: false, morning: false });
    expect((await scheduler.pending()).map((n) => n.id)).toEqual(['task:x']);
  });

  it('un échec du planificateur est rendu, jamais lancé ni silencieux', async () => {
    const { service, scheduler, settings } = setup();
    settings.store.set('recovery.bedtimeProposal', PROPOSAL);
    fakeOf(scheduler).failNextReplace(new NotificationSchedulerError('schedule-failed'));
    const result = await service.setPrefs({ v: 1, bedtime: true, morning: false });
    expect(result).toMatchObject({ status: 'failed', reason: 'schedule-failed' });
  });

  it('fuseau illisible : aucune planification (« no-zone »)', async () => {
    const { service, scheduler } = setup({ clock: { nowMs: () => NOW_MS, zone: () => null } });
    await service.setPrefs({ v: 1, bedtime: true, morning: true });
    expect(replaces(scheduler)).toEqual([]);
  });
});

describe('après l’import des fichiers Raccourcis', () => {
  const nights = (count: number): NightRecord[] => Array.from({ length: count }, (_, i) => ({ day: new Date(Date.UTC(2026, 10, 10 - i)).toISOString().slice(0, 10), hrvMs: null, restingHr: null, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390 }));

  it('enregistre l’heure proposée du jour puis replanifie', async () => {
    const { service, scheduler, settings } = setup();
    await service.setPrefs({ v: 1, bedtime: true, morning: false });
    expect(await scheduler.pending()).toEqual([]);
    await service.afterImport({ today: '2026-11-10', nights: nights(8), exertionToday: 5 });
    expect(settings.store.get('recovery.bedtimeProposal')).toEqual({ v: 1, day: '2026-11-10', time: '23:00' });
    expect((await scheduler.pending()).filter((n) => n.kind === 'bedtime')).toHaveLength(7);
  });

  it('sous 7 nuits : « pas encore de proposition » enregistré, aucune notification', async () => {
    const { service, scheduler, settings } = setup();
    await service.setPrefs({ v: 1, bedtime: true, morning: false });
    await service.afterImport({ today: '2026-11-10', nights: nights(5), exertionToday: 5 });
    expect(settings.store.get('recovery.bedtimeProposal')).toEqual({ v: 1, day: '2026-11-10', time: null });
    expect(await scheduler.pending()).toEqual([]);
  });

  it('ne rejette jamais, même si l’écriture du réglage échoue', async () => {
    const { service } = setup({ settings: { get: async () => null, set: async () => { throw new Error('boom'); } } as unknown as RecoveryNotificationDeps['settings'] });
    await expect(service.afterImport({ today: '2026-11-10', nights: nights(8), exertionToday: 5 })).resolves.toBeDefined();
  });
});

describe('catalogue de textes', () => {
  it('aucune formulation de diagnostic ni valeur corporelle dans les textes de notification', () => {
    const texts = [recoveryNotificationsFr.notifBedtimeTitle, recoveryNotificationsFr.notifBedtimeBody, recoveryNotificationsFr.notifMorningTitle, recoveryNotificationsFr.notifMorningBody];
    for (const text of texts) expect(text).not.toMatch(/\d|score|HRV|poids|fréquence|%|diagnostic|malad|fatigu|risque|santé|sommeil/i);
  });
});
