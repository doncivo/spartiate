import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { input, session, target } from '../../../tests/fixtures/training/progression';
import { explainPrescription, explanationNotes } from './explain';
import { positionRanks } from './positionRank';
import { prescribe } from './prescribe';
import type { MuscleWeight } from './types';

/**
 * REV-01 constat 6 (PRD § 11.3, D-72 point 5) : le multiplicateur de position (2ᵉ exercice d'un muscle × 0,93 ; 3ᵉ × 0,88) est appliqué
 * dans la prescription réelle ; les autres muscles sont inchangés ; une décote déjà reflétée dans l'historique n'est pas comptée deux fois.
 */
const CATALOGUE = (JSON.parse(readFileSync('content/exercises/exercises.json', 'utf8')) as { exercises: { id: string; muscles: MuscleWeight[] }[] }).exercises;
const muscles = (id: string): readonly MuscleWeight[] => CATALOGUE.find((e) => e.id === id)?.muscles ?? [];
const block = (exerciseId: string) => ({ exerciseId, muscles: muscles(exerciseId) });

/** Routine d'Ali « Haut / Bas », jour Haut : deux exercices de pectoraux, puis épaules, puis triceps. */
const HAUT = [block('bench-press-barbell'), block('incline-press-dumbbell'), block('overhead-press-barbell'), block('lateral-raise-dumbbell'), block('triceps-pushdown-cable')];
const hist = (loadKg = 60) => [session(3, loadKg, [10, 10, 10])];

describe('REV-01 constat 6 : rang de position par muscle principal', () => {
  it('Haut / Bas, deux exercices de pectoraux : le premier est au rang 1, le second au rang 2, les autres muscles au rang 1', () => {
    const ranks = positionRanks(HAUT);
    expect(ranks.get('bench-press-barbell')).toBe(1);
    expect(ranks.get('incline-press-dumbbell')).toBe(2);
    expect(ranks.get('overhead-press-barbell')).toBe(1);
    expect(ranks.get('lateral-raise-dumbbell')).toBe(1);
    expect(ranks.get('triceps-pushdown-cable')).toBe(1);
  });

  it('un troisième exercice du même muscle est au rang 3 ; un exercice répété ne compte qu’une fois', () => {
    const ranks = positionRanks([block('bench-press-barbell'), block('bench-press-barbell'), block('incline-press-dumbbell'), block('fly-flat-dumbbell')]);
    expect([ranks.get('bench-press-barbell'), ranks.get('incline-press-dumbbell'), ranks.get('fly-flat-dumbbell')]).toEqual([1, 2, 3]);
  });
});

describe('REV-01 constat 6 : application dans la prescription', () => {
  const base = () => prescribe(input({ history: hist(), target: target(8, 10) }));

  it('rang 1 : prescription inchangée', () => {
    expect(prescribe(input({ history: hist(), target: target(8, 10), positionRank: 1, lastPositionRank: 1 }))).toEqual(base());
  });

  it('2ᵉ position, dernière séance au rang 1 : la charge est plus basse, la raison est posée et la phrase le dit', () => {
    const p = prescribe(input({ history: hist(), target: target(8, 10), positionRank: 2, lastPositionRank: 1 }));
    expect(p.loadKg).not.toBeNull();
    expect(p.loadKg ?? 0).toBeLessThan(base().loadKg ?? 0);
    expect(p.reasons).toContain('position-discount');
    const explained = [explainPrescription(p).key, ...explanationNotes(p).map((n) => n.key)];
    expect(explained.some((k) => k === 'position' || k === 'notePosition')).toBe(true);
  });

  it('3ᵉ position : plus basse que la 2ᵉ', () => {
    const second = prescribe(input({ history: hist(), target: target(8, 10), positionRank: 2, lastPositionRank: 1 }));
    const third = prescribe(input({ history: hist(), target: target(8, 10), positionRank: 3, lastPositionRank: 1 }));
    expect(third.loadKg ?? 0).toBeLessThan(second.loadKg ?? 0);
  });

  it('décote déjà reflétée dans l’historique (dernière séance déjà au rang 2) : pas comptée deux fois', () => {
    const p = prescribe(input({ history: hist(), target: target(8, 10), positionRank: 2, lastPositionRank: 2 }));
    expect(p).toEqual(base());
    expect(p.reasons).not.toContain('position-discount');
  });

  it('passage du rang 2 au rang 1 : jamais de hausse supplémentaire', () => {
    const p = prescribe(input({ history: hist(), target: target(8, 10), positionRank: 1, lastPositionRank: 2 }));
    expect(p).toEqual(base());
  });

  it('une décision d’Ali et le « à saisir » ne sont pas modulés', () => {
    const none = prescribe(input({ history: [], positionRank: 3, lastPositionRank: 1 }));
    expect(none.status).toBe('to-enter');
    expect(none.reasons).not.toContain('position-discount');
  });
});
