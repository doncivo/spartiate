import { addDays } from '../../domain/localDate';
import { parseTrackingGoals, serializeTrackingGoals, type StepsDay, type TrackingGoals } from '../../domain/tracking';
import type { LocalDate } from '../../domain/types';
import type { AppContainer } from '../app/container';

/**
 * SUIVIS-029 : cas d'usage des suivis (lecture des objectifs, des pas importés). Accès base par les repositories seulement ; règles dans
 * `src/domain/tracking`. Aucune valeur n'est journalisée ni envoyée.
 */

export async function loadGoals(container: AppContainer): Promise<TrackingGoals> {
  return parseTrackingGoals(await container.data.repos.settings.get('tracking.goals'));
}

export async function saveGoals(container: AppContainer, goals: TrackingGoals): Promise<void> {
  await container.data.repos.settings.set('tracking.goals', serializeTrackingGoals(goals));
}

export interface StepsRead {
  /** Totaux par jour ; null : lecture impossible (dit à l'écran). */
  readonly days: readonly StepsDay[] | null;
  /** Un `pas.csv` a-t-il déjà été lu sur cet appareil ? */
  readonly everRead: boolean;
}

/** Totaux de pas de `today − (days − 1)` à `today` (import de `pas.csv`, un total par jour à midi UTC), iPhone seulement. */
export async function readStepsDays(container: AppContainer, today: LocalDate, days: number): Promise<StepsRead> {
  try {
    const samples = await container.data.repos.recoverySamples();
    const states = await samples.listImportStates();
    const rows = await samples.listWindow('pas', `${addDays(today, -(days - 1))}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
    const out: StepsDay[] = [];
    for (const s of rows) if (s.value !== null) out.push({ day: s.startAt.slice(0, 10), steps: s.value });
    return { days: out, everRead: states.some((s) => s.type === 'pas') };
  } catch {
    return { days: null, everRead: false };
  }
}

export const isPhone = (container: AppContainer): boolean => container.platform.os === 'ios';
