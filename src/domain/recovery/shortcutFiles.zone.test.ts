import { describe, expect, it } from 'vitest';
import { parseShortcutHrv, parseShortcutSleep, parseShortcutSteps } from './shortcutFiles';

/** NUTRI-0292 (C-053) : un fuseau invalide est rejeté ligne par ligne (raison « no_timezone »), jamais une exception. */
describe('C-053 : fuseau invalide', () => {
  const hrv = '2026-11-07T08:00:00+01:00;55 ms\n2026-11-06T08:00:00+01:00;50 ms';
  it('HRV : toutes les lignes rejetées, aucune exception', () => {
    const r = parseShortcutHrv(hrv, '2026-11-08', 'Nulle/Part');
    expect(r.samples).toEqual([]);
    expect(r.rejected.no_timezone).toBe(2);
  });
  it('pas : idem', () => {
    expect(() => parseShortcutSteps('2026-11-07T08:00:00+01:00;4000', '2026-11-08', 'Nulle/Part')).not.toThrow();
  });
  it('sommeil : idem', () => {
    expect(() => parseShortcutSleep('2026-11-07T00:00:00+01:00;2026-11-07T07:00:00+01:00;core', '2026-11-08', 'Nulle/Part')).not.toThrow();
  });
  it('fuseau valide : inchangé', () => {
    expect(parseShortcutHrv(hrv, '2026-11-08', 'Europe/Paris').samples).toHaveLength(2);
  });
});
