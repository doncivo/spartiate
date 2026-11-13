import { describe, expect, it } from 'vitest';
import { ACTION_TYPE_ID, ACTIONS_BY_CATEGORY, EMPTY_ACTION_QUEUE, type RawNotificationAction } from './notificationActions';
import { ALL_DAYS, type Supplement, type SupplementIntake } from './nutrition/supplements';
import { supplementNotificationId } from './supplementNotificationPlan';
import {
  intakesToTake,
  parseSupplementNotificationId,
  receiveSupplementActions,
  settleSupplementAction,
  SUPPLEMENT_ACTION_TYPE_ID,
  supplementActionTodo,
} from './supplementNotificationActions';
import type { LocalDate, LocalTime } from './types';

/** FIX-0221 (D-250) : action « Pris » de la notification de complément — règles pures (cible, prises à cocher, file locale, idempotence). */
const D = '2026-11-13' as LocalDate;
const T = '08:00' as LocalTime;
const sup = (id: string, over: Partial<Supplement> = {}): Supplement => ({ id, name: `S${id}`, dose: null, unit: null, times: [T, '20:00' as LocalTime], days: ALL_DAYS, active: true, since: '2026-11-01' as LocalDate, ...over });
const A = '30000000-0000-4000-8000-00000000000a';
const B = '30000000-0000-4000-8000-00000000000b';
const C = '30000000-0000-4000-8000-00000000000c';
const NOW = Date.parse('2026-11-13T07:30:00Z');
const raw = (over: Partial<RawNotificationAction> = {}): RawNotificationAction => ({ numericId: 70000, actionId: 'done', receivedAtMs: NOW - 60_000, sid: supplementNotificationId(D, T), deliveredAt: NOW - 120_000, ...over });

describe('cible de l’action « Pris »', () => {
  it('identifiant de la notification de complément : jour et moment, aller-retour avec le planificateur', () => {
    expect(parseSupplementNotificationId(supplementNotificationId(D, T))).toEqual({ day: D, moment: T });
    expect(parseSupplementNotificationId('supplement:2026-11-13T20:00')).toEqual({ day: D, moment: '20:00' });
  });

  it('tout autre identifiant : null (répétition, autre nature, date ou heure invalide, vide)', () => {
    for (const sid of [null, '', 'snooze:supplement:2026-11-13T08:00', 'bedtime:2026-11-13', 'supplement:2026-13-01T08:00', 'supplement:2026-11-13T25:00', 'supplement:2026-11-13', 'supplement:2026-11-13T08:00:00']) {
      expect(parseSupplementNotificationId(sid)).toBeNull();
    }
  });

  it('catégorie « complément » : une seule action, « done » (titre « Pris » côté textes)', () => {
    expect(ACTION_TYPE_ID.supplement).toBe('sp.supplement');
    expect(SUPPLEMENT_ACTION_TYPE_ID).toBe('sp.supplement');
    expect(ACTIONS_BY_CATEGORY.supplement).toEqual(['done']);
  });
});

describe('prises à cocher pour (jour, moment)', () => {
  it('les compléments dus à ce moment et pas encore cochés, dans l’ordre des prises dues', () => {
    const intakes: SupplementIntake[] = [{ supplementId: B, date: D, moment: T }];
    expect(intakesToTake([sup(A), sup(B), sup(C, { times: ['20:00' as LocalTime] })], intakes, D, T)).toEqual([A]);
  });

  it('en pause, jour non prévu, pas encore créé, tout coché : rien', () => {
    expect(intakesToTake([sup(A, { active: false })], [], D, T)).toEqual([]);
    expect(intakesToTake([sup(A, { days: 1 })], [], D, T)).toEqual([]); // 13/11/2026 : vendredi
    expect(intakesToTake([sup(A, { since: '2026-11-14' as LocalDate })], [], D, T)).toEqual([]);
    expect(intakesToTake([sup(A)], [{ supplementId: A, date: D, moment: T }], D, T)).toEqual([]);
  });
});

describe('file locale des actions « Pris » (notifications.actionQueue)', () => {
  it('reçoit les « done » de complément ; les autres lignes sont ignorées et comptées', () => {
    const got = receiveSupplementActions(EMPTY_ACTION_QUEUE, [raw(), raw({ actionId: 'snooze15' }), raw({ sid: 'bedtime:2026-11-13' }), raw({ sid: null })], 0, NOW);
    expect(got.queue.entries).toHaveLength(1);
    expect(got.ignored).toBe(3);
    expect(supplementActionTodo(got.queue)).toEqual([{ entry: got.queue.entries[0], day: D, moment: T }]);
  });

  it('idempotence : la même ligne relue (acquittement perdu) ou déjà appliquée n’est jamais inscrite deux fois', () => {
    const first = receiveSupplementActions(EMPTY_ACTION_QUEUE, [raw(), raw()], 0, NOW);
    expect(first.queue.entries).toHaveLength(1);
    expect(first.duplicates).toBe(1);
    const key = first.queue.entries[0]?.key ?? '';
    const applied = settleSupplementAction(first.queue, key, 'applied', NOW);
    expect(applied.entries).toEqual([]);
    expect(applied.applied.map((a) => a.key)).toEqual([key]);
    const replay = receiveSupplementActions(applied, [raw()], 0, NOW + 1000);
    expect(replay.queue.entries).toEqual([]);
    expect(replay.duplicates).toBe(1);
    expect(supplementActionTodo(replay.queue)).toEqual([]);
  });

  it('échec : l’entrée reste, essai compté, erreur gardée (rejouée au passage suivant) ; lignes perdues comptées', () => {
    const got = receiveSupplementActions(EMPTY_ACTION_QUEUE, [raw()], 2, NOW);
    expect(got.queue.lost).toBe(2);
    const key = got.queue.entries[0]?.key ?? '';
    const failed = settleSupplementAction(got.queue, key, 'apply-failed', NOW);
    expect(failed.entries).toEqual([{ ...got.queue.entries[0], tries: 1, lastError: 'apply-failed' }]);
    expect(supplementActionTodo(failed)).toHaveLength(1);
  });
});
