import { useAppContainer, useFeatureStore } from '../app/AppContainerContext';
import { useSyncAvailable } from '../sync/SyncSettingsSection';
import { syncStore } from '../sync/syncStore';
import { statusLine } from '../sync/syncText';

/**
 * Valeur actuelle de « Appareils et synchro » dans Plus : la phrase d'état de la synchro, la même que la carte de l'écran de détails.
 * `null` quand la plateforme ne synchronise pas (la ligne n'est alors pas montrée).
 */
export function useSyncValue(): string | null {
  const container = useAppContainer();
  const available = useSyncAvailable();
  const status = useFeatureStore(syncStore, (s) => s.status);
  if (!available) return null;
  return statusLine(status, container.clock.nowMs());
}
