import { describe, expect, it } from 'vitest';
import { localDayAt, parseShortcutHrv, parseShortcutSteps } from './shortcutFiles';

/** NUTRI-0292 (C-058, D-478) : le jour d'une mesure est calculé dans le fuseau où elle a été prise (décalage enregistré avec elle). Valeurs inventées. */
const PARIS = 'Europe/Paris';

describe('C-058 : jour dans le fuseau de la mesure', () => {
  it('localDayAt : instant et décalage (minutes)', () => {
    const at = Date.parse('2026-11-08T04:30:00Z');
    expect(localDayAt(at, -300)).toBe('2026-11-07'); // 23:30 à UTC-5
    expect(localDayAt(at, 60)).toBe('2026-11-08');
    expect(localDayAt(at, 14 * 60)).toBe('2026-11-08');
  });

  it('mesure prise à UTC-5, appareil à Paris : jour du fuseau de la mesure, décalage gardé avec l\'échantillon', () => {
    const r = parseShortcutHrv('2026-11-07T23:30:00-05:00;50 ms', '2026-11-08', PARIS);
    expect(r.samples).toEqual([{ measuredAt: '2026-11-08T04:30:00.000Z', day: '2026-11-07', value: 50, offsetMin: -300 }]);
  });

  it('décalage demi-heure : +05:30', () => {
    const r = parseShortcutHrv('2026-11-07T01:15:00+05:30;48 ms', '2026-11-08', PARIS);
    expect(r.samples[0]).toMatchObject({ day: '2026-11-07', offsetMin: 330 });
  });

  it('« Z » : décalage inconnu, calcul actuel (fuseau de l\'appareil), pas de décalage gardé', () => {
    const r = parseShortcutHrv('2026-11-07T23:30:00Z;50 ms', '2026-11-08', PARIS);
    expect(r.samples[0]).toMatchObject({ day: '2026-11-08', offsetMin: null });
  });

  it('pas : sommés par jour de la mesure', () => {
    const r = parseShortcutSteps('2026-11-07T23:30:00-05:00;1000\n2026-11-07T09:00:00-05:00;2000', '2026-11-08', PARIS);
    expect(r.days).toEqual([{ day: '2026-11-07', steps: 3000 }]);
  });
});
