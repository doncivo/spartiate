import { useCallback, useEffect, useState } from 'react';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { logFailure } from '../../platform/desktop/log';
import { useSyncedData } from '../sync/remoteChanges';
import { loadNutritionSnapshot, type NutritionSnapshot } from './useCases';

export type NutritionLoad = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly snapshot: NutritionSnapshot; readonly stale: boolean };

/**
 * État partagé des sections de Nutrition : un instantané (journal des 60 derniers jours, pesées, cible, dépense), relu après chaque écriture
 * et à chaque lot de synchro qui touche ces tables. Un échec de lecture est dit (jamais un écran vide) ; après un premier succès, un échec de relecture garde
 * les dernières valeurs mais les marque périmées (`stale`, REV-01 constat 4) jusqu'au prochain succès, et est journalisé (`nutrition-reload-failed`).
 */
export function useNutritionData(data: DataAccess, today: LocalDate): { readonly state: NutritionLoad; readonly reload: () => Promise<void> } {
  const [state, setState] = useState<NutritionLoad>({ status: 'loading' });
  const synced = useSyncedData(['meal_entry', 'nutrition_target', 'body_weight', 'profile', 'food', 'day_completeness']);
  const reload = useCallback(async (): Promise<void> => {
    try {
      setState({ status: 'ready', snapshot: await loadNutritionSnapshot(data, today), stale: false });
    } catch {
      logFailure('nutrition', 'nutrition-reload-failed');
      setState((now) => (now.status === 'ready' ? { ...now, stale: true } : { status: 'error' }));
    }
  }, [data, today]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const snapshot = await loadNutritionSnapshot(data, today);
        if (live) setState({ status: 'ready', snapshot, stale: false });
      } catch {
        // Base fermée avant la fin de la lecture (écran quitté) : rien à afficher ; sinon le message d'échec et « Réessayer ».
        if (live) {
          logFailure('nutrition', 'nutrition-reload-failed');
          setState((now) => (now.status === 'ready' ? { ...now, stale: true } : { status: 'error' }));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [data, today, synced]);

  return { state, reload };
}
