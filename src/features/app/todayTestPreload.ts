import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb } from '../../db/repositories/sql/testSetup';
import { loadNutritionSnapshot } from '../nutrition/useCases';
import { readTrainingData } from '../training/trainingState';

/**
 * ERGO-02, tests seulement : premier import des blocs à la demande d'Aujourd'hui (colonne droite PC, séance, récupération, nutrition,
 * compléments, notices) et premières lectures sur une base jetable, dans `beforeAll`, hors de la mesure des attentes. À froid (CI), ces
 * blocs se chargent ensemble et dépassent l'attente par défaut de `findBy*` ; aucune attente n'est allongée.
 */
/** Appareil de la base jetable, distinct de celui des tests (une base par appareil). */
const WARM_DEVICE = '60000000-0000-4000-8000-00000000fa11' as DeviceId;

export async function preloadTodayBlocks(nowIso: string, withReads = true): Promise<void> {
  await Promise.all([
    import('./TodayPcSide'),
    import('./SectionNotice'),
    import('../training/session/TodaySessionCard'),
    import('../nutrition/NutritionRemainingCard'),
    import('../nutrition/supplements/SupplementsTodayCard'),
    import('../recovery/RecoveryToday'),
  ]);
  if (!withReads) return;
  const warm = await openBaseDb(WARM_DEVICE, nowIso);
  try {
    await loadNutritionSnapshot(warm.data, nowIso.slice(0, 10) as LocalDate);
    await readTrainingData(warm.data);
    await (await warm.data.repos.workouts()).listClosed(10);
  } finally {
    await warm.close();
  }
}
