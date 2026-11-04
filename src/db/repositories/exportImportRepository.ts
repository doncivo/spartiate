import type { ExportData } from '../../domain/exportImport/archive';
import type { ImportPlan } from '../../domain/exportImport/plan';

/**
 * Export / import (SPA-005, D-57). Lecture : l'état publiable du profil et des pesées (lignes non supprimées, sans hlc ni appareil).
 * Écriture : `applyImport` écrit le plan DANS LA TRANSACTION DE L'APPELANT (`data.transaction`) : garde de synchro posée puis retirée,
 * lignes, horloges de champ de l'appareil importateur, une entrée `'*'` par ligne écrite, suppressions logiques (`deleted_at`, horloge,
 * entrée outbox). Jamais de `sync_tombstone`, jamais de nouvelle époque. Les réglages ne passent pas ici (`SettingsRepository`).
 */
export interface ExportImportRepository {
  readExportData(): Promise<ExportData>;
  /** `currentYear` borne l'année de naissance. Plan invalide : `RepositoryError('invalid')` et rien d'écrit. */
  applyImport(plan: ImportPlan, currentYear: number): Promise<void>;
}
