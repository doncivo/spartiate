import { describe, expect, it } from 'vitest';
import { planRecoveryNotifications } from './recoveryNotificationPlan';
import type { LocalDateTime } from './types';

/**
 * NUTRI-0292 (C-062, « rappel à heure inexistante ») : le matin est fixe à 08:00 (jamais dans l'heure sautée), et le rappel de
 * coucher de la nuit du saut d'heure d'été (Paris, 29/03/2026 : 02:30 n'existe pas) est planifié dès la veille au soir ; le plan ne sait pas ce qu'est
 * un fuseau et ne perd donc jamais ce rappel (il est planifié bien avant l'heure sautée).
 */
const plan = (now: string) => planRecoveryNotifications({ now: now as LocalDateTime, bedtime: true, morning: false, bedtimeTime: '03:00', morningReady: false });

describe('rappel de coucher et saut d\'heure', () => {
  it('la veille au soir, le rappel de 02:30 du jour du saut est planifié', () => {
    expect(plan('2026-03-28T22:00').items.map((i) => i.fireAt)).toContain('2026-03-29T02:30');
  });
  it('le matin fixe à 08:00 n\'est jamais dans l\'heure sautée', () => {
    const r = planRecoveryNotifications({ now: '2026-03-29T01:00' as LocalDateTime, bedtime: false, morning: true, bedtimeTime: null, morningReady: true });
    expect(r.items.map((i) => i.fireAt)).toEqual(['2026-03-29T08:00']);
  });
});

/**
 * C-062 (c), défaut confirmé à la relecture : le 29/03/2026 (Paris), un rappel de 02:30 n'existe pas et se déclenche à 03:30. Un recalcul à 03:10 comparait
 * 02:30 > 03:10 en heure flottante : rappel jugé passé alors qu'il se déclenche dans 20 minutes, donc perdu.
 */
describe('rappel de coucher dans l\'heure sautée (zone connue)', () => {
  const zoned = (now: string) => planRecoveryNotifications({ now: now as LocalDateTime, bedtime: true, morning: false, bedtimeTime: '03:00', morningReady: false, zone: 'Europe/Paris' });
  it('recalcul à 03:10 le jour du saut : le rappel de 02:30 (déclenché à 03:30) est gardé', () => {
    expect(zoned('2026-03-29T03:10').items.map((i) => i.fireAt)).toContain('2026-03-29T02:30');
  });
  it('recalcul à 03:40 : il est bien passé', () => {
    expect(zoned('2026-03-29T03:40').items.map((i) => i.fireAt)).not.toContain('2026-03-29T02:30');
  });
});
