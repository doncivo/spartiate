import { catalogText } from './catalogText';
import { routineCircuitFr } from './fr.routineCircuit';

/** Textes des groupes de l'éditeur de routine, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type RoutineCircuitTextKey = keyof typeof routineCircuitFr;

export const tRoutineCircuit = catalogText(routineCircuitFr);
