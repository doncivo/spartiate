import { describe, expect, it } from 'vitest';
import { CUSTOM_EXERCISE, CUSTOM_ID, DELETED_CUSTOM_EXERCISE, DELETED_CUSTOM_ID, EMBEDDED_EXERCISES } from '../../../tests/fixtures/training';
import { createExerciseCatalog, resolveExercise } from './index';

/** I1-01 critères 2 et 3 : résolution d'un identifiant embarqué, personnalisé ou inconnu (P-09, D-71) ; jamais d'exception. */

const catalog = createExerciseCatalog(EMBEDDED_EXERCISES);
const customs = [CUSTOM_EXERCISE, DELETED_CUSTOM_EXERCISE];

describe('catalogue embarqué injecté', () => {
  it('refuse deux exercices de même identifiant', () => {
    const first = EMBEDDED_EXERCISES[0];
    if (!first) throw new Error('fixture');
    expect(() => createExerciseCatalog([first, first])).toThrow();
  });

  it('get / has / list', () => {
    expect(catalog.get('plank')?.nameFr).toBe('Planche');
    expect(catalog.has('plank')).toBe(true);
    expect(catalog.get('inconnu')).toBeUndefined();
    expect(catalog.list()).toHaveLength(EMBEDDED_EXERCISES.length);
  });
});

describe('resolveExercise', () => {
  it('identifiant du JSON : embarqué, sans ligne exercise', () => {
    const r = resolveExercise({ id: 'bench-press-barbell' }, catalog, customs);
    expect(r.status).toBe('embedded');
    expect(r.name).toBe('Développé couché à la barre');
    expect(r.exercise?.id).toBe('bench-press-barbell');
  });

  it('exercice personnalisé actif : résolu sur la ligne, identifiant conservé', () => {
    const r = resolveExercise({ id: CUSTOM_ID }, catalog, customs);
    expect(r).toMatchObject({ status: 'custom', id: CUSTOM_ID, name: 'Tirage à la sangle' });
  });

  it('personnalisé supprimé : inconnu, le nom figé est affiché, sinon son dernier nom connu', () => {
    expect(resolveExercise({ id: DELETED_CUSTOM_ID, frozenName: 'Nom de la séance' }, catalog, customs)).toMatchObject({ status: 'unknown', reason: 'deleted', name: 'Nom de la séance', exercise: null });
    expect(resolveExercise({ id: DELETED_CUSTOM_ID }, catalog, customs)).toMatchObject({ status: 'unknown', reason: 'deleted', name: 'Ancien exercice maison' });
  });

  it('absent du catalogue courant : inconnu, nom figé conservé, jamais d’exception ni de remplacement', () => {
    expect(resolveExercise({ id: 'ancien-exercice', frozenName: 'Ancien nom' }, catalog, customs)).toEqual({ status: 'unknown', reason: 'absent', id: 'ancien-exercice', name: 'Ancien nom', exercise: null });
    expect(resolveExercise({ id: 'ancien-exercice' }, catalog, customs).name).toBe('ancien-exercice');
    expect(resolveExercise({ id: '' }, catalog, []).status).toBe('unknown');
    expect(resolveExercise({ id: '__proto__' }, catalog, []).status).toBe('unknown');
    expect(resolveExercise({ id: 'constructor' }, catalog, []).status).toBe('unknown');
  });

  it('cible reçue plus tard : la même référence se résout sans réécriture', () => {
    const ref = { id: CUSTOM_ID, frozenName: 'Nom figé' };
    expect(resolveExercise(ref, catalog, []).status).toBe('unknown');
    expect(resolveExercise(ref, catalog, [CUSTOM_EXERCISE]).status).toBe('custom');
  });

  it('un identifiant embarqué l’emporte toujours sur une ligne personnalisée de même identifiant', () => {
    const clash = { ...CUSTOM_EXERCISE, id: 'plank', nameFr: 'Imposteur' };
    expect(resolveExercise({ id: 'plank' }, catalog, [clash]).status).toBe('embedded');
  });

  it('accepte une Map d’exercices personnalisés', () => {
    expect(resolveExercise({ id: CUSTOM_ID }, catalog, new Map([[CUSTOM_ID, CUSTOM_EXERCISE]])).status).toBe('custom');
  });
});
