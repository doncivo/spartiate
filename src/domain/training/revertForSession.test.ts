import { describe, expect, it } from 'vitest';
import { daysAgo } from '../../../tests/fixtures/training/progression';
import { revertForSession, type RevertTarget } from './revertPrescription';

/**
 * SEANCE-0292b (relecture D, D-543) : retour à la prescription précédente EN SÉANCE. La cible est ramenée sur la grille du profil courant
 * (D-496 : plus grande charge ≤ cible, donc plafonnée au maximum ; sous le minimum : pas de retour, comme D-536) ; un jour de décharge, un
 * retour qui alourdirait la séance (charge plus lourde, ou même charge et plus de répétitions) n'est pas proposé. Données SYNTHÉTIQUES.
 */

const target = (loadKg: number, reps: readonly number[] = [10, 10, 10]): RevertTarget => ({ loadKg, reps, decidedAt: daysAgo(9) });
const BAR = [20, 22.5, 25, 57.5, 60, 62.5, 100];
const base = { metric: 'load-reps', assisted: false, loads: BAR, deload: false, proposal: { loadKg: 62.5, reps: [8, 8, 8] } } as const;

describe('D-543 : retour en séance sur la grille du profil', () => {
  it('sur la grille : inchangé', () => {
    expect(revertForSession(target(60), base)).toEqual({ kind: 'available', target: target(60), offGridFromKg: null });
  });
  it('hors grille : plus grande charge ≤ cible, origine dite', () => {
    expect(revertForSession(target(61), base)).toEqual({ kind: 'available', target: target(60), offGridFromKg: 61 });
  });
  it('au-delà du maximum : plafonnée au maximum', () => {
    expect(revertForSession(target(120), { ...base, proposal: null })).toMatchObject({ kind: 'available', target: { loadKg: 100 }, offGridFromKg: 120 });
  });
  it('sous le minimum : pas de retour (D-536)', () => {
    expect(revertForSession(target(15), base)).toEqual({ kind: 'hidden', why: 'below-grid' });
  });
  it('sans grille ou assisté : la cible telle quelle', () => {
    expect(revertForSession(target(61), { ...base, loads: null })).toMatchObject({ kind: 'available', target: { loadKg: 61 }, offGridFromKg: null });
    expect(revertForSession(target(61), { ...base, assisted: true })).toMatchObject({ kind: 'available', target: { loadKg: 61 }, offGridFromKg: null });
  });
  it('sans charge (poids du corps, chronométré) : la grille ne s’applique pas', () => {
    expect(revertForSession(target(0, [45, 45]), { ...base, metric: 'time', loads: BAR })).toMatchObject({ kind: 'available', target: { loadKg: 0 } });
  });
});

describe('D-543 : jour de décharge', () => {
  const deload = { ...base, deload: true, proposal: { loadKg: 50, reps: [8, 8] } } as const;
  it('retour plus lourd que la proposition allégée : non proposé', () => {
    expect(revertForSession(target(60), deload)).toEqual({ kind: 'hidden', why: 'deload-heavier' });
  });
  it('même charge, plus de répétitions au total : non proposé', () => {
    expect(revertForSession(target(50, [10, 10]), deload)).toEqual({ kind: 'hidden', why: 'deload-heavier' });
  });
  it('retour plus léger : proposé', () => {
    expect(revertForSession(target(22.5, [8, 8]), deload)).toMatchObject({ kind: 'available', target: { loadKg: 22.5 } });
  });
  it('assisté : alourdir = moins d’assistance', () => {
    expect(revertForSession(target(20), { ...deload, assisted: true, loads: null, proposal: { loadKg: 30, reps: [8, 8] } })).toEqual({ kind: 'hidden', why: 'deload-heavier' });
  });
  it('proposition sans charge un jour de décharge (à saisir) : pas de retour', () => {
    expect(revertForSession(target(60), { ...deload, proposal: null })).toEqual({ kind: 'hidden', why: 'deload-heavier' });
  });
  it('hors décharge : un retour n’est jamais caché pour son poids', () => {
    expect(revertForSession(target(60), { ...base, proposal: { loadKg: 50, reps: [8] } })).toMatchObject({ kind: 'available' });
  });
});
