import type { Migration } from '../migrator';
import { migration0001SpartiateInit } from './0001_spartiate_init';
import { migration0002Training } from './0002_training';
import { migration0003Workout } from './0003_workout';
import { migration0004WorkoutSync } from './0004_workout_sync';
import { migration0005Progression } from './0005_progression';
import { migration0006ProgressionSync } from './0006_progression_sync';
import { migration0007Mesocycle } from './0007_mesocycle';
import { migration0008Nutrition } from './0008_nutrition';
import { migration0009Recipes } from './0009_recipes';
import { migration0010Recovery } from './0010_recovery';
import { migration0011RecoveryFactor } from './0011_recovery_factor';
import { migration0012BodyProgress } from './0012_body_progress';
import { migration0013WorkoutCircuit } from './0013_workout_circuit';

/**
 * Registre ordonné des migrations de l'app. Ajouter chaque nouveau fichier
 * `NNNN_titre.ts` ici, à la fin, sans jamais modifier une entrée publiée.
 * Base neuve Spartiate (SPA-001b, D-23) : 0001 (I0) puis une migration par
 * itération (0002 : bibliothèque, matériel et routines, I1-01 ; 0003 : séance
 * active locale, I1-02 ; 0004 : publication des séances closes, I1-03 ; 0005 : profil de progression et décisions, locales, I2-01 ; 0006 : difficulté et publication de la progression, I2-01 PR 2/2 ; 0007 : mésocycle publié, I3-02 ; 0008 : fiches, portions, journal et cibles de nutrition publiés, I4-02 ; 0009 : journée déclarée, recettes et ingrédients publiés, I4-07 ; 0010 : récupération publiée et échantillons importés locaux, I5-01 ; 0011 : journal de facteurs publié, I6-01 ; 0012 : mensurations et fiches de photos publiées, fichiers de photos locaux, I6-02 ; 0013 : groupes de circuit publiés sur les séries, I6-03) ; aucune des dix-neuf migrations CircleTasks n'est reprise.
 */
export const migrations: readonly Migration[] = [migration0001SpartiateInit, migration0002Training, migration0003Workout, migration0004WorkoutSync, migration0005Progression, migration0006ProgressionSync, migration0007Mesocycle, migration0008Nutrition, migration0009Recipes, migration0010Recovery, migration0011RecoveryFactor, migration0012BodyProgress, migration0013WorkoutCircuit];
