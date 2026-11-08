import { describe, expect, it } from 'vitest';
import { ciqualSearchable, parseCiqualCatalogue } from './ciqual';

/** I4-02 : lecture défensive du catalogue Ciqual embarqué (JSON non fiable tant que non validé) ; données synthétiques. */

const raw = (): Record<string, unknown> => ({
  schemaVersion: 1,
  source: { name: 'Table synthétique', publisher: 'Anses', version: '2025-11-03', doi: '10.57745/RDMHWY', licence: 'Licence Ouverte Etalab 2.0', url: 'https://doi.org/10.57745/RDMHWY', attribution: 'Source : Anses.' },
  groups: [{ code: '01', nameFr: 'groupe' }],
  foods: [
    { code: '9001', nameFr: 'Aliment A', group: '01', kcal: 50, proteinG: 1, fatG: null, carbG: 10, fiberG: 2 },
    { code: '9002', nameFr: 'Aliment B', group: '01', kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null },
  ],
});

describe('parseCiqualCatalogue', () => {
  it('contenu valide : aliments, groupes et source conservés ; null reste null', () => {
    const c = parseCiqualCatalogue(raw());
    expect(c?.foods).toHaveLength(2);
    expect(c?.foods[0]).toEqual({ code: '9001', nameFr: 'Aliment A', group: '01', per100g: { kcal: 50, proteinG: 1, fatG: null, carbG: 10, fiberG: 2 } });
    expect(c?.source.licence).toBe('Licence Ouverte Etalab 2.0');
    expect(c?.source.version).toBe('2025-11-03');
  });
  it('refus : pas un objet, mauvaise version, aliment mal formé, valeur négative ou texte, doublon', () => {
    expect(parseCiqualCatalogue(null)).toBeNull();
    expect(parseCiqualCatalogue([])).toBeNull();
    expect(parseCiqualCatalogue({ ...raw(), schemaVersion: 2 })).toBeNull();
    const bad = (mutate: (d: Record<string, unknown>) => void): unknown => {
      const d = raw();
      mutate(d);
      return parseCiqualCatalogue(d);
    };
    expect(bad((d) => ((d['foods'] as Record<string, unknown>[])[0]!['code'] = 'abc'))).toBeNull();
    expect(bad((d) => ((d['foods'] as Record<string, unknown>[])[0]!['kcal'] = -1))).toBeNull();
    expect(bad((d) => ((d['foods'] as Record<string, unknown>[])[0]!['kcal'] = '50'))).toBeNull();
    expect(bad((d) => ((d['foods'] as Record<string, unknown>[])[0]!['nameFr'] = ''))).toBeNull();
    expect(bad((d) => (d['foods'] as unknown[]).push((d['foods'] as unknown[])[0]))).toBeNull();
    expect(bad((d) => delete d['source'])).toBeNull();
  });
});

describe('ciqualSearchable', () => {
  it('référence « ciqual:<code> », provenance Ciqual, sans marque ni code-barres', () => {
    const c = parseCiqualCatalogue(raw());
    if (!c) throw new Error('catalogue');
    expect(ciqualSearchable(c)[0]).toEqual({ ref: 'ciqual:9001', provenance: 'ciqual', name: 'Aliment A', brand: null, barcode: null, per100g: { kcal: 50, proteinG: 1, fatG: null, carbG: 10, fiberG: 2 } });
  });
});
