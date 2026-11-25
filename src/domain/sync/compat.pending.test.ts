import { describe, expect, it } from 'vitest';
import type { Hlc } from '../types';
import { decideReintegration, type KeptField, type ReintegrationInput, type ReintegrationRow } from './compat';

/**
 * DATA-0293 (BL-099, D-26) : une ligne créée ICI et pas encore publiée (file d'envoi sur « * ») n'est pas une ligne « jamais écrite » : la création
 * locale est la valeur qui sera publiée, une valeur gardée plus ancienne ne la remplace pas (fusion ordinaire). Fonction pure, valeurs synthétiques.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const h = (ms: number, dev = A): Hlc => `${String(1_791_187_200_000 + ms).padStart(15, '0')}-0000-${dev}` as Hlc;
const kept = (value: string, hlc: Hlc): KeptField => ({ name: 'x', value, hlc, base: null, conflictVisible: true });
const row = (extra: Partial<ReintegrationRow> = {}): ReintegrationRow => ({ hlc: h(1_000, B), values: new Map([['x', null]]), clocks: new Map(), pending: new Set(), ...extra });
const input = (extra: Partial<ReintegrationInput>): ReintegrationInput => ({ fields: [], columns: ['a', 'x'], missingParents: new Set(), row: row(), tombstone: null, ...extra });

describe('decideReintegration : ligne créée ici, non publiée (BL-099)', () => {
  it('file d’envoi sur « * » et valeur gardée plus ancienne que la création : non écrite (dépassée)', () => {
    const d = decideReintegration(input({ fields: [kept('v', h(500))], row: row({ pending: new Set(['*']) }) }));
    expect({ write: d.write, reintegrated: d.reintegrated, superseded: d.superseded }).toEqual({ write: 'none', reintegrated: 0, superseded: 1 });
  });

  it('témoin : ligne déjà publiée (rien en file), même valeur gardée : écrite sans conflit (avenant 39 inchangé)', () => {
    const d = decideReintegration(input({ fields: [kept('v', h(500))] }));
    expect({ write: d.write, reintegrated: d.reintegrated, superseded: d.superseded }).toEqual({ write: 'update', reintegrated: 1, superseded: 0 });
  });

  it('valeur gardée plus récente que la création locale non publiée : écrite (la fusion ordinaire donne la plus récente)', () => {
    const d = decideReintegration(input({ fields: [kept('v', h(2_000))], row: row({ pending: new Set(['*']) }) }));
    expect(d.write).toBe('update');
    expect(d.values.get('x')).toBe('v');
  });
});
