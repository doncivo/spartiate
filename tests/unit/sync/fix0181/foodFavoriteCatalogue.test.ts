import { describe, expect, it } from 'vitest';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { expectedFavoriteId, favoriteId, isFavoriteId } from '../../../../src/domain/sync/naturalIds';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { CAPTURE_TABLES_V15 } from '../../../../src/db/migrations/0015_food_favorite';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { failureKinds } from '../../../../src/features/sync/syncText';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';

/**
 * FIX-0181 (D-26, D-171 : D-79 révisée par Ali le 12/11) : catalogue de synchro de `food_favorite`, favoris de la recherche d'aliments écrits par les
 * DEUX appareils. Identifiant naturel `favorite|<ref>` (`ref` = `ciqual:<code>` ou UUID d'une fiche) : le même aliment mis en favori des deux côtés
 * donne UNE ligne. Périmètre : (a) ordre et identifiant ; (b) copie figée de la 0015 = catalogue vivant ; (c) types ; (d) journal des conflits ;
 * (e) libellés de synchro.
 */
const UUID = '20000000-0000-4000-8000-000000000001';
const table = () => {
  const t = SYNC_CATALOGUE.table('food_favorite');
  if (!t) throw new Error('food_favorite absente du catalogue');
  return t;
};
const col = (name: string) => {
  const c = SYNC_CATALOGUE.column('food_favorite', name);
  if (!c) throw new Error(name);
  return c;
};

describe('catalogue de production : food_favorite (FIX-0181)', () => {
  it('25e de l’ordre (juste avant data_reset, RESET-01, puis cardio_session, I6-06), identifiant naturel, aucun parent ni colonne locale ni règle de publication', () => {
    expect(SYNC_TABLE_ORDER.length).toBe(27);
    expect(SYNC_TABLE_ORDER[24]).toBe('food_favorite');
    expect(SYNC_CATALOGUE.tables.map((t) => t.name).at(-3)).toBe('food_favorite');
    expect(table().idKind).toBe('natural');
    expect(table().parents).toEqual([]);
    expect(table().local).toEqual([]);
    expect(table().publishWhen).toBeUndefined();
  });

  it('copie figée de la migration 0015 = catalogue vivant (colonnes et ordre)', () => {
    expect(CAPTURE_TABLES_V15.map(([name]) => name)).toEqual(['food_favorite']);
    expect([...publishedColumns(table())]).toEqual([...CAPTURE_TABLES_V15[0][1]]);
  });

  it('identifiants : favorite|ciqual:<code> ou favorite|<UUID>, aucun repli UUID nu ; identifiant attendu des valeurs', () => {
    const t = table();
    expect(favoriteId('ciqual:20')).toBe('favorite|ciqual:20');
    for (const ok of ['favorite|ciqual:20', `favorite|${UUID}`]) {
      expect(isFavoriteId(ok), ok).toBe(true);
      expect(SYNC_CATALOGUE.isValidRowId(t, ok), ok).toBe(true);
    }
    for (const bad of [UUID, 'favorite|', 'favorite|ciqual:', 'favorite|ciqual:abc', 'favorite|n’importe quoi', `favorite|${UUID}|x`, `fav|${UUID}`, 'favorite|ciqual:20 ']) {
      expect(isFavoriteId(bad), bad).toBe(false);
      expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
    }
    expect(expectedFavoriteId(new Map([['ref', 'ciqual:20']]))).toBe('favorite|ciqual:20');
    expect(expectedFavoriteId(new Map([['ref', 'pas une référence']]))).toBeNull();
    expect(t.natural?.expected(new Map([['ref', UUID]]))).toBe(`favorite|${UUID}`);
  });

  it('types : source et référence en texte court, instant d’ajout obligatoire', () => {
    const ok = (name: string, v: unknown) => SYNC_CATALOGUE.isValidValue(col(name), v);
    expect(ok('source', 'ciqual')).toBe(true);
    expect(ok('source', 'x'.repeat(17))).toBe(false);
    expect(ok('source', null)).toBe(false);
    expect(ok('ref', UUID)).toBe(true);
    expect(ok('ref', 'x'.repeat(65))).toBe(false);
    expect(ok('added_at', '2026-11-13T08:00:00.000Z')).toBe(true);
    expect(ok('added_at', null)).toBe(false);
  });

  it('journal des conflits : seule la suppression y est visible', () => {
    expect(table().columns.filter((c) => c.conflictVisible).map((c) => c.name)).toEqual(['deleted_at']);
  });

  it('libellés de synchro : report d’époque, version, champs', () => {
    expect(carryKindText('food_favorite')).toBe('Favori de la recherche d’aliments');
    expect(failureKinds(['food_favorite'])).toBe('favoris');
    expect(syncFieldFr.food_favorite).toEqual({ deleted_at: 'suppression' });
  });
});
