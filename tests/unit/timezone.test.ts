import { describe, expect, it } from 'vitest';

// C-178 : le fuseau des tests est fixé (Europe/Paris, celui de l'app et de Playwright), jamais celui du poste ou du runner.
describe('C-178 : fuseau horaire des tests fixé', () => {
  it('TZ vaut Europe/Paris dans le worker', () => {
    expect(process.env['TZ']).toBe('Europe/Paris');
  });
  it('le fuseau effectif est Europe/Paris, heure d\'été comprise', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Paris');
    expect(new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset()).toBe(-60);
    expect(new Date(Date.UTC(2026, 6, 15, 12)).getTimezoneOffset()).toBe(-120);
  });
});
