import { describe, expect, it } from 'vitest';
import { libraryCandidates } from '../../../tests/fixtures/training/programImport';
import { exerciseNameScore, importedRoutineSpec, matchExerciseName, normalizeExerciseName, parseProgramText } from './programImport';

/**
 * IMPORT-029 passe qa-test : cas limites de l'analyseur et du rapprochement (programmes inventés).
 */

const only = (text: string) => {
  const result = parseProgramText(text);
  return { exercises: result.sessions.flatMap((s) => s.exercises), rejected: result.rejected };
};

describe('IMPORT-029 qa : analyseur de lignes', () => {
  it.each([
    ['Squat 4 × 8 – 10', 4, 8, 10],
    ['Squat 4x8—10 reps', 4, 8, 10],
    ['Squat 4 sets x 10', 4, 10, 10],
    ['Squat 4 séries x 8', 4, 8, 8],
    ['Squat 4x8 à 10 répétitions', 4, 8, 10],
    ['Squat 5 * 5', 5, 5, 5],
  ])('« %s »', (text, sets, min, max) => {
    const { exercises, rejected } = only(text);
    expect(rejected).toEqual([]);
    expect(exercises.map((e) => [e.name, e.sets, e.repsMin, e.repsMax])).toEqual([['Squat', sets, min, max]]);
  });

  it('« @RIR2 », « RIR : 3 », « repos 90" » et retours chariot Windows', () => {
    const { exercises } = only('Squat 3x5 @RIR2\r\nCurl 3x10 RIR : 3 repos 90"\r\n');
    expect(exercises.map((e) => [e.rir, e.restSec])).toEqual([
      [2, null],
      [3, 90],
    ]);
  });

  it('nom seul, ligne vide, puis schéma : un exercice ; nom seul suivi d’un exercice complet : rejeté', () => {
    expect(only('Tirage vertical\n\n3 x 12').exercises.map((e) => [e.name, e.lines])).toEqual([['Tirage vertical', [1, 3]]]);
    expect(only('Tirage vertical\nCurl 3 x 12').rejected).toEqual([{ line: 1, text: 'Tirage vertical', reason: 'no-scheme' }]);
  });

  it('nom seul et schéma hors bornes : les deux lignes montrées', () => {
    expect(only('Squat\n30 x 5').rejected.map((r) => [r.line, r.reason])).toEqual([
      [1, 'out-of-range'],
      [2, 'out-of-range'],
    ]);
  });

  it('RIR seul après un exercice qui en a déjà un, ou après une ligne rejetée : orphelin', () => {
    expect(only('Squat 3x5 RIR 2\nRIR 1').rejected.map((r) => r.reason)).toEqual(['orphan-rir']);
    expect(only('Squat 30x5\nRIR 1').rejected.map((r) => r.reason)).toEqual(['out-of-range', 'orphan-rir']);
    expect(only('Squat 3x5\nRIR 9').rejected.map((r) => r.reason)).toEqual(['out-of-range']);
  });

  it('repos hors bornes : ligne rejetée, jamais un repos tronqué', () => {
    expect(only('Squat 3x5 repos 20 min').rejected.map((r) => r.reason)).toEqual(['out-of-range']);
  });

  it('nom de plus de 120 caractères : rejeté', () => {
    expect(only(`${'a'.repeat(121)} 3x5`).rejected.map((r) => r.reason)).toEqual(['out-of-range']);
  });

  it('titre de séance sans exercice puis un autre titre : séance vide gardée (hors premier titre)', () => {
    const result = parseProgramText('Jour A\nSquat 3x5\nJour B\nJour C\nCurl 3x10');
    expect(result.sessions.map((s) => [s.name, s.exercises.length])).toEqual([
      ['Jour A', 1],
      ['Jour B', 0],
      ['Jour C', 1],
    ]);
  });

  it('ligne rejetée très longue : coupée à l’affichage, jamais vide', () => {
    const text = `Bla ${'x'.repeat(400)}`;
    const [rejected] = only(text).rejected;
    expect(rejected?.text.length).toBeLessThanOrEqual(301);
    expect(rejected?.text.startsWith('Bla')).toBe(true);
  });

  it('JSON : séance sans tableau d’exercices et JSON racine non objet', () => {
    expect(parseProgramText('{"sessions":[{"name":"A"}]}').rejected.map((r) => r.reason)).toEqual(['json-field']);
    expect(parseProgramText('{"sessions":[{"name":"A","exercises":[{"name":"Squat","sets":3,"repsMin":5,"rir":"2"}]}]}').rejected.map((r) => r.reason)).toEqual(['json-field']);
    expect(parseProgramText('{"sessions":[{"name":"A","exercises":[{"name":"Squat","sets":3,"repsMin":5,"restSec":1200}]}]}').rejected.map((r) => r.reason)).toEqual(['out-of-range']);
  });
});

describe('IMPORT-029 qa : rapprochement', () => {
  const library = libraryCandidates();

  it('chaque exercice de la bibliothèque, cherché par son nom français, est proposé ; seuls les homonymes après normalisation restent à confirmer', () => {
    const homonyms: string[] = [];
    for (const exercise of library) {
      const match = matchExerciseName(exercise.nameFr, library);
      const twins = library.filter((other) => other.id !== exercise.id && normalizeExerciseName(other.nameFr) === normalizeExerciseName(exercise.nameFr));
      if (twins.length === 0) {
        expect(match.choices[0]?.id, exercise.nameFr).toBe(exercise.id);
        expect(match.level, exercise.nameFr).toBe('sure');
      } else {
        homonyms.push(exercise.id);
        expect(match.level, exercise.nameFr).toBe('doubt');
        expect(match.choices.map((c) => c.id)).toContain(exercise.id);
      }
    }
    // « Extension de hanches à la poulie » / « Extension de hanche à la poulie » : écart de contenu signalé à content-data (fiche IMPORT-029).
    expect(homonyms.sort()).toEqual(['cable-kickback', 'cable-pull-through']);
  });

  it('score borné à [0, 1] et nul pour un nom vide', () => {
    expect(exerciseNameScore('', 'Squat')).toBe(0);
    expect(exerciseNameScore('—', 'Squat')).toBe(0);
    for (const a of library.slice(0, 20)) for (const b of library.slice(0, 20)) {
      const s = exerciseNameScore(a.nameFr, b.nameFr);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('abréviations courantes : « DC barre », « RDL haltères »', () => {
    expect(matchExerciseName('DC barre', library).choices[0]?.id).toBe('bench-press-barbell');
    expect(matchExerciseName('RDL haltères', library).choices[0]?.id).toBe('romanian-deadlift-dumbbell');
  });

  it('repos par défaut hors bornes ramené dans [0, 900]', () => {
    const parsed = parseProgramText('Squat 3x5');
    const spec = importedRoutineSpec('R', parsed.sessions, () => ({ exerciseId: 'squat-barbell', exerciseName: 'Squat à la barre', defaultRestSec: 5000 }), () => 'S');
    expect(spec.days[0]?.exercises[0]?.restSec).toBe(900);
  });
});

describe('IMPORT-029 revue à froid : entrées hostiles', () => {
  it('bloc JSON très profond : refusé avec sa raison, jamais une exception', () => {
    const deep = `{"sessions":[${'['.repeat(100_000)}${']'.repeat(100_000)}]}`;
    const result = parseProgramText(deep);
    expect(result.sessions).toEqual([]);
    expect(result.rejected.map((r) => r.reason)).toEqual(['json-field']);
  });

  it('ligne de plus de 500 caractères : refusée « trop longue » sans être analysée, en temps borné', () => {
    const long = `Squat${' '.repeat(40_000)}3 x 10`;
    const t0 = Date.now();
    const result = parseProgramText(`Jour A\n${long}\nPompes 3 x 12`);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(result.rejected.map((r) => r.reason)).toEqual(['too-long']);
    expect(result.sessions.flatMap((s) => s.exercises).map((e) => e.name)).toEqual(['Pompes']);
  });

  it('« Jour 1 » vide suivi de « Jour 2 » : deux séances, « Jour 1 » n’est pas le nom de la routine', () => {
    const result = parseProgramText('Jour 1\nJour 2\nPompes 3 x 12');
    expect(result.name).toBeNull();
    expect(result.sessions.map((s) => s.name)).toEqual(['Jour 1', 'Jour 2']);
  });
});
