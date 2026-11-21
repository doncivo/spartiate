import { describe, expect, it } from 'vitest';
import { GYM_NO_CABLE, input } from '../../../tests/fixtures/training/generation';
import { generateSession } from './generateSession';

/** SESS-01b : un exercice écarté (« ne plus proposer ») n'est jamais proposé par la génération, ni gardé, ni substitut. */
describe('generateSession — exercices écartés', () => {
  it('ligne de routine écartée : remplacée (raison « écarté ») par le substitut habituel', () => {
    const s = generateSession(input({}, { excludedExerciseIds: ['lat-pulldown'] }));
    expect(s.exercises.map((e) => e.exerciseId)).not.toContain('lat-pulldown');
    expect(s.exercises.find((e) => e.sourceExerciseId === 'lat-pulldown')).toMatchObject({ origin: 'substitution', substitutionReason: 'excluded', exerciseId: 'pulldown-machine' });
  });

  it('un exercice écarté n’est jamais un substitut ; sans autre substitut, la ligne est omise avec sa raison', () => {
    const s = generateSession(input({ equipment: GYM_NO_CABLE }, { excludedExerciseIds: ['pulldown-machine'] }));
    expect(s.exercises.map((e) => e.exerciseId)).not.toContain('pulldown-machine');
    const both = generateSession(input({ equipment: GYM_NO_CABLE }, { excludedExerciseIds: ['pulldown-machine', 'lat-pulldown'] }));
    expect(both.exercises.map((e) => e.exerciseId)).not.toContain('pulldown-machine');
    expect(both.exercises.map((e) => e.exerciseId)).not.toContain('lat-pulldown');
  });

  it('liste vide : séance inchangée', () => {
    expect(generateSession(input({}, { excludedExerciseIds: [] }))).toEqual(generateSession(input()));
  });
});
