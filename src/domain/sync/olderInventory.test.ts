import { describe, expect, it } from 'vitest';
import { EQUIPMENT_LONG_LISTS_SINCE_SV, LEGACY_EQUIPMENT_ID_LIST_MAX } from '../training/equipment';
import { OLDER_INVENTORY_GUARD, olderWriterKeepsLocal } from './merge';

/**
 * SYNC-0304 (BL-187, D-805, ADR 0011 avenant 40) : règle pure « inventaire gardé contre un écrivain plus ancien ». Une écriture de
 * `equipment_profile.inventory` venue d'un `sv` < 25 (ou inconnu) ne remplace jamais un inventaire local dont une liste d'identifiants dépasse
 * l'ancienne borne de lecture (64). Données synthétiques.
 */
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `item-${i}`);
const inv = (available: string[], extra: Record<string, unknown> = {}): string => JSON.stringify({ available, forced: [], forbidden: [], bodyweight: false, ...extra });
const LONG = inv(ids(70));
const SHORT = inv([]);

describe('SYNC-0304 : inventaire long gardé contre un écrivain plus ancien', () => {
  it('constantes recopiées égales à celles du domaine du matériel (bloc de départ sans dépendance vers training)', () => {
    expect(OLDER_INVENTORY_GUARD.legacyMax).toBe(LEGACY_EQUIPMENT_ID_LIST_MAX);
    expect(OLDER_INVENTORY_GUARD.sinceSv).toBe(EQUIPMENT_LONG_LISTS_SINCE_SV);
    expect(OLDER_INVENTORY_GUARD).toMatchObject({ table: 'equipment_profile', field: 'inventory' });
  });

  it('(a) sv 24, liste locale de 70 : valeur locale gardée', () => {
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', LONG, SHORT, 24)).toBe(true);
  });

  it('liste forcée ou interdite au-delà de 64 : gardée aussi ; doublons comptés une fois', () => {
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', JSON.stringify({ available: [], forced: ids(65), forbidden: [] }), SHORT, 24)).toBe(true);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', JSON.stringify({ available: [], forced: [], forbidden: ids(65) }), SHORT, 24)).toBe(true);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', inv([...ids(64), 'item-0', 'item-1']), SHORT, 24)).toBe(false);
  });

  it('(b) sv 24, liste locale de 64 ou moins : règle ordinaire', () => {
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', inv(ids(64)), SHORT, 24)).toBe(false);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', SHORT, inv(ids(3)), 24)).toBe(false);
  });

  it('(c) sv 25 ou plus : règle ordinaire', () => {
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', LONG, SHORT, 25)).toBe(false);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', LONG, SHORT, 31)).toBe(false);
  });

  it('(d) sv inconnu (non entier, négatif, NaN) : traité comme plus ancien, valeur gardée', () => {
    for (const sv of [Number.NaN, 24.5, -1, 0, Number.POSITIVE_INFINITY]) expect(olderWriterKeepsLocal('equipment_profile', 'inventory', LONG, SHORT, sv)).toBe(true);
  });

  it('même valeur, autre table, autre champ, valeur locale illisible ou nulle : règle ordinaire', () => {
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', LONG, LONG, 24)).toBe(false);
    expect(olderWriterKeepsLocal('equipment_profile', 'increments', LONG, SHORT, 24)).toBe(false);
    expect(olderWriterKeepsLocal('exercise', 'inventory', LONG, SHORT, 24)).toBe(false);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', '{pas du json', SHORT, 24)).toBe(false);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', null, SHORT, 24)).toBe(false);
    expect(olderWriterKeepsLocal('equipment_profile', 'inventory', JSON.stringify(ids(70)), SHORT, 24)).toBe(false);
  });
});
