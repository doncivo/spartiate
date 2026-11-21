import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { DEFAULT_PROGRESS_CONFIG } from './config';
import { prescriptionAdherence, volumeRangeStatus, type PrescribedSet } from './progressStats';

/**
 * Lot 0.29.1, décisions d'Ali du 21/11. BL-114 (D-448) : plage cible de 10 à 20 séries difficiles par muscle et par semaine, jugée sur la
 * dernière semaine complète (D-455). BL-115 (D-449) : adhérence aux prescriptions, séries et charges faites / proposées sur les
 * 4 dernières semaines complètes (D-456). Valeurs synthétiques.
 */
const d = (s: string): LocalDate => s as LocalDate;
const TODAY = d('2026-11-18'); // semaine en cours : 16/11 (exclue)

describe('volumeRangeStatus (BL-114, D-448, D-455)', () => {
  const muscle = (perWeek: number[]) => ({ muscleId: 'pecs', perWeek, total: perWeek.reduce((a, b) => a + b, 0) });

  it('plage par défaut : 10 à 20 séries par semaine', () => {
    expect(DEFAULT_PROGRESS_CONFIG.volumeRange).toEqual({ min: 10, max: 20 });
  });

  it('jugée sur la dernière semaine complète, bornes comprises ; la semaine en cours ne compte pas', () => {
    expect(volumeRangeStatus(muscle([0, 9.9, 30]))).toEqual({ status: 'below', sets: 9.9 });
    expect(volumeRangeStatus(muscle([0, 10, 0]))).toEqual({ status: 'within', sets: 10 });
    expect(volumeRangeStatus(muscle([0, 20, 0]))).toEqual({ status: 'within', sets: 20 });
    expect(volumeRangeStatus(muscle([0, 20.1, 0]))).toEqual({ status: 'above', sets: 20.1 });
  });

  it('aucune semaine complète (fenêtre d’une semaine) : aucun jugement', () => {
    expect(volumeRangeStatus(muscle([12]))).toBeNull();
  });

  it('plage fournie par la configuration', () => {
    expect(volumeRangeStatus(muscle([0, 6, 0]), { ...DEFAULT_PROGRESS_CONFIG, volumeRange: { min: 4, max: 8 } })).toEqual({ status: 'within', sets: 6 });
  });
});

const set = (over: Partial<PrescribedSet>): PrescribedSet => ({
  setKind: 'work',
  done: true,
  targetRepsMin: 8,
  targetLoadKg: 60,
  loadKg: 60,
  ...over,
});

describe('prescriptionAdherence (BL-115, D-449, D-456)', () => {
  it('séries faites / proposées et charges tenues / proposées, sur les 4 dernières semaines complètes', () => {
    const workouts = [
      // S-1 (09/11) : 3 proposées, 2 faites, dont 1 sous la charge proposée.
      { day: d('2026-11-10'), sets: [set({}), set({ loadKg: 57.5 }), set({ done: false, loadKg: null })] },
      // S-4 (19/10) : 1 proposée sans charge (poids du corps), faite.
      { day: d('2026-10-20'), sets: [set({ targetLoadKg: null, loadKg: null })] },
      // Hors fenêtre : semaine en cours et S-5.
      { day: d('2026-11-16'), sets: [set({ done: false })] },
      { day: d('2026-10-13'), sets: [set({ done: false })] },
    ];
    expect(prescriptionAdherence({ workouts, today: TODAY })).toEqual({ setsDone: 3, setsProposed: 4, setsPercent: 75, loadsHeld: 1, loadsProposed: 3, loadsPercent: 33, weeks: 4 });
  });

  it('charge au-dessus de la proposition : tenue ; échauffement, drop, partielle et série ajoutée sans cible : non proposées', () => {
    const workouts = [
      {
        day: d('2026-11-11'),
        sets: [
          set({ loadKg: 62.5 }),
          set({ setKind: 'warmup', done: false }),
          set({ setKind: 'drop', done: false }),
          set({ setKind: 'partial', done: false }),
          set({ targetRepsMin: null, targetLoadKg: null, done: false }),
        ],
      },
    ];
    expect(prescriptionAdherence({ workouts, today: TODAY })).toEqual({ setsDone: 1, setsProposed: 1, setsPercent: 100, loadsHeld: 1, loadsProposed: 1, loadsPercent: 100, weeks: 4 });
  });

  it('série chronométrée proposée (durée cible dans targetRepsMin) : comptée dans les séries, pas dans les charges', () => {
    const workouts = [{ day: d('2026-11-12'), sets: [set({ setKind: 'timed', targetRepsMin: 45, targetLoadKg: null, loadKg: null })] }];
    expect(prescriptionAdherence({ workouts, today: TODAY })).toEqual({ setsDone: 1, setsProposed: 1, setsPercent: 100, loadsHeld: 0, loadsProposed: 0, loadsPercent: null, weeks: 4 });
  });

  it('aucune série proposée dans la fenêtre : non calculée (null), jamais 0 %', () => {
    expect(prescriptionAdherence({ workouts: [], today: TODAY })).toBeNull();
    expect(prescriptionAdherence({ workouts: [{ day: d('2026-11-17'), sets: [set({})] }], today: TODAY })).toBeNull();
  });

  it('début de semaine réglé : la fenêtre suit le réglage', () => {
    // Semaine commençant le dimanche : le dimanche 15/11 appartient à la semaine en cours (15/11), exclue.
    const workouts = [{ day: d('2026-11-15'), sets: [set({})] }];
    expect(prescriptionAdherence({ workouts, today: TODAY, firstWeekday: 'sunday' })).toBeNull();
    expect(prescriptionAdherence({ workouts, today: TODAY, firstWeekday: 'monday' })?.setsProposed).toBe(1);
  });
});
