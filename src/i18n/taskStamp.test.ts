import { describe, expect, it } from 'vitest';
import { formatStamp } from './format';


describe('UI-FIX-02 : horodatage de création', () => {
  it.each([0, 1, 3])('une seule préposition, date distante de %i jours', (days) => {
    const now = new Date(2026, 9, 24, 12).getTime();
    const created = formatStamp(new Date(2026, 9, 24 - days, 10).toISOString(), now);
    // COQUILLE-PC : libellé « Créée … · modifiée … » hérité de CircleTasks retiré du départ ; la règle de l'horodatage reste gardée.
    expect(created).not.toContain('le le');
    expect(created).not.toMatch(/le (aujourd’hui|aujourd'hui|hier)/);
  });
});
