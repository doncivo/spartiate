import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { prescriptionAdherence, type PrescribedSet } from './progressStats';

/** DATA-0293 (BL-135, D-481) : une série ajoutée en séance n'entre pas dans les « proposées » ; une proposée non faite est une série retirée. Valeurs synthétiques. */
const TODAY = '2026-11-18' as LocalDate;
const set = (over: Partial<PrescribedSet>): PrescribedSet => ({ setKind: 'work', done: true, targetRepsMin: 8, targetLoadKg: 80, loadKg: 80, ...over });
const day = (sets: PrescribedSet[]) => ({ workouts: [{ day: '2026-11-10' as LocalDate, sets }], today: TODAY });

describe('prescriptionAdherence : séries ajoutées et retirées (D-481)', () => {
  it('une série ajoutée (faite) n’est ni proposée ni faite ; elle est comptée à part', () => {
    const r = prescriptionAdherence(day([set({}), set({}), set({ added: true })]));
    expect(r).toMatchObject({ setsProposed: 2, setsDone: 2, setsPercent: 100, setsAdded: 1, setsRemoved: 0 });
  });

  it('une proposée non faite compte comme retirée', () => {
    const r = prescriptionAdherence(day([set({}), set({ done: false, loadKg: null }), set({ added: true, loadKg: 90 })]));
    expect(r).toMatchObject({ setsProposed: 2, setsDone: 1, setsPercent: 50, setsRemoved: 1, setsAdded: 1, loadsProposed: 2, loadsHeld: 1 });
  });

  it('une série ajoutée ne compte pas dans les charges ; sans marque (séances d’avant) : comportement d’avant', () => {
    const r = prescriptionAdherence(day([set({ added: true, targetLoadKg: 100, loadKg: 50 }), set({ added: null })]));
    expect(r).toMatchObject({ setsProposed: 1, loadsProposed: 1, loadsHeld: 1, setsAdded: 1 });
  });

  it('que des séries ajoutées : rien à mesurer (null)', () => {
    expect(prescriptionAdherence(day([set({ added: true })]))).toBeNull();
  });
});
