import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { estimateSessionSec } from '../../../domain/training/generateSession';
import { dumbbellsHeld } from '../../../domain/training/dumbbellPair';
import { loadGrid } from '../../../domain/training/loadGrid';
import { positionRanks } from '../../../domain/training/positionRank';
import { prescribe } from '../../../domain/training/prescribe';
import { prescriptionInputOf, routineLineTarget } from '../../../domain/training/prescriptionInput';
import type { Exercise, RoutineDay } from '../../../domain/training/types';
import type { IsoDateTime } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { readTrainingData } from '../trainingState';
import { loadPrescriptionContext } from './prescriptionContext';

/**
 * Aperçu de la carte « Séance du jour » (FIX-0223, D-260) : durée estimée du jour (`estimateSessionSec`, réglages par défaut de la génération,
 * arrondie à la minute) et charge que la séance active proposera pour les premiers exercices. Module chargé à la demande par la carte
 * (import dynamique) : le moteur de prescription n'entre jamais dans le départ.
 *
 * Même entrée que la séance active au lancement depuis la routine : séances closes, décision de référence, profil, matériel actif de cet
 * appareil, cible de la ligne (séries, plage), aucun RIR lié (séance démarrée depuis la routine), aucune journée rouge (le choix d'Ali vaut
 * pour une séance ouverte, il n'existe pas avant), deload si la semaine du cycle en est une, rang de position dans le jour.
 * Charge inconnue (à saisir, métrique sans charge, poids du corps sans lest, lecture impossible) : null, jamais un chiffre deviné.
 */

export interface TodaySessionPreview {
  /** Durée estimée en minutes entières. */
  readonly minutes: number;
  /** Charge proposée par identifiant de ligne du jour (lignes demandées seulement) ; null : inconnue. */
  readonly loads: ReadonlyMap<string, number | null>;
  /** ERGO-02 (D-261) : haltères tenus par ligne (2 : « 2 × 26 kg », 1 : « 26 kg », null : la charge ne vient pas des haltères) ; affichage seulement. */
  readonly held: ReadonlyMap<string, 1 | 2 | null>;
}

export async function loadTodaySessionPreview(access: DataAccess, day: RoutineDay, lineIds: readonly string[], options: { readonly nowMs: number; readonly deload: boolean }): Promise<TodaySessionPreview> {
  const minutes = Math.round(estimateSessionSec(day.exercises, DEFAULT_GENERATION_CONFIG) / 60);
  const loads = new Map<string, number | null>();
  const held = new Map<string, 1 | 2 | null>();
  let data: Awaited<ReturnType<typeof readTrainingData>>;
  try {
    data = await readTrainingData(access);
  } catch {
    return { minutes, loads, held };
  }
  const exerciseOf = (id: string): Exercise | undefined => data.content.catalog.get(id) ?? data.allCustoms.find((c) => c.id === id);
  const musclesOf = (id: string) => exerciseOf(id)?.muscles ?? [];
  const ordered = [...day.exercises].sort((a, b) => a.position - b.position);
  const ranks = positionRanks(ordered.map((l) => ({ exerciseId: l.exerciseId, muscles: musclesOf(l.exerciseId) })));
  const now = new Date(options.nowMs).toISOString() as IsoDateTime;
  await Promise.all(
    ordered
      .filter((l) => lineIds.includes(l.id))
      .map(async (line) => {
        const exercise = exerciseOf(line.exerciseId);
        held.set(line.id, exercise === undefined ? null : dumbbellsHeld(exercise, loadGrid(exercise.equipment, data.active)?.source));
        try {
          const context = await loadPrescriptionContext(access, line.exerciseId, exercise, musclesOf);
          const p = prescribe(
            prescriptionInputOf({
              exerciseId: line.exerciseId,
              exercise,
              context,
              equipment: data.active,
              target: routineLineTarget(line, null),
              now,
              recovery: null,
              deload: options.deload,
              positionRank: ranks.get(line.exerciseId) ?? 1,
            }),
          );
          loads.set(line.id, p.status === 'prescribed' && p.loadKg !== null && p.loadKg > 0 ? p.loadKg : null);
        } catch {
          loads.set(line.id, null);
        }
      }),
  );
  return { minutes, loads, held };
}
