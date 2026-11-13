import { useEffect, useState } from 'react';
import type { RemoteChanges } from '../../platform/sync/types';
import { defaultSyncLogger, type SyncLogger } from '../../sync';
import type { AppContainer } from '../app/container';

/**
 * Après chaque lot appliqué par la synchro (ADR 0011 section 8 ; Y-02 critère 18) : les écrans qui affichent des lignes reçues relisent
 * leurs données. 0.1.4 (2) : l'événement « données synchronisées appliquées » porte les tables touchées ; Profil et poids et Aujourd'hui
 * s'y abonnent (`useSyncedData`) et se rechargent sans changer d'onglet. Une relecture ou un abonné en échec est journalisé par code et
 * rendu dans `failed` (contrat inchangé pour `startSync`).
 */
type Listener = (tables: ReadonlySet<string>) => void;
const listeners = new Set<Listener>();

/** S'abonne aux lots appliqués ; rend la fonction de désabonnement. */
export function onSyncedDataApplied(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyRemoteChanges(_container: AppContainer, change: RemoteChanges, logger: SyncLogger = defaultSyncLogger): Promise<{ readonly failed: readonly string[] }> {
  const failed: string[] = [];
  for (const listener of [...listeners]) {
    try {
      listener(change.tables);
    } catch {
      logger.log('remote-reload-failed', { code: 'listener' });
      failed.push('listener');
    }
  }
  return Promise.resolve({ failed });
}

/**
 * FIX-0221 : une écriture locale faite hors de l'écran qui l'affiche (action « Pris » d'une notification, appliquée au réveil de l'app) prévient
 * les mêmes abonnés, pour que la carte d'Aujourd'hui se relise et que les rappels se replanifient. Ne touche ni la synchro ni ses journaux.
 */
export function announceLocalChanges(tables: readonly string[]): void {
  const touched = new Set(tables);
  for (const listener of [...listeners]) {
    try {
      listener(touched);
    } catch {
      // Un abonné en échec n'empêche pas les autres ; l'écriture est déjà faite. Journalisé comme pour un lot reçu.
      defaultSyncLogger.log('remote-reload-failed', { code: 'listener' });
    }
  }
}

/**
 * Compteur qui change chaque fois qu'un lot appliqué touche l'une des `tables` : à mettre dans les dépendances de l'effet de lecture de
 * l'écran. Un lot sans rapport ne change rien.
 */
export function useSyncedData(tables: readonly string[]): number {
  const [version, setVersion] = useState(0);
  const key = tables.join('|');
  useEffect(() => {
    const wanted = key.split('|');
    return onSyncedDataApplied((touched) => {
      if (wanted.some((table) => touched.has(table))) setVersion((v) => v + 1);
    });
  }, [key]);
  return version;
}
