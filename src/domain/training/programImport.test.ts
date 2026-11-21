import { describe, expect, it } from 'vitest';
import { FREE_LINES, OCR_COLUMNS, REJECTED_LINES, guideJsonExample, libraryCandidates } from '../../../tests/fixtures/training/programImport';
import {
  IMPORT_MATCH_DOUBT,
  IMPORT_MATCH_SURE,
  exerciseNameScore,
  importedRoutineSpec,
  matchExerciseName,
  normalizeExerciseName,
  parseProgramText,
  type ImportedSession,
} from './programImport';
import { validateRoutine } from './routineRules';

/**
 * IMPORT-029a (PRD § 17.4) : analyseur pur du texte d'un programme (bloc JSON du guide ou lignes libres) et rapprochement des noms avec la
 * bibliothèque. Vecteurs synthétiques (tests/fixtures/training/programImport.ts).
 */

const summary = (sessions: readonly ImportedSession[]) =>
  sessions.map((s) => ({ name: s.name, exercises: s.exercises.map((e) => [e.name, e.sets, e.repsMin, e.repsMax, e.rir]) }));

describe('IMPORT-029a C-1 : bloc structuré', () => {
  it("lit l'exemple du guide tel quel (séances, exercices, plages, RIR)", () => {
    const result = parseProgramText(guideJsonExample());
    expect(result.format).toBe('json');
    expect(result.rejected).toEqual([]);
    expect(result.name).toBe("Haut / Bas d'essai");
    expect(summary(result.sessions)).toEqual([
      {
        name: 'Jour A — Haut',
        exercises: [
          ['Développé couché à la barre', 4, 6, 8, 2],
          ['Rowing à la barre', 4, 8, 10, 2],
          ['Élévation latérale aux haltères', 3, 12, 15, null],
        ],
      },
      {
        name: 'Jour B — Bas',
        exercises: [
          ['Squat à la barre', 4, 5, 8, 2],
          ['Soulevé de terre roumain à la barre', 3, 8, 10, 2],
          ['Planche', 3, 30, 45, null],
        ],
      },
    ]);
  });

  it('lit le bloc entouré de texte ou dans une clôture de code ; repsMax absent = repsMin ; restSec lu', () => {
    const text = 'Voici ton programme :\n```json\n{"sessions":[{"exercises":[{"name":"Curl marteau","sets":3,"repsMin":12,"restSec":60}]}]}\n```\nBonne séance !';
    const result = parseProgramText(text);
    expect(result.format).toBe('json');
    expect(result.rejected).toEqual([]);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.name).toBeNull();
    expect(result.sessions[0]?.exercises[0]).toMatchObject({ name: 'Curl marteau', sets: 3, repsMin: 12, repsMax: 12, rir: null, restSec: 60 });
  });

  it('montre un exercice invalide avec sa raison, garde les autres', () => {
    const text = JSON.stringify({
      sessions: [
        {
          name: 'A',
          exercises: [
            { name: 'Squat', sets: 4, repsMin: 5, repsMax: 5 },
            { name: 'Curl', sets: 0, repsMin: 10, repsMax: 12 },
            { name: '', sets: 3, repsMin: 10, repsMax: 12 },
            { name: 'Rowing', sets: 3, repsMin: 12, repsMax: 8 },
            { name: 'Dips', sets: 3, repsMin: 8, repsMax: 10, rir: 9 },
            'texte',
          ],
        },
      ],
    });
    const result = parseProgramText(text);
    expect(summary(result.sessions)).toEqual([{ name: 'A', exercises: [['Squat', 4, 5, 5, null]] }]);
    expect(result.rejected.map((r) => r.reason)).toEqual(['out-of-range', 'json-field', 'out-of-range', 'out-of-range', 'json-field']);
    for (const r of result.rejected) expect(r.text).not.toBe('');
  });

  it('dit un JSON illisible tel quel, sans rien deviner', () => {
    const result = parseProgramText('{"sessions": [ {"name": "A", ');
    expect(result.format).toBe('json');
    expect(result.sessions).toEqual([]);
    expect(result.rejected).toEqual([{ line: null, text: '{"sessions": [ {"name": "A",', reason: 'json-invalid' }]);
  });

  it('refuse un objet sans tableau de séances (raison dite)', () => {
    const result = parseProgramText('{"sessions": 3}');
    expect(result.sessions).toEqual([]);
    expect(result.rejected.map((r) => r.reason)).toEqual(['json-field']);
  });
});

describe('IMPORT-029a C-2 : lignes libres', () => {
  it('lit titres, puces, ×, x, X, « séries de », plages, RIR, repos et secondes', () => {
    const result = parseProgramText(FREE_LINES);
    expect(result.format).toBe('lines');
    expect(result.rejected).toEqual([]);
    expect(summary(result.sessions)).toEqual([
      {
        name: 'Jour A — Poussée',
        exercises: [
          ['Développé couché', 4, 8, 10, null],
          ['Développé militaire à la barre', 3, 12, 12, null],
          ['Élévations latérales', 4, 15, 15, 2],
          ['Dips', 3, 10, 10, null],
        ],
      },
      {
        name: 'Séance 2',
        exercises: [
          ['Rowing à la barre', 4, 8, 8, 2],
          ['Tirage vertical à la poulie', 3, 8, 10, null],
          ['Planche', 3, 30, 30, null],
          ['Curl marteau', 3, 12, 12, null],
        ],
      },
    ]);
    const rowing = result.sessions[1]?.exercises[0];
    expect(rowing?.restSec).toBe(120);
    expect(rowing?.notes.map((n) => n.code)).toEqual(['rir-range']);
    expect(result.sessions[1]?.exercises[2]?.notes.map((n) => n.code)).toEqual(['seconds']);
    expect(result.sessions[1]?.exercises[3]?.notes).toEqual([{ code: 'unread', text: 'tempo 3-1-1' }]);
    expect(result.sessions[0]?.exercises[0]?.lines).toEqual([2]);
  });

  it('assemble un nom seul et la ligne « 3 x 12 » suivante ; RIR et repos seuls vont à l’exercice précédent', () => {
    const result = parseProgramText(OCR_COLUMNS);
    expect(result.rejected).toEqual([]);
    expect(summary(result.sessions)).toEqual([
      {
        name: 'Séance 1',
        exercises: [
          ['Squat à la barre', 4, 6, 6, 2],
          ['Presse à cuisses', 3, 10, 12, null],
          ['Fente bulgare', 3, 8, 8, null],
        ],
      },
    ]);
    expect(result.sessions[0]?.exercises[0]?.lines).toEqual([2, 3, 4]);
    expect(result.sessions[0]?.exercises[1]?.restSec).toBe(90);
  });

  it.each(['Jour A — Poussée', 'Séance 1', 'session 3', 'Lundi', 'J2', '# Haut du corps', 'Pectoraux :'])('« %s » ouvre une séance', (title) => {
    const result = parseProgramText(`${title}\nSquat 3x5`);
    expect(result.rejected).toEqual([]);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.name).toBe(title.replace(/^#\s*/, '').replace(/\s*:$/, ''));
  });

  it('exercices sans titre : une séance sans nom (« Séance 1 » à l’affichage)', () => {
    const result = parseProgramText('Squat 3x5\nCurl 3x10');
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.name).toBeNull();
    expect(result.sessions[0]?.exercises).toHaveLength(2);
  });

  it('un premier titre suivi aussitôt d’un autre titre donne le nom de la routine', () => {
    const result = parseProgramText('# Programme force inventé\nJour A\nSquat 3x5');
    expect(result.name).toBe('Programme force inventé');
    expect(result.sessions.map((s) => s.name)).toEqual(['Jour A']);
  });

  it('« repos 1 min 30 » et « repos 1,5 min » valent 90 s', () => {
    expect(parseProgramText('Squat 3x5 repos 1 min 30').sessions[0]?.exercises[0]?.restSec).toBe(90);
    expect(parseProgramText('Squat 3x5 repos 1,5 min').sessions[0]?.exercises[0]?.restSec).toBe(90);
  });
});

describe('IMPORT-029a C-3 : rien n’est ignoré', () => {
  it.each(REJECTED_LINES)('« $text » est montrée avec la raison $reason', ({ text, reason }) => {
    const result = parseProgramText(text);
    expect(result.sessions.flatMap((s) => s.exercises)).toEqual([]);
    expect(result.rejected).toEqual([{ line: 1, text, reason }]);
  });

  it('RIR seul sans exercice précédent : orphelin', () => {
    expect(parseProgramText('RIR 2').rejected).toEqual([{ line: 1, text: 'RIR 2', reason: 'orphan-rir' }]);
  });

  it('chaque ligne non vide est un titre, un exercice ou une ligne montrée (propriété, numéros de ligne)', () => {
    const text = [FREE_LINES, OCR_COLUMNS, ...REJECTED_LINES.map((r) => r.text), 'Bonne séance', '---', '   '].join('\n');
    const result = parseProgramText(text);
    const used = new Set<number>([...result.sessions.flatMap((s) => (s.line === null ? [] : [s.line])), ...result.sessions.flatMap((s) => s.exercises.flatMap((e) => e.lines)), ...result.rejected.flatMap((r) => (r.line === null ? [] : [r.line]))]);
    text.split('\n').forEach((line, index) => {
      if (/[\p{L}\p{N}]/u.test(line)) expect(used.has(index + 1), `ligne ${index + 1} « ${line} »`).toBe(true);
    });
    expect(result.rejected.map((r) => r.text)).toContain('Bonne séance');
  });

  it('texte vide : rien, sans erreur', () => {
    expect(parseProgramText('  \n\n')).toEqual({ format: 'lines', name: null, sessions: [], rejected: [] });
  });

  it('déterministe : même texte, même résultat', () => {
    expect(parseProgramText(FREE_LINES)).toEqual(parseProgramText(FREE_LINES));
  });
});

describe('IMPORT-029a C-4 : rapprochement des noms', () => {
  const library = libraryCandidates();

  it('normalise accents, casse, articles, élisions, pluriels et synonymes', () => {
    expect(normalizeExerciseName('Élévations latérales aux Haltères')).toBe('elevation laterale haltere');
    expect(normalizeExerciseName('Pull-over à l’haltère')).toBe('pull over haltere');
    expect(normalizeExerciseName('DB bench press')).toBe('haltere bench press');
    expect(normalizeExerciseName('Curl barbell')).toBe('curl barre');
    expect(normalizeExerciseName('Face pull câble')).toBe('face pull poulie');
    expect(normalizeExerciseName('DC')).toBe('developpe couche');
    expect(normalizeExerciseName('RDL')).toBe('souleve terre roumain');
  });

  it('score : 1 pour un nom identique après normalisation, symétrique, entre 0 et 1', () => {
    expect(exerciseNameScore('Curl marteau', 'curl MARTEAU')).toBe(1);
    expect(exerciseNameScore('Squat gobelet', 'Planche')).toBeLessThan(IMPORT_MATCH_DOUBT);
    expect(exerciseNameScore('Développé couché', 'Développé couché à la barre')).toBeCloseTo(exerciseNameScore('Développé couché à la barre', 'Développé couché'), 10);
  });

  it.each([
    ['Curl marteau', 'hammer-curl'],
    ['Développé couché à la barre', 'bench-press-barbell'],
    ['Elevation laterale aux halteres', 'lateral-raise-dumbbell'],
    ['Élévations latérales haltères', 'lateral-raise-dumbbell'],
    ['face pull', 'face-pull'],
    ['Goblet squat', 'goblet-squat'],
    ['Curl marteu', 'hammer-curl'],
    ['Fentes bulgares', 'split-squat-bulgarian'],
  ])('« %s » : proposé (%s)', (name, id) => {
    const match = matchExerciseName(name, library);
    expect(match.level).toBe('sure');
    expect(match.choices[0]?.id).toBe(id);
    expect(match.choices[0]?.score).toBeGreaterThanOrEqual(IMPORT_MATCH_SURE);
  });

  it('« Développé couché » : à confirmer, la barre et les haltères parmi les 3 choix', () => {
    const match = matchExerciseName('Développé couché', library);
    expect(match.level).toBe('doubt');
    expect(match.choices).toHaveLength(3);
    expect(match.choices.map((c) => c.id)).toEqual(expect.arrayContaining(['bench-press-barbell', 'bench-press-dumbbell']));
    const scores = match.choices.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('nom inconnu : à choisir', () => {
    const match = matchExerciseName('Lancer de pneu', library);
    expect(match.level).toBe('none');
  });

  it('les exercices personnels sont candidats ; égalité départagée par l’identifiant (déterministe)', () => {
    const customs = [...library, { id: 'b-custom', nameFr: 'Tirage poitrine machine Hammer', aliasesEn: [] }, { id: 'a-custom', nameFr: 'Tirage poitrine machine Hammer', aliasesEn: [] }];
    const match = matchExerciseName('Tirage poitrine machine hammer', customs);
    expect(match.choices[0]?.id).toBe('a-custom');
    expect(match.choices[1]?.id).toBe('b-custom');
    // Deux candidats au même score : jamais « proposé » d'office.
    expect(match.level).toBe('doubt');
  });

  it('liste vide : à choisir, sans choix', () => {
    expect(matchExerciseName('Squat', [])).toEqual({ level: 'none', choices: [] });
  });
});

describe('IMPORT-029a C-6 : routine Libre', () => {
  it('construit une routine Libre valide ; exercice retiré omis ; repos lu, sinon repos par défaut ; séance sans nom nommée', () => {
    const parsed = parseProgramText('Squat 4x5 repos 3 min\nCurl 3x12\nJour B\nPlanche 3 x 30 s RIR 2');
    const spec = importedRoutineSpec('Programme importé', parsed.sessions, (s, e) => (s === 0 && e === 1 ? null : { exerciseId: `ex-${s}-${e}`, exerciseName: `Exercice ${s}-${e}`, defaultRestSec: 75 }), (index) => `Séance ${index + 1}`);
    expect(spec).toEqual({
      name: 'Programme importé',
      mode: 'libre',
      days: [
        { name: 'Séance 1', dayOrder: 1, weekday: null, exercises: [{ exerciseId: 'ex-0-0', exerciseName: 'Exercice 0-0', sets: 4, repMin: 5, repMax: 5, rir: null, restSec: 180, position: 0 }] },
        { name: 'Jour B', dayOrder: 2, weekday: null, exercises: [{ exerciseId: 'ex-1-0', exerciseName: 'Exercice 1-0', sets: 3, repMin: 30, repMax: 30, rir: 2, restSec: 75, position: 0 }] },
      ],
    });
    expect(validateRoutine(spec)).toEqual([]);
  });
});
