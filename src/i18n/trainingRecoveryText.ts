import { catalogText } from './catalogText';
import { trainingRecoveryFr } from './fr.trainingRecovery';

/** Textes de la récupération en séance (I5-02 point 2.2) ; importé seulement par le bloc à la demande `RecoverySession`. */
export type TrainingRecoveryTextKey = keyof typeof trainingRecoveryFr;

export const tTrainingRecovery = catalogText(trainingRecoveryFr);
