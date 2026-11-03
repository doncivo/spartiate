import type { Migration } from '../migrator';
import { migration0001SpartiateInit } from './0001_spartiate_init';

/**
 * Registre ordonné des migrations de l'app. Ajouter chaque nouveau fichier
 * `NNNN_titre.ts` ici, à la fin, sans jamais modifier une entrée publiée.
 * Base neuve Spartiate (SPA-001b, D-23) : une seule migration ; aucune des
 * dix-neuf migrations CircleTasks n'est reprise.
 */
export const migrations: readonly Migration[] = [migration0001SpartiateInit];
