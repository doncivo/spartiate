import { describe, expect, it } from 'vitest';
import {
  BEDTIME_HORIZON_DAYS, BEDTIME_LEAD_MINUTES, MORNING_NOTIFICATION_TIME, planRecoveryNotifications,
  type RecoveryNotificationPlanInput,
} from './recoveryNotificationPlan';
import { NOTIFICATION_LIMIT_DEFAULT } from './notificationPlan';
import type { LocalDateTime } from './types';

/** Plan des notifications de récupération (I5-02 point 2.3, § 16.4, § 16.7) : pur, sans texte, désactivé par défaut. */
const at = (s: string): LocalDateTime => s as LocalDateTime;
const base: RecoveryNotificationPlanInput = { now: at('2026-11-10T07:00'), bedtime: false, morning: false, bedtimeTime: '23:00', morningReady: true };

describe('planRecoveryNotifications', () => {
  it('rien par défaut (les deux interrupteurs éteints)', () => {
    expect(planRecoveryNotifications(base).items).toEqual([]);
  });

  it('coucher : 30 minutes avant, un par soir sur 7 soirs, déjà triés, identifiants stables', () => {
    const plan = planRecoveryNotifications({ ...base, bedtime: true });
    expect(BEDTIME_LEAD_MINUTES).toBe(30);
    expect(plan.items).toHaveLength(BEDTIME_HORIZON_DAYS);
    expect(plan.items[0]).toEqual({ kind: 'bedtime', id: 'bedtime:2026-11-10', fireAt: '2026-11-10T22:30' });
    expect(plan.items.at(-1)?.fireAt).toBe('2026-11-16T22:30');
    expect(plan.items.map((i) => i.fireAt)).toEqual([...plan.items.map((i) => i.fireAt)].sort());
  });

  it('coucher passé aujourd’hui : le soir même est ignoré, jamais une date passée', () => {
    const plan = planRecoveryNotifications({ ...base, now: at('2026-11-10T22:30'), bedtime: true });
    expect(plan.items.every((i) => i.fireAt > '2026-11-10T22:30')).toBe(true);
    expect(plan.items[0]?.fireAt).toBe('2026-11-11T22:30');
  });

  it('coucher à 00 h 10 : rappel à 23 h 40, la veille du jour civil du coucher ; coucher 00 h 20 : 23 h 50', () => {
    const a = planRecoveryNotifications({ ...base, bedtime: true, bedtimeTime: '00:10' });
    expect(a.items[0]).toMatchObject({ id: 'bedtime:2026-11-10', fireAt: '2026-11-10T23:40' });
    const b = planRecoveryNotifications({ ...base, bedtime: true, bedtimeTime: '00:40' });
    expect(b.items[0]).toMatchObject({ id: 'bedtime:2026-11-10', fireAt: '2026-11-11T00:10' });
  });

  it('pas encore de proposition (null) : aucune notification de coucher', () => {
    expect(planRecoveryNotifications({ ...base, bedtime: true, bedtimeTime: null }).items).toEqual([]);
    expect(planRecoveryNotifications({ ...base, bedtime: true, bedtimeTime: 'abc' }).items).toEqual([]);
  });

  it('matin : au plus une par jour, aujourd’hui seulement, 08:00, si le score existe ; jamais si l’abstention (score null)', () => {
    expect(MORNING_NOTIFICATION_TIME).toBe('08:00');
    const plan = planRecoveryNotifications({ ...base, morning: true });
    expect(plan.items).toEqual([{ kind: 'morning', id: 'morning:2026-11-10', fireAt: '2026-11-10T08:00' }]);
    expect(planRecoveryNotifications({ ...base, morning: true, morningReady: false }).items).toEqual([]);
  });

  it('matin : heure déjà passée = aucune notification (jamais de date passée)', () => {
    expect(planRecoveryNotifications({ ...base, morning: true, now: at('2026-11-10T08:00') }).items).toEqual([]);
    expect(planRecoveryNotifications({ ...base, morning: true, now: at('2026-11-10T09:30') }).items).toEqual([]);
  });

  it('les deux ensemble : triés par échéance, au plus un « matin » par jour', () => {
    const plan = planRecoveryNotifications({ ...base, morning: true, bedtime: true });
    expect(plan.items.map((i) => i.kind)).toEqual(['morning', ...Array(BEDTIME_HORIZON_DAYS).fill('bedtime')]);
    expect(plan.items.filter((i) => i.kind === 'morning')).toHaveLength(1);
  });

  it('plafond : `limit` coupe la fin du plan, jamais au-delà de 64 ; limite 0 ou négative = rien', () => {
    expect(planRecoveryNotifications({ ...base, bedtime: true, limit: 3 }).items).toHaveLength(3);
    expect(planRecoveryNotifications({ ...base, bedtime: true, limit: 0 }).items).toEqual([]);
    expect(planRecoveryNotifications({ ...base, bedtime: true, limit: -5 }).items).toEqual([]);
    expect(planRecoveryNotifications({ ...base, bedtime: true, limit: 1000 }).items.length).toBeLessThanOrEqual(NOTIFICATION_LIMIT_DEFAULT);
    expect(planRecoveryNotifications({ ...base, bedtime: true, limit: 3 }).total).toBe(BEDTIME_HORIZON_DAYS);
  });

  it('la sortie ne porte aucun texte ni valeur corporelle : seulement nature, identifiant, échéance', () => {
    for (const item of planRecoveryNotifications({ ...base, bedtime: true, morning: true }).items) expect(Object.keys(item).sort()).toEqual(['fireAt', 'id', 'kind']);
  });

  it('recalcul idempotent : mêmes entrées, même plan ; entrée mal formée = plan vide, sans exception', () => {
    const input = { ...base, bedtime: true, morning: true };
    expect(planRecoveryNotifications(input)).toEqual(planRecoveryNotifications(input));
    expect(planRecoveryNotifications({ ...input, now: at('nope') }).items).toEqual([]);
  });
});
