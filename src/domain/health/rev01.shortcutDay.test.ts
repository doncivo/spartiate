import { describe, expect, it } from 'vitest';
import { parseShortcutWeights } from './shortcutWeights';

/** REV-01 constat 9 : une seule notion de jour, le jour local de l'appareil, pour le dédoublonnage et pour l'enregistrement. */
describe('REV-01 constat 9 : jour local de l’appareil', () => {
  it('les deux instants du rapport (décalages différents) sont deux jours sur un appareil Europe/Paris', () => {
    const r = parseShortcutWeights('2026-11-08T00:30:00+09:00;80\n2026-11-08T23:30:00-08:00;82', '2026-11-09', 'Europe/Paris');
    expect(r.rejected).toBe(0);
    expect(r.weights).toEqual([
      { measuredAt: '2026-11-07T15:30:00.000Z', kg: 80 },
      { measuredAt: '2026-11-09T07:30:00.000Z', kg: 82 },
    ]);
  });

  it('deux pesées du même jour local, écrites avec des décalages différents, restent une seule pesée (la plus récente)', () => {
    const r = parseShortcutWeights('2026-11-07T07:00:00+01:00;81\n2026-11-07T20:00:00Z;82', '2026-11-09', 'Europe/Paris');
    expect(r.weights).toEqual([{ measuredAt: '2026-11-07T20:00:00.000Z', kg: 82 }]);
  });

  it('passage à l’heure d’hiver (25 octobre 2026, Paris) : minuit local et 23 h 30 locales du même jour se regroupent, le lendemain reste distinct', () => {
    const r = parseShortcutWeights('2026-10-24T22:30:00Z;80\n2026-10-25T22:30:00Z;81\n2026-10-25T23:30:00Z;82', '2026-11-08', 'Europe/Paris');
    expect(r.weights).toEqual([
      { measuredAt: '2026-10-25T22:30:00.000Z', kg: 81 },
      { measuredAt: '2026-10-25T23:30:00.000Z', kg: 82 },
    ]);
  });

  it('une pesée du lendemain local (dans le futur à Paris) est refusée, pas enregistrée un autre jour', () => {
    const r = parseShortcutWeights('2026-11-08T23:30:00Z;81', '2026-11-08', 'Europe/Paris');
    expect(r.weights).toEqual([]);
    expect(r.rejected).toBe(1);
  });
});
