import { describe, expect, it } from 'vitest';
import { linkedRir, parseSessionLink, sessionRoutineId } from './sessionLink';

/** I4-08 : lien local d'une séance proposée (routine source, RIR cible par exercice). */

const LINK = { v: 1, workoutId: 'w1', routineId: 'r1', rir: { bench: 1, row: null } } as const;

describe('sessionLink', () => {
  it('lu tel quel ; valeur absente, autre version ou illisible : null ; RIR hors bornes écarté', () => {
    expect(parseSessionLink(LINK)).toEqual(LINK);
    for (const raw of [null, undefined, 'x', 3, [], { ...LINK, v: 2 }, { ...LINK, workoutId: '' }, { ...LINK, routineId: 7 }, { ...LINK, rir: [] }]) expect(parseSessionLink(raw)).toBeNull();
    expect(parseSessionLink({ ...LINK, rir: { bench: 1.5, row: -1, curl: 11, squat: 2 } })?.rir).toEqual({ squat: 2 });
  });

  it('routine de la séance : démarrée depuis la routine, ou proposée (lien de CETTE séance) ; libre : null', () => {
    const link = parseSessionLink(LINK);
    expect(sessionRoutineId({ id: 'w9', routineId: 'r2' }, link)).toBe('r2');
    expect(sessionRoutineId({ id: 'w1', routineId: null }, link)).toBe('r1');
    expect(sessionRoutineId({ id: 'w2', routineId: null }, link)).toBeNull();
    expect(sessionRoutineId({ id: 'w1', routineId: null }, null)).toBeNull();
  });

  it('RIR cible : seulement pour la séance du lien', () => {
    const link = parseSessionLink(LINK);
    expect(linkedRir({ id: 'w1' }, link, 'bench')).toBe(1);
    expect(linkedRir({ id: 'w1' }, link, 'row')).toBeNull();
    expect(linkedRir({ id: 'w1' }, link, 'curl')).toBeNull();
    expect(linkedRir({ id: 'w2' }, link, 'bench')).toBeNull();
  });
});
