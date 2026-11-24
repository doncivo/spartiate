import { describe, expect, it } from 'vitest';
import { parseWeightItem, parseWeightList } from './weightList';

describe('SEANCE-0292 (C-066) : liste de poids d’un profil de matériel', () => {
  it('points-virgules ; virgule décimale ; vide : liste vide', () => {
    expect(parseWeightList('20 ; 10 ; 1,25 ; 0.5')).toEqual({ ok: true, values: [20, 10, 1.25, 0.5] });
    expect(parseWeightList('  ')).toEqual({ ok: true, values: [] });
    expect(parseWeightList('12;16;;')).toEqual({ ok: true, values: [12, 16] });
  });

  it('« 12,16 » et « 20,1 » : refus « séparateur » (décimale hors des quarts de kilo), jamais 12,16 kg', () => {
    expect(parseWeightList('12,16')).toEqual({ ok: false, issue: 'separator', item: '12,16' });
    expect(parseWeightList('20 ; 20,1')).toEqual({ ok: false, issue: 'separator', item: '20,1' });
    expect(parseWeightList('12,16,20')).toEqual({ ok: false, issue: 'separator', item: '12,16,20' });
  });

  it('illisible, nul ou négatif : refus « invalide »', () => {
    for (const bad of ['x', '0', '-5', '1.1', '2,5 kg']) expect(parseWeightItem(bad).ok, bad).toBe(false);
    expect(parseWeightItem('x')).toEqual({ ok: false, issue: 'invalid' });
    expect(parseWeightItem('1.1')).toEqual({ ok: false, issue: 'invalid' });
  });
});
