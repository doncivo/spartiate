import { describe, expect, it } from 'vitest';
import { parseShortcutWeights } from './shortcutWeights';

/** NUTRI-0292 (C-054, C-053) : pesées Raccourcis. Valeurs inventées. */
describe('C-054 : 3e colonne vide', () => {
  it('« date;valeur; » : unité absente, kg par défaut, comme le lecteur du dossier de Santé', () => {
    const r = parseShortcutWeights('2026-11-07T08:00:00+01:00;81,4;', '2026-11-08', 'Europe/Paris');
    expect(r.rejected).toBe(0);
    expect(r.weights.map((w) => w.kg)).toEqual([81.4]);
  });
  it('unité réelle toujours lue (lb) et unité inconnue toujours refusée', () => {
    expect(parseShortcutWeights('2026-11-07T08:00:00+01:00;180;lb', '2026-11-08', 'Europe/Paris').weights[0]?.kg).toBe(81.65);
    expect(parseShortcutWeights('2026-11-07T08:00:00+01:00;80;st', '2026-11-08', 'Europe/Paris').rejected).toBe(1);
  });
});

describe('C-053 : fuseau invalide', () => {
  it('lignes rejetées, aucune exception', () => {
    const r = parseShortcutWeights('2026-11-07T08:00:00+01:00;81,4', '2026-11-08', 'Nulle/Part');
    expect(r.weights).toEqual([]);
    expect(r.rejected).toBe(1);
  });
});
