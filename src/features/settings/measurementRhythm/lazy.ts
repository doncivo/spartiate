import { lazyScreen } from '../../app/lazyScreens';
import type { MeasurementRhythmProps } from './MeasurementRhythmSettings';

/**
 * CORPS-0301d (BL-180) : rythme des mesures, bloc à la demande (composant, catalogue, service), monté par Corps › Mesures ; rien n'entre dans le
 * départ. Seul ce module est importé par l'écran Mesures.
 */
export const MeasurementRhythmLazy = lazyScreen<MeasurementRhythmProps>(() => import('./MeasurementRhythmSettings').then((m) => ({ default: m.MeasurementRhythmSettings })), undefined, { onDemand: true });
