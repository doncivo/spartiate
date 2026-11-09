import type { SleepStage } from '../../domain/recovery';

/**
 * Échantillons importés des fichiers Raccourcis (tables LOCALES `recovery_sample` et `recovery_import_state`, migration 0010 ; I5-01 point 1.5,
 * D-69). Jamais publiés : aucune colonne de synchro, aucun déclencheur, rien dans la file ; ils restent sur l'appareil qui les a importés.
 *
 * - Un échantillon d'un instant a `startAt = endAt` ; sommeil : un segment par ligne (stade obligatoire, pas de valeur) ; autres types : valeur
 *   obligatoire (0 de pas est une vraie valeur), pas de stade. `null` ne devient jamais 0.
 * - Clé d'unicité : type, début, fin, stade. `insertMany` ignore les doublons (réimporter un fichier n'ajoute rien, la valeur d'origine est
 *   conservée) et les compte ; le lot est tout ou rien (`RepositoryError('invalid')` si une ligne est invalide, rien n'est écrit).
 * - Conservation : 120 jours (`RECOVERY_SAMPLE_RETENTION_DAYS`), purge explicite (le dépôt ne lit jamais l'horloge : `now` est un paramètre).
 * - État du dernier import : un par type, des comptes seulement (jamais une valeur corporelle).
 */

export const RECOVERY_SAMPLE_RETENTION_DAYS = 120;

export type RecoverySampleType = 'hrv' | 'fc-repos' | 'sommeil' | 'pas';

export interface RecoverySampleInput {
  readonly type: RecoverySampleType;
  /** Instants ISO 8601 UTC (`toISOString`). */
  readonly startAt: string;
  readonly endAt: string;
  readonly value: number | null;
  readonly stage: SleepStage | null;
  /** Nom du fichier d'origine (1 à 128 caractères). */
  readonly source: string;
}

export interface RecoverySample extends RecoverySampleInput {
  readonly id: number;
  readonly importedAt: string;
}

export interface RecoveryImportState {
  readonly type: RecoverySampleType;
  readonly importedAt: string;
  /** Fin de l'échantillon le plus récent importé, ou `null` (fichier sans échantillon). */
  readonly newestSampleAt: string | null;
  readonly added: number;
  readonly duplicates: number;
  readonly rejected: number;
}

export interface InsertSamplesResult {
  readonly added: number;
  readonly duplicates: number;
}

export interface RecoverySampleRepository {
  /** Insère le lot en ignorant les doublons ; `importedAt` est l'instant de l'import (fourni par l'appelant). */
  insertMany(samples: readonly RecoverySampleInput[], importedAt: string): Promise<InsertSamplesResult>;
  /** Échantillons d'un type qui chevauchent la fenêtre (bornes incluses), du plus ancien au plus récent. */
  listWindow(type: RecoverySampleType, from: string, to: string): Promise<readonly RecoverySample[]>;
  /** Supprime les échantillons terminés avant `now` moins `days` jours (120 par défaut) ; rend le nombre supprimé. */
  purgeOlderThan(now: string, days?: number): Promise<number>;
  /** Remplace l'état du dernier import de ce type. */
  recordImport(state: RecoveryImportState): Promise<void>;
  getImportState(type: RecoverySampleType): Promise<RecoveryImportState | null>;
  /** États présents, triés par type. */
  listImportStates(): Promise<readonly RecoveryImportState[]>;
}
