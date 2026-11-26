import { catalogText, type PlainCatalogKey } from './catalogText';
import { trainingMediaFr } from './fr.trainingMedia';

/** Textes des médias d'exercice (I6-07) ; importé seulement par le bloc à la demande `ExerciseMedia`. */
export type TrainingMediaTextKey = keyof typeof trainingMediaFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type TrainingMediaPlainKey = PlainCatalogKey<typeof trainingMediaFr>;

export const tTrainingMedia = catalogText(trainingMediaFr);
