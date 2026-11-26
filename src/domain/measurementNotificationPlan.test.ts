import { describe, expect, it } from 'vitest';
import { measurementNotificationId, parseMeasurementReminder, planMeasurementNotifications, MEASUREMENT_FIRE_TIME } from './measurementNotificationPlan';
import type { LocalDate, LocalDateTime } from './types';

/** CORPS-0301d (BL-180, D-714) : plan pur du rappel des mesures. Valeurs inventées. */
const D = (s: string) => s as LocalDate;
const at = (s: string) => s as LocalDateTime;
const waist = (date: string) => ({ kind: 'waist', date: D(date) });

describe('planMeasurementNotifications', () => {
  it('une notification à 09:00 le jour prévu (dernière + rythme)', () => {
    const plan = planMeasurementNotifications({ now: at('2026-11-10T20:00'), enabled: true, rhythm: 7, samples: [waist('2026-11-08')] });
    expect(MEASUREMENT_FIRE_TIME).toBe('09:00');
    expect(plan).toEqual({ items: [{ kind: 'measurement', id: 'measurement:2026-11-15', fireAt: '2026-11-15T09:00' }], total: 1 });
  });

  it('le rythme de 14 et de 28 jours déplace l’échéance', () => {
    expect(planMeasurementNotifications({ now: at('2026-11-10T08:00'), enabled: true, rhythm: 14, samples: [waist('2026-11-08')] }).items[0]?.id).toBe('measurement:2026-11-22');
    expect(planMeasurementNotifications({ now: at('2026-11-10T08:00'), enabled: true, rhythm: 28, samples: [waist('2026-11-08')] }).items[0]?.id).toBe('measurement:2026-12-06');
  });

  it('échéance dépassée : aujourd’hui à 09:00 si l’heure n’est pas passée, sinon rien', () => {
    const samples = [waist('2026-10-01')];
    expect(planMeasurementNotifications({ now: at('2026-11-10T08:59'), enabled: true, rhythm: 7, samples }).items).toEqual([{ kind: 'measurement', id: 'measurement:2026-11-10', fireAt: '2026-11-10T09:00' }]);
    expect(planMeasurementNotifications({ now: at('2026-11-10T09:00'), enabled: true, rhythm: 7, samples }).items).toEqual([]);
  });

  it('échéance aujourd’hui après 09:00 : rien', () => {
    expect(planMeasurementNotifications({ now: at('2026-11-15T10:00'), enabled: true, rhythm: 7, samples: [waist('2026-11-08')] }).items).toEqual([]);
  });

  it('rappel coupé, aucune mesure, ou seulement des genres importés et des notes : rien', () => {
    const now = at('2026-11-10T08:00');
    expect(planMeasurementNotifications({ now, enabled: false, rhythm: 7, samples: [waist('2026-11-08')] }).items).toEqual([]);
    expect(planMeasurementNotifications({ now, enabled: true, rhythm: 7, samples: [] }).items).toEqual([]);
    const others = [{ kind: 'health_waist_cm', date: D('2026-11-08') }, { kind: 'note_fatigue', date: D('2026-11-08') }, { kind: 'visbody_weight_kg', date: D('2026-11-08') }];
    expect(planMeasurementNotifications({ now, enabled: true, rhythm: 7, samples: others }).items).toEqual([]);
  });

  it('plafond (fenêtre des 64) : limite 0 = rien, total gardé ; instant illisible : rien, sans lever', () => {
    expect(planMeasurementNotifications({ now: at('2026-11-10T08:00'), enabled: true, rhythm: 7, samples: [waist('2026-11-08')], limit: 0 })).toEqual({ items: [], total: 1 });
    expect(planMeasurementNotifications({ now: at('pas une date'), enabled: true, rhythm: 7, samples: [waist('2026-11-08')] })).toEqual({ items: [], total: 0 });
  });

  it('identifiant stable', () => {
    expect(measurementNotificationId(D('2026-11-15'))).toBe('measurement:2026-11-15');
  });
});

describe('parseMeasurementReminder', () => {
  it('actif par défaut ; seul `false` le coupe', () => {
    expect(parseMeasurementReminder(null)).toBe(true);
    expect(parseMeasurementReminder(undefined)).toBe(true);
    expect(parseMeasurementReminder('false')).toBe(true);
    expect(parseMeasurementReminder(0)).toBe(true);
    expect(parseMeasurementReminder(true)).toBe(true);
    expect(parseMeasurementReminder(false)).toBe(false);
  });
});
