import { catalogText } from './catalogText';
import { circuitFr } from './fr.circuit';

/** Textes des circuits de la séance, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type CircuitTextKey = keyof typeof circuitFr;

export const tCircuit = catalogText(circuitFr);
