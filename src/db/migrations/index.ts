import type { Migration } from '../migrator';
import { migration0001SpartiateInit } from './0001_spartiate_init';
import { migration0002Training } from './0002_training';
import { migration0003Workout } from './0003_workout';
import { migration0004WorkoutSync } from './0004_workout_sync';

/**
 * Registre ordonné des migrations de l'app. Ajouter chaque nouveau fichier
 * `NNNN_titre.ts` ici, à la fin, sans jamais modifier une entrée publiée.
 * Base neuve Spartiate (SPA-001b, D-23) : 0001 (I0) puis une migration par
 * itération (0002 : bibliothèque, matériel et routines, I1-01 ; 0003 : séance
 * active locale, I1-02 ; 0004 : publication des séances closes, I1-03) ; aucune des dix-neuf migrations CircleTasks n'est reprise.
 */
export const migrations: readonly Migration[] = [migration0001SpartiateInit, migration0002Training, migration0003Workout, migration0004WorkoutSync];
