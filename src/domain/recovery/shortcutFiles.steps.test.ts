import { describe, expect, it } from 'vitest';
import { parseShortcutSteps } from './shortcutFiles';

/** NUTRI-0292 (C-057, C-056) : pas.csv. Valeurs inventées. H-25 reste UNVERIFIED (format réel de pas.csv). */
const day = (v: string) => `2026-11-07T08:00:00+01:00;${v}`;
const stepsOf = (text: string) => parseShortcutSteps(text, '2026-11-08', 'Europe/Paris');

describe('C-057 : séparateur de milliers', () => {
  it('« 1,234 » et « 12,345 » (milliers à l\'anglaise) : 1 234 et 12 345 pas, jamais 1 pas', () => {
    expect(stepsOf(day('1,234')).days).toEqual([{ day: '2026-11-07', steps: 1234 }]);
    expect(stepsOf(day('12,345')).days).toEqual([{ day: '2026-11-07', steps: 12345 }]);
  });
  it('« 12.345 » (milliers à la française au point) : 12 345', () => {
    expect(stepsOf(day('12.345')).days).toEqual([{ day: '2026-11-07', steps: 12345 }]);
  });
  it('un entier simple et une décimale d\'un chiffre restent lus comme avant', () => {
    expect(stepsOf(day('4000')).days[0]?.steps).toBe(4000);
    expect(stepsOf(day('4000,4')).days[0]?.steps).toBe(4000);
  });
});

describe('C-056 : dernière ligne sans saut de ligne', () => {
  it('fichier terminé ou non par un saut de ligne : même lecture (limite connue : une coupure en pleine valeur est indiscernable, voir la fiche)', () => {
    const a = stepsOf(`${day('4000')}\n${day('1000')}\n`);
    const b = stepsOf(`${day('4000')}\n${day('1000')}`);
    expect(a.days).toEqual(b.days);
  });
});
