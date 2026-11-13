import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '../types';
import { prescriptionInputOf, routineLineTarget, type PrescriptionContext } from './prescriptionInput';

/** FIX-0223 (D-260) : entrée du moteur partagée par la séance active et l'aperçu de la carte « Séance du jour ». */

const NOW = '2026-11-13T07:00:00.000Z' as IsoDateTime;
const context = (over: Partial<PrescriptionContext> = {}): PrescriptionContext => ({ history: [], reference: null, profile: null, lastPositionRank: null, bodyweightKg: null, ...over });
const args = (ctx: PrescriptionContext) => ({ exerciseId: 'bench-press-barbell', exercise: undefined, context: ctx, equipment: null, target: routineLineTarget({ sets: 3, repMin: 8, repMax: 10 }, null), now: NOW, recovery: null, deload: false, positionRank: 1 });

describe('prescriptionInputOf', () => {
  it('un refus (aucune charge retenue) ne fixe aucune référence ; une charge retenue, si', () => {
    expect(prescriptionInputOf(args(context({ reference: { decidedAt: NOW, accepted: false, loadKg: null, reps: [] } }))).lastDecision).toBeNull();
    expect(prescriptionInputOf(args(context({ reference: { decidedAt: NOW, accepted: true, loadKg: 80, reps: [8, 8, 8] } }))).lastDecision).toEqual({ decidedAt: NOW, accepted: true, loadKg: 80, reps: [8, 8, 8] });
  });

  it('rang de référence inconnu : absent de l’entrée (aucune décote) ; exercice inconnu : charge × répétitions par défaut', () => {
    const input = prescriptionInputOf(args(context()));
    expect('lastPositionRank' in input).toBe(false);
    expect(input.exercise).toEqual({ id: 'bench-press-barbell', metric: 'load-reps', equipment: [] });
    expect(prescriptionInputOf(args(context({ lastPositionRank: 2 }))).lastPositionRank).toBe(2);
  });
});

describe('routineLineTarget', () => {
  it('cible de la ligne telle que la séance la crée : au moins une série, plage jamais inversée', () => {
    expect(routineLineTarget({ sets: 3, repMin: 8, repMax: 10 }, null)).toEqual({ sets: 3, repMin: 8, repMax: 10, rir: null });
    expect(routineLineTarget({ sets: 0, repMin: 12, repMax: 8 }, 2)).toEqual({ sets: 1, repMin: 12, repMax: 12, rir: 2 });
  });
});
