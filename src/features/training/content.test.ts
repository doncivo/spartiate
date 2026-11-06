import { describe, expect, it } from 'vitest';
import { createUuidGenerator } from '../../domain/id';
import { filterCompatibleExercises, validateEquipmentProfile, validateRoutine } from '../../domain/training';
import { parseIncrements, parseInventory } from '../../db/parse/equipmentJson';
import { duplicateEmbeddedProfile, loadTrainingContent, programToRoutine } from './content';

/** I1-01 (interface) : chargeur du contenu embarqué (import dynamique, mis en cache) et conversions vers le domaine. */

const ids = createUuidGenerator();

describe('contenu embarqué de l’entraînement', () => {
  it('150 exercices, 4 programmes, 4 profils ; profil par défaut Fitness Park Antony ; chargé une seule fois', async () => {
    const first = loadTrainingContent();
    expect(loadTrainingContent()).toBe(first);
    const content = await first;
    expect(content.catalog.list()).toHaveLength(150);
    expect(content.programs.map((p) => p.id)).toEqual(['full-body-3j', 'haut-bas-4j', 'ppl-6j', 'maison-halteres-3j']);
    expect(content.profiles.map((p) => p.id)).toEqual(['fitness-park-antony', 'salle-commerciale', 'maison-halteres', 'poids-de-corps']);
    expect(content.defaultProfileId).toBe('fitness-park-antony');
    expect(content.catalog.get('bench-press-barbell')?.origin).toBe('embedded');
    expect(content.catalog.get('bench-press-barbell')?.media).toBeNull();
  });

  it('chaque programme devient une routine valide, nom d’exercice figé depuis le catalogue, durée en secondes pour la planche', async () => {
    const content = await loadTrainingContent();
    for (const program of content.programs) {
      const routine = programToRoutine(program, content.catalog, ids);
      expect(validateRoutine(routine), program.id).toEqual([]);
      for (const day of routine.days) for (const line of day.exercises) expect(line.exerciseName, line.exerciseId).toBe(content.catalog.get(line.exerciseId)?.nameFr);
    }
    const fullBody = programToRoutine(content.programs[0]!, content.catalog, ids);
    const plank = fullBody.days[0]!.exercises.find((l) => l.exerciseId === 'plank');
    expect(plank).toMatchObject({ repMin: 30, repMax: 30, exerciseName: 'Planche' });
  });

  it('chaque profil embarqué se duplique en un profil valide, valeurs à vérifier conservées', async () => {
    const content = await loadTrainingContent();
    for (const profile of content.profiles) {
      const copy = duplicateEmbeddedProfile(profile, ids, `${profile.name} (copie)`);
      expect(validateEquipmentProfile(copy), profile.id).toEqual([]);
      expect(parseInventory(copy.inventory), profile.id).toEqual(copy.inventory);
      expect(parseIncrements(copy.increments), profile.id).toEqual(copy.increments);
    }
    const antony = content.profiles[0]!;
    expect(antony.inventory.toVerify).toEqual(expect.arrayContaining(['kettlebells', 'barbell:Barre EZ']));
    expect(antony.increments).toEqual({ barbell: 2.5, dumbbell: 2 });
  });

  it('compatibilité : les groupes d’alternatives du JSON ; poids de corps sans barre', async () => {
    const content = await loadTrainingContent();
    const body = content.profiles.find((p) => p.id === 'poids-de-corps')!;
    const antony = content.profiles.find((p) => p.id === 'fitness-park-antony')!;
    const forBody = filterCompatibleExercises(content.catalog.list(), body).map((e) => e.id);
    expect(forBody).toContain('push-up');
    expect(forBody).not.toContain('bench-press-barbell');
    const forAntony = filterCompatibleExercises(content.catalog.list(), antony).map((e) => e.id);
    expect(forAntony).toContain('bench-press-barbell');
    expect(forAntony).not.toContain('preacher-curl');
  });

  it('les programmes de la salle sont entièrement compatibles avec Fitness Park Antony', async () => {
    const content = await loadTrainingContent();
    const antony = content.profiles[0]!;
    for (const program of content.programs.filter((p) => p.compatibleProfileIds.includes('fitness-park-antony'))) {
      for (const day of program.days) for (const line of day.exercises) expect(filterCompatibleExercises([content.catalog.get(line.exerciseId)!], antony), `${program.id} ${line.exerciseId}`).toHaveLength(1);
    }
  });
});
