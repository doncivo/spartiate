import { useCallback, useEffect, useState } from 'react';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { useSyncedData } from '../sync/remoteChanges';
import { loadNutritionSnapshot, type NutritionSnapshot } from './useCases';

export type NutritionLoad = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly snapshot: NutritionSnapshot };

/**
 * État partagé des sections de Nutrition : un instantané (journal des 60 derniers jours, pesées, cible, dépense), relu après chaque écriture
 * et à chaque lot de synchro qui touche ces tables. Un échec de lecture est dit (jamais un écran vide).
 */
export function useNutritionData(data: DataAccess, today: LocalDate): { readonly state: NutritionLoad; readonly reload: () => Promise<void> } {
  const [state, setState] = useState<NutritionLoad>({ status: 'loading' });
  const synced = useSyncedData(['meal_entry', 'nutrition_target', 'body_weight', 'profile', 'food', 'day_completeness']);
  const reload = useCallback(async (): Promise<void> => {
    try {
      setState({ status: 'ready', snapshot: await loadNutritionSnapshot(data, today) });
    } catch {
      setState((now) => (now.status === 'ready' ? now : { status: 'error' }));
    }
  }, [data, today]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const snapshot = await loadNutritionSnapshot(data, today);
        if (live) setState({ status: 'ready', snapshot });
      } catch {
        // Base fermée avant la fin de la lecture (écran quitté) : rien à afficher ; sinon le message d'échec et « Réessayer ».
        if (live) setState((now) => (now.status === 'ready' ? now : { status: 'error' }));
      }
    })();
    return () => {
      live = false;
    };
  }, [data, today, synced]);

  return { state, reload };
}
