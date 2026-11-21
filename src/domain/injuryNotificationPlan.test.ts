import { describe, expect, it } from 'vitest';
import { declareInjury, markHealed, type InjuriesValue } from './training/injuries';
import { INJURY_FIRE_TIME, injuryNotificationId, planInjuryNotifications } from './injuryNotificationPlan';
import type { LocalDate, LocalDateTime } from './types';

const d = (s: string): LocalDate => s as LocalDate;
const at = (s: string): LocalDateTime => s as LocalDateTime;
const declare = (value: InjuriesValue, id: string, startedOn: string): InjuriesValue => {
  const r = declareInjury(value, { id, muscleId: 'shoulders', patterns: [], startedOn: d(startedOn), note: null }, d('2026-12-31'));
  if (!r.ok) throw new Error(r.issue);
  return r.value;
};
const EMPTY: InjuriesValue = { v: 1, items: [] };

describe('planInjuryNotifications (iPhone, ADR 0012)', () => {
  it('aucune gêne active : rien', () => {
    expect(planInjuryNotifications({ now: at('2026-11-01T08:00'), injuries: EMPTY })).toEqual({ items: [], total: 0 });
    expect(planInjuryNotifications({ now: at('2026-11-01T08:00'), injuries: markHealed(declare(EMPTY, 'a', '2026-11-01'), 'a', d('2026-11-02')) }).items).toEqual([]);
  });
  it("une notification à 09:00 au jour d'échéance (début + 14 jours)", () => {
    const plan = planInjuryNotifications({ now: at('2026-11-02T08:00'), injuries: declare(EMPTY, 'a', '2026-11-01') });
    expect(INJURY_FIRE_TIME).toBe('09:00');
    expect(plan.items).toEqual([{ kind: 'injury', id: injuryNotificationId(d('2026-11-15')), fireAt: '2026-11-15T09:00' }]);
  });
  it("échéance dépassée : aujourd'hui à 09:00 si pas encore passé, sinon rien (la carte suffit)", () => {
    const injuries = declare(EMPTY, 'a', '2026-10-01');
    expect(planInjuryNotifications({ now: at('2026-11-20T08:00'), injuries }).items.map((i) => i.fireAt)).toEqual(['2026-11-20T09:00']);
    expect(planInjuryNotifications({ now: at('2026-11-20T09:00'), injuries }).items).toEqual([]);
  });
  it('deux gênes le même jour : une seule notification', () => {
    const injuries = declare(declare(EMPTY, 'a', '2026-11-01'), 'b', '2026-11-01');
    expect(planInjuryNotifications({ now: at('2026-11-02T08:00'), injuries }).items).toHaveLength(1);
  });
  it('plafond : limit coupe, total garde les candidats', () => {
    const injuries = declare(declare(EMPTY, 'a', '2026-11-01'), 'b', '2026-11-03');
    const plan = planInjuryNotifications({ now: at('2026-11-04T08:00'), injuries, limit: 1 });
    expect(plan.items.map((i) => i.fireAt)).toEqual(['2026-11-15T09:00']);
    expect(plan.total).toBe(2);
    expect(planInjuryNotifications({ now: at('2026-11-04T08:00'), injuries, limit: 0 }).items).toEqual([]);
  });
  it('heure illisible : rien, sans lever', () => {
    expect(planInjuryNotifications({ now: at('nimporte'), injuries: declare(EMPTY, 'a', '2026-11-01') })).toEqual({ items: [], total: 0 });
  });
});
