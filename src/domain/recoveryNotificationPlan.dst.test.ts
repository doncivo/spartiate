import { describe, expect, it } from 'vitest';
import { planRecoveryNotifications } from './recoveryNotificationPlan';
import type { LocalDateTime } from './types';

/** NUTRI-0292 (C-062, rappel à heure inexistante) : le coucher de 03:00 donne un rappel à 02:30, heure qui n'existe pas le jour du passage à l'heure d'été (Paris, 29/03/2026) ; il se déclenche à 03:30. */
const plan = (now: string, zone?: string) =>
  planRecoveryNotifications({ now: now as LocalDateTime, bedtime: true, morning: false, bedtimeTime: '03:00', morningReady: false, ...(zone === undefined ? {} : { zone }) });

describe('rappel de coucher à heure inexistante', () => {
  it('03:10 le jour du saut : le rappel de 02:30 (déclenché à 03:30) reste planifié', () => {
    expect(plan('2026-03-29T03:10', 'Europe/Paris').items.map((i) => i.fireAt)).toContain('2026-03-29T02:30');
  });
  it('03:40 : le rappel décalé à 03:30 est passé', () => {
    expect(plan('2026-03-29T03:40', 'Europe/Paris').items.map((i) => i.fireAt)).not.toContain('2026-03-29T02:30');
  });
  it('sans fuseau : comparaison flottante inchangée', () => {
    expect(plan('2026-03-29T03:10').items.map((i) => i.fireAt)).not.toContain('2026-03-29T02:30');
  });
});
