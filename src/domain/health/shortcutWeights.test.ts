import { describe, expect, it } from 'vitest';
import { parseShortcutWeights } from './shortcutWeights';

/** Fichier écrit par le raccourci « Spartiate — poids » (D-69) : une ligne par pesée de Santé, `date;valeur[;unité]`. */
const TODAY = '2026-11-08';

describe('parseShortcutWeights', () => {
  it('lit les dates ISO avec décalage et les décimales à virgule ; une pesée par jour, la plus récente', () => {
    const r = parseShortcutWeights('date;kg\n2026-11-07T07:12:00+01:00;81,4\n2026-11-07T21:30:00+01:00;82,0\n2026-11-08T06:50:00+01:00;81.2 kg\n', TODAY);
    expect(r.weights).toEqual([
      { measuredAt: '2026-11-07T20:30:00.000Z', kg: 82 },
      { measuredAt: '2026-11-08T05:50:00.000Z', kg: 81.2 },
    ]);
    expect(r.rejected).toBe(0);
  });

  it('convertit les livres ; ignore les lignes vides et l’en-tête', () => {
    const r = parseShortcutWeights('\r\n2026-11-08T06:50:00Z;180;lb\r\n\r\n', TODAY);
    expect(r.weights).toEqual([{ measuredAt: '2026-11-08T06:50:00.000Z', kg: 81.65 }]);
  });

  it('accepte la tabulation comme séparateur', () => {
    expect(parseShortcutWeights('2026-11-08T06:50:00+01:00\t81,4', TODAY).weights).toHaveLength(1);
  });

  it('refuse sans planter : date sans fuseau, date future, valeur hors bornes, unité inconnue, ligne illisible', () => {
    const r = parseShortcutWeights(['2026-11-08 06:50;81', '2026-11-12T06:50:00Z;81', '2026-11-08T06:50:00Z;5', '2026-11-08T06:50:00Z;81;st', 'n’importe quoi', '2026-11-08T06:50:00Z;abc'].join('\n'), TODAY);
    expect(r.weights).toEqual([]);
    expect(r.rejected).toBe(6);
  });

  it('borne la taille : au plus 1 000 lignes lues', () => {
    const lines = Array.from({ length: 1500 }, (_, i) => `2026-01-01T06:00:00Z;${(60 + (i % 10)).toString()}`);
    const r = parseShortcutWeights(lines.join('\n'), TODAY);
    expect(r.truncated).toBe(true);
  });
});
