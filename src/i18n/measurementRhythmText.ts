import { catalogText } from './catalogText';
import { measurementRhythmFr } from './fr.measurementRhythm';

/** CORPS-0301d : textes du rythme des mesures, à part du catalogue principal ; importé seulement par son composant, chargé à la demande. */
export type MeasurementRhythmTextKey = keyof typeof measurementRhythmFr;

export const tMeasurementRhythm = catalogText(measurementRhythmFr);
