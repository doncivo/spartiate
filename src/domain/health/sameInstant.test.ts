import { describe, expect, it } from 'vitest';
import { parseBodyFile } from './bodyShortcutFiles';
import { parseShortcutWeights } from './shortcutWeights';

/** NUTRI-0292 (C-055) : deux valeurs au même instant : le résultat ne dépend pas de l'ordre des lignes (la plus grande). Valeurs inventées. */
const A = '2026-11-07T08:00:00+01:00;81,0';
const B = '2026-11-07T08:00:00+01:00;82,0';

describe('C-055 : même instant', () => {
  it('poids.csv Raccourcis : même résultat dans les deux ordres', () => {
    const ab = parseShortcutWeights(`${A}\n${B}`, '2026-11-08', 'Europe/Paris').weights;
    const ba = parseShortcutWeights(`${B}\n${A}`, '2026-11-08', 'Europe/Paris').weights;
    expect(ab).toEqual(ba);
    expect(ab.map((w) => w.kg)).toEqual([82]);
  });
  it('fichier du dossier de Santé : même résultat dans les deux ordres', () => {
    const ab = parseBodyFile('poids.csv', `${A}\n${B}`, '2026-11-08', 'Europe/Paris');
    const ba = parseBodyFile('poids.csv', `${B}\n${A}`, '2026-11-08', 'Europe/Paris');
    expect(ab.days).toEqual(ba.days);
    expect(ab.days.map((d) => d.value)).toEqual([82]);
  });
  it('instants différents : le plus récent gagne toujours', () => {
    const r = parseShortcutWeights('2026-11-07T08:00:00+01:00;81,0\n2026-11-07T09:00:00+01:00;79,0', '2026-11-08', 'Europe/Paris');
    expect(r.weights.map((w) => w.kg)).toEqual([79]);
  });
});
