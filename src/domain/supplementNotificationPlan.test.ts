import { describe, expect, it } from 'vitest';
import { parseNotificationLedger } from './notificationLedger';
import { ALL_DAYS, type Supplement, type SupplementIntake } from './nutrition/supplements';
import { planSupplementNotifications, SUPPLEMENT_HORIZON_DAYS, supplementNotificationId } from './supplementNotificationPlan';
import type { LocalDate, LocalDateTime, LocalTime } from './types';

/** I6-05 (D-212) : plan pur des rappels de compléments (iPhone) ; sortie sans texte ni nom. */
const t = (s: string): LocalTime => s as LocalTime;
const sup = (over: Partial<Supplement> = {}): Supplement => ({
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Créatine',
  dose: null,
  unit: null,
  times: [t('08:00'), t('20:00')],
  days: ALL_DAYS,
  active: true,
  since: '2026-11-01' as LocalDate,
  ...over,
});
const B = sup({ id: '30000000-0000-4000-8000-000000000002', name: 'Zinc', times: [t('20:00')] });
const now = (s: string) => s as LocalDateTime;
const take = (s: Supplement, date: string, moment: string): SupplementIntake => ({ supplementId: s.id, date: date as LocalDate, moment: t(moment) });

describe('registre local des notifications', () => {
  it('une entrée de nature « supplement » est lisible (sinon le registre serait reconstruit à chaque passage)', () => {
    const ledger = { v: 1, zone: 'Europe/Paris', focusEnd: null, entries: [{ n: 70000, sid: 'supplement:2026-11-13T08:00', at: 1, h: 'ab', kind: 'supplement' }] };
    expect(parseNotificationLedger(ledger).state).toBe('valid');
  });
});

describe('planSupplementNotifications', () => {
  it('désactivé : rien', () => {
    expect(planSupplementNotifications({ now: now('2026-11-13T07:00'), enabled: false, supplements: [sup()], intakes: [] })).toEqual({ items: [], total: 0 });
  });

  it('une notification par heure de prise et par jour, regroupant les compléments, sur 3 jours, heures passées exclues', () => {
    const plan = planSupplementNotifications({ now: now('2026-11-13T09:00'), enabled: true, supplements: [sup(), B], intakes: [] });
    expect(SUPPLEMENT_HORIZON_DAYS).toBe(3);
    expect(plan.items.map((i) => [i.id, i.fireAt, i.count])).toEqual([
      ['supplement:2026-11-13T20:00', '2026-11-13T20:00', 2],
      ['supplement:2026-11-14T08:00', '2026-11-14T08:00', 1],
      ['supplement:2026-11-14T20:00', '2026-11-14T20:00', 2],
      ['supplement:2026-11-15T08:00', '2026-11-15T08:00', 1],
      ['supplement:2026-11-15T20:00', '2026-11-15T20:00', 2],
    ]);
    expect(plan.items.every((i) => i.kind === 'supplement')).toBe(true);
    expect(supplementNotificationId('2026-11-13' as LocalDate, t('20:00'))).toBe('supplement:2026-11-13T20:00');
  });

  it('prises déjà cochées : comptées en moins ; tout coché : heure omise', () => {
    const plan = planSupplementNotifications({ now: now('2026-11-13T07:00'), enabled: true, supplements: [sup(), B], intakes: [take(sup(), '2026-11-13', '08:00'), take(B, '2026-11-13', '20:00')] });
    expect(plan.items.slice(0, 2).map((i) => [i.id, i.count])).toEqual([['supplement:2026-11-13T20:00', 1], ['supplement:2026-11-14T08:00', 1]]);
  });

  it('pause, jours non prévus et complément créé plus tard : jamais rappelés', () => {
    const friday = 16; // 2026-11-13 est un vendredi
    const plan = planSupplementNotifications({
      now: now('2026-11-13T07:00'),
      enabled: true,
      supplements: [sup({ days: friday }), sup({ id: '30000000-0000-4000-8000-000000000003', active: false }), sup({ id: '30000000-0000-4000-8000-000000000004', since: '2026-11-20' as LocalDate })],
      intakes: [],
    });
    expect(plan.items.map((i) => i.id)).toEqual(['supplement:2026-11-13T08:00', 'supplement:2026-11-13T20:00']);
  });

  it('plafond : la fin du plan est coupée, le total dit combien il y avait de candidats ; heure invalide : plan vide', () => {
    const plan = planSupplementNotifications({ now: now('2026-11-13T07:00'), enabled: true, supplements: [sup()], intakes: [], limit: 2 });
    expect(plan.items.map((i) => i.id)).toEqual(['supplement:2026-11-13T08:00', 'supplement:2026-11-13T20:00']);
    expect(plan.total).toBe(6);
    expect(planSupplementNotifications({ now: now('2026-11-13T07:00'), enabled: true, supplements: [sup()], intakes: [], limit: 0 }).items).toEqual([]);
    expect(planSupplementNotifications({ now: now('n’importe quoi'), enabled: true, supplements: [sup()], intakes: [] })).toEqual({ items: [], total: 0 });
  });
});
