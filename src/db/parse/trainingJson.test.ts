import { describe, expect, it } from 'vitest';
import { GYM_PROFILE } from '../../../tests/fixtures/training';
import { parseIncrements, parseInventory } from './equipmentJson';
import { parseAliases, parseEquipmentIds, parseInstructions, parseMedia, parseMuscles } from './exerciseJson';

/** I1-01 : validation à la main des JSON persistés (ADR 0008) : valeur typée, ou null ; jamais d'exception. */

describe('JSON d’un exercice', () => {
  it('muscles : liste non vide de {id kebab-case, weight 0 < w ≤ 1}', () => {
    expect(parseMuscles([{ id: 'lats', weight: 1 }, { id: 'front-delts', weight: 0.3 }])).toEqual([{ id: 'lats', weight: 1 }, { id: 'front-delts', weight: 0.3 }]);
    for (const bad of [[], 'x', null, [{ id: 'Lats', weight: 1 }], [{ id: 'lats', weight: 0 }], [{ id: 'lats', weight: 1.2 }], [{ id: 'lats' }], [{ id: 'lats', weight: 1 }, { id: 'lats', weight: 0.5 }], Array.from({ length: 40 }, (_, i) => ({ id: `m${String(i)}`, weight: 1 }))]) {
      expect(parseMuscles(bad)).toBeNull();
    }
  });

  it('matériel et alias : listes de textes bornées ; doublons retirés', () => {
    expect(parseEquipmentIds(['barbell', 'flat-bench', 'barbell'])).toEqual(['barbell', 'flat-bench']);
    expect(parseEquipmentIds([])).toEqual([]);
    expect(parseEquipmentIds(['Barre Droite'])).toBeNull();
    expect(parseEquipmentIds('barbell')).toBeNull();
    expect(parseAliases(['barbell bench press'])).toEqual(['barbell bench press']);
    expect(parseAliases([1])).toBeNull();
    expect(parseAliases(['x'.repeat(200)])).toBeNull();
  });

  it('instructions : setup, execution, mistakes ; champs absents refusés', () => {
    expect(parseInstructions({ setup: 'a', execution: 'b', mistakes: ['c'] })).toEqual({ setup: 'a', execution: 'b', mistakes: ['c'] });
    expect(parseInstructions({ setup: '', execution: '', mistakes: [] })).toEqual({ setup: '', execution: '', mistakes: [] });
    expect(parseInstructions({ setup: 'a' })).toBeNull();
    expect(parseInstructions({ setup: 1, execution: 'b', mistakes: [] })).toBeNull();
    expect(parseInstructions(null)).toBeNull();
  });

  it('média : null admis ; sinon images, vidéo, licence et source', () => {
    expect(parseMedia(null)).toBeNull();
    expect(parseMedia({ images: ['a.jpg'], video: null, license: 'CC0', source: 'maison' })).toEqual({ images: ['a.jpg'], video: null, license: 'CC0', source: 'maison' });
    expect(parseMedia({ images: [1], video: null, license: 'x', source: 'y' })).toBeNull();
    expect(parseMedia({ images: ['a.jpg'], video: null })).toBeNull();
  });
});

describe('JSON d’un profil de matériel', () => {
  it('inventaire de la fixture : relu à l’identique ; clés inconnues ignorées', () => {
    expect(parseInventory(GYM_PROFILE.inventory)).toEqual(GYM_PROFILE.inventory);
    expect(parseInventory({ ...GYM_PROFILE.inventory, futur: 1 })).toEqual(GYM_PROFILE.inventory);
    // I2-01 : le matériel d'une barre est conservé ; absent, il reste absent (profil d'avant la 0.3.0) ; mal formé, l'inventaire est refusé.
    const linked = { ...GYM_PROFILE.inventory, barbells: [{ type: 'Barre EZ', weightKg: 8.5, equipmentId: 'ez-bar' }, { type: 'Ancienne', weightKg: 20 }] };
    expect(parseInventory(linked)).toEqual(linked);
    expect(parseInventory({ ...GYM_PROFILE.inventory, barbells: [{ type: 'Barre', weightKg: 20, equipmentId: 'Barre EZ' }] })).toBeNull();
  });

  it('inventaire partiel (version plus ancienne) : valeurs vides par défaut ; valeurs de mauvais type refusées', () => {
    expect(parseInventory({})).toMatchObject({ available: [], forced: [], forbidden: [], bodyweight: false, dumbbells: null, machines: [] });
    for (const bad of [[], 'x', null, { available: 'a' }, { bodyweight: 'oui' }, { dumbbells: { minKg: 'a', maxKg: 1, stepKg: 1 } }, { machines: [{ equipmentId: 'x' }] }, { kettlebellsKg: [-1] }, { barbells: [{ type: 'o', weightKg: 0 }] }]) {
      expect(parseInventory(bad)).toBeNull();
    }
  });

  it('valeurs « à vérifier en salle » conservées ; liste vide omise ; mauvais type refusé', () => {
    expect(parseInventory({ ...GYM_PROFILE.inventory, toVerify: ['kettlebells', 'barbell:Barre EZ'] })).toEqual({ ...GYM_PROFILE.inventory, toVerify: ['kettlebells', 'barbell:Barre EZ'] });
    expect(parseInventory({ ...GYM_PROFILE.inventory, toVerify: [] })).toEqual(GYM_PROFILE.inventory);
    expect(parseInventory({ toVerify: [1] })).toBeNull();
  });

  it('incréments : kg strictement positifs par type', () => {
    expect(parseIncrements({ barbell: 2.5, dumbbell: 2 })).toEqual({ barbell: 2.5, dumbbell: 2 });
    expect(parseIncrements({})).toEqual({});
    expect(parseIncrements({ barbell: 0 })).toBeNull();
    expect(parseIncrements({ barbell: 'a' })).toBeNull();
    expect(parseIncrements([])).toBeNull();
  });
});
