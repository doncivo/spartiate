// AUDIT-CLAUDE-0.27.0, partie 7a : Aujourd'hui et Entraînement (fonctions pures appelées par les écrans). Jamais branché sur la CI.
import { describe, expect, it } from 'vitest';
import { input, session } from '../../../tests/fixtures/training/progression';
import { prescribe } from '../../../src/domain/training/prescribe';
import { validateSetEntry } from '../../../src/domain/training/session';
import { programDayFor } from '../../../src/domain/training/programDay';
import { parseNumber } from '../../../src/i18n/trainingText';
import type { LocalDate } from '../../../src/domain/types';

describe('C-005 (reclassé bloquant) faute de frappe plausible : 200 au lieu de 100', () => {
  it('ROUGE la saisie de 200 kg × 8 après trois séances à 100 kg × 8 est acceptée sans alerte (bornes 0-1 000 seulement)', () => {
    expect(validateSetEntry({ loadKg: 100, reps: 8, rir: null, durationSec: null } as never, 'work')).toEqual([]); // témoin
    expect(validateSetEntry({ loadKg: 200, reps: 8, rir: null, durationSec: null } as never, 'work').length).toBeGreaterThan(0);
  });
  it('ROUGE la séance suivante ne prescrit pas 200 kg (> 150 % du 1RM courant, non confirmée)', () => {
    const p = prescribe(input({ history: [session(2, 200, [8, 8, 8]), session(5, 100, [8, 8, 8]), session(8, 100, [8, 8, 8]), session(11, 100, [8, 8, 8])] }));
    expect(p.loadKg as number).toBeLessThan(150);
  });
});

describe('C-018 séance du jour proposée de nouveau après avoir été faite', () => {
  it('ROUGE lundi, séance « Lundi » close aujourd’hui : la carte ne propose plus « Lundi » (repos ou faite)', () => {
    const r = programDayFor([{ id: 'L', dayOrder: 1, weekday: 1, exercises: [1] }, { id: 'J', dayOrder: 2, weekday: 4, exercises: [1] }], [{ routineId: 'r', routineDayId: 'L' }], 'r', '2026-11-16' as LocalDate);
    expect(r).not.toMatchObject({ kind: 'day', dayId: 'L' });
  });
});

describe('C-066 liste des disques ou kettlebells : la virgule est une décimale', () => {
  it('ROUGE « 12,16 » saisi comme deux kettlebells n’est pas lu comme un seul poids de 12,16 kg', () => {
    expect(parseNumber('12,16')).not.toBe(12.16);
  });
});
