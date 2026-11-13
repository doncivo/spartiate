import { describe, expect, it } from 'vitest';
import { dumbbellsHeld, SINGLE_DUMBBELL_EXERCISES } from './dumbbellPair';

/** ERGO-02 (D-261, révise D-260) : nombre d'haltères tenus, pour l'affichage « 2 × 26 kg » ; la valeur stockée reste la charge d'un haltère. */
describe('dumbbellsHeld', () => {
  it('deux haltères : développé couché aux haltères, grille haltères', () => {
    expect(dumbbellsHeld({ id: 'bench-press-dumbbell', equipment: ['dumbbell', 'flat-bench'] }, 'dumbbell')).toBe(2);
  });
  it('un seul haltère : rowing unilatéral, squat gobelet', () => {
    expect(dumbbellsHeld({ id: 'row-dumbbell-one-arm', equipment: ['dumbbell', 'bench'] }, 'dumbbell')).toBe(1);
    expect(dumbbellsHeld({ id: 'goblet-squat', equipment: ['dumbbell', 'kettlebell'] }, 'dumbbell')).toBe(1);
  });
  it('fente aux haltères : unilatérale mais deux haltères', () => {
    expect(dumbbellsHeld({ id: 'split-squat-dumbbell', equipment: ['dumbbell'] }, 'dumbbell')).toBe(2);
  });
  it('charge venue d’un autre matériel : aucun haltère (curl au pupitre à la barre)', () => {
    expect(dumbbellsHeld({ id: 'preacher-curl', equipment: ['preacher-bench', 'barbell', 'dumbbell'] }, 'barbell')).toBeNull();
    expect(dumbbellsHeld({ id: 'bench-press-barbell', equipment: ['barbell', 'flat-bench'] }, null)).toBeNull();
  });
  it('source inconnue : premier matériel chargé de l’exercice', () => {
    expect(dumbbellsHeld({ id: 'curl-dumbbell', equipment: ['dumbbell'] }, undefined)).toBe(2);
    expect(dumbbellsHeld({ id: 'reverse-curl', equipment: ['barbell', 'dumbbell'] }, undefined)).toBeNull();
    expect(dumbbellsHeld({ id: 'lateral-raise-dumbbell-one-arm', equipment: ['dumbbell'] }, undefined)).toBe(1);
  });
  it('la liste des exercices à un haltère ne cite que des identifiants du catalogue', async () => {
    const raw: unknown = (await import('../../../content/exercises/exercises.json')).default;
    const list = (Array.isArray(raw) ? raw : (raw as { exercises: unknown[] }).exercises) as { id: string; equipment: string[] }[];
    const ids = new Map(list.map((e) => [e.id, e.equipment]));
    for (const id of SINGLE_DUMBBELL_EXERCISES) expect(ids.get(id), id).toContain('dumbbell');
  });
});
