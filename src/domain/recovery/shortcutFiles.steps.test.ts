import { describe, expect, it } from 'vitest';
import { lacksFinalNewline, parseShortcutSteps } from './shortcutFiles';

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

/** NUTRI-0299 (BL-172, D-664, D-680) : remplace la limite figée par NUTRI-0292 (« même lecture avec ou sans saut de ligne final »). */
describe('C-056, BL-172 : saut de ligne final exigé des fichiers du raccourci « Spartiate — récupération »', () => {
  const LF = '\n';
  const CR = '\r';
  const BOM = '﻿';
  it('fichier sans saut de ligne final : refusé (une dernière ligne coupée en pleine valeur ne peut plus être lue comme juste)', () => {
    expect(lacksFinalNewline(day('4000') + LF + day('1000'))).toBe(true);
    expect(lacksFinalNewline(day('4000'))).toBe(true);
  });
  it('fichier terminé par LF ou CRLF, éventuellement suivi d\'espaces ou précédé d\'un BOM : accepté, même lecture des lignes', () => {
    for (const end of [LF, CR + LF, LF + '  ', LF + '\t']) expect(lacksFinalNewline(day('4000') + LF + day('1000') + end)).toBe(false);
    expect(lacksFinalNewline(BOM + day('4000') + LF)).toBe(false);
    expect(stepsOf(day('4000') + LF + day('1000') + LF).days).toEqual([{ day: '2026-11-07', steps: 5000 }]);
  });
  it('fichier vide ou blanc (aucune donnée sur 30 jours) : jamais refusé', () => {
    for (const text of ['', BOM, '   ', LF, CR + LF]) expect(lacksFinalNewline(text)).toBe(false);
  });
});
