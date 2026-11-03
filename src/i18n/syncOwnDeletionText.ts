import { syncOwnDeletionFr } from './fr.syncOwnDeletion';

/** Catalogue chargé avec la ligne d'échec, jamais au départ. */
export function tOwnDeletion(key: keyof typeof syncOwnDeletionFr, args: Readonly<Record<string, string>> = {}): string {
  return syncOwnDeletionFr[key].replace(/\{(\w+)\}/g, (_, name: string) => args[name] ?? '');
}
