import { useEffect, useMemo, useState } from 'react';
import { RECOVERY_SPLIT_CONFIG } from '../../../domain/training/config';
import type { RedDayChoice } from '../../../domain/training/redDay';
import { musclesToSpare, recoverySplit, sessionPrimaryMuscles, type SplitMuscle } from '../../../domain/training/recoverySplit';
import type { MuscleWeight } from '../../../domain/training/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { tTrainingRecovery } from '../../../i18n/trainingRecoveryText';
import { Button } from '../../../ui';
import { localDayOf } from '../cycle/currentCycle';
import { chooseRedDay, type RedDayState } from './redDayState';
import './RecoverySession.css';

/**
 * Récupération en séance (I5-02 point 2.2 ; § 16.4, § 16.7, § 16.1 niveau A). Bloc à la demande (import dynamique depuis `ActiveSession` et
 * « Séance proposée »), chargé avec son catalogue de textes. Même code sur l'iPhone et le PC : lectures par `recoveryRepository`, sans recalcul.
 *
 * - `RedDayBanner` : « Journée rouge : charges allégées de 5 % proposées », un tap pour accepter ou ignorer ; rien n'est appliqué sans ce geste ;
 *   le choix est gardé pour la séance (réglage local) puis dit en texte à la place des boutons.
 * - `RecoverySplitView` : pourcentage et repère (prêt / à ménager) par muscle principal de la séance, « inconnu » sans ligne du jour ;
 *   suggestion prudente pour les muscles sous le seuil, la séance n'est jamais modifiée. Jamais un diagnostic.
 */

export interface RedDayBannerProps {
  readonly access: DataAccess;
  readonly workoutId: string;
  readonly state: RedDayState;
  readonly onState: (next: RedDayState) => void;
}

export function RedDayBanner({ access, workoutId, state, onState }: RedDayBannerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!state.offer) return null;

  async function choose(choice: RedDayChoice): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      onState(await chooseRedDay(access, workoutId, state, choice));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ct-recovery-session ct-recovery-session--red" role="region" aria-label={tTrainingRecovery('redDayRegion')}>
      {state.choice === null ? (
        <>
          <p className="ct-recovery-session__title">{tTrainingRecovery('redDayTitle')}</p>
          <p className="ct-recovery-session__hint">{tTrainingRecovery('redDayHint', { score: Math.round(state.recovery ?? 0) })}</p>
          <div className="ct-recovery-session__actions">
            <Button disabled={busy} onClick={() => void choose('accepted')}>
              {tTrainingRecovery('redDayAccept')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void choose('ignored')}>
              {tTrainingRecovery('redDayIgnore')}
            </Button>
          </div>
        </>
      ) : (
        <p className="ct-recovery-session__state" role="status">
          {tTrainingRecovery(state.choice === 'accepted' ? 'redDayAccepted' : 'redDayIgnored')}
        </p>
      )}
      {error && (
        <p className="ct-training__error" role="alert">
          {tTrainingRecovery('redDayWriteError')}
        </p>
      )}
    </section>
  );
}

export interface RecoverySplitViewProps {
  readonly access: DataAccess;
  /** Instant dont le jour local est lu (début de la séance active, ou instant de la proposition). */
  readonly atMs: number;
  /** Muscles de chaque exercice de la séance, dans l'ordre. */
  readonly exercises: readonly { readonly muscles: readonly MuscleWeight[] }[];
  readonly muscleName: (muscleId: string) => string;
}

type SplitLoad = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly rows: readonly { readonly muscleId: string; readonly percent: number }[] };
const LOADING: SplitLoad = { status: 'loading' };

const LINE_KEY = { ready: 'splitReady', spare: 'splitSpare', unknown: 'splitUnknown' } as const;

export function RecoverySplitView({ access, atMs, exercises, muscleName }: RecoverySplitViewProps) {
  const day = localDayOf(atMs);
  // Lecture rattachée à son jour : un autre jour se relit (« en lecture » d'ici là), jamais les muscles d'un autre jour.
  const [loaded, setLoaded] = useState<{ readonly day: string; readonly load: SplitLoad } | null>(null);
  const load = loaded !== null && loaded.day === day ? loaded.load : LOADING;
  useEffect(() => {
    let alive = true;
    const setLoad = (next: SplitLoad): void => setLoaded({ day, load: next });
    access.repos
      .recovery()
      .then((repo) => repo.listMuscles(day))
      .then(
        (rows) => {
          if (alive) setLoad({ status: 'ready', rows: rows.map((r) => ({ muscleId: r.muscleId, percent: r.percent })) });
        },
        () => {
          if (alive) setLoad({ status: 'error' });
        },
      );
    return () => {
      alive = false;
    };
  }, [access, day]);

  // Clé stable : la séance se redessine chaque seconde (chrono), la liste des muscles ne change qu'avec les exercices.
  const key = exercises.map((e) => e.muscles.map((m) => `${m.id}:${String(m.weight)}`).join(',')).join('|');
  const muscleIds = useMemo(() => sessionPrimaryMuscles(exercises), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (muscleIds.length === 0 || load.status === 'loading') return null;

  const split: readonly SplitMuscle[] = load.status === 'ready' ? recoverySplit(muscleIds, load.rows) : [];
  const spare = musclesToSpare(split);
  return (
    <section className="ct-recovery-session" role="region" aria-label={tTrainingRecovery('splitTitle')}>
      <p className="ct-recovery-session__title">{tTrainingRecovery('splitTitle')}</p>
      {load.status === 'error' ? (
        <p className="ct-recovery-session__hint">{tTrainingRecovery('splitError')}</p>
      ) : (
        <>
          <ul className="ct-recovery-session__list">
            {split.map((m) => (
              <li key={m.muscleId}>{tTrainingRecovery(LINE_KEY[m.readiness], { muscle: muscleName(m.muscleId), percent: m.percent ?? '' })}</li>
            ))}
          </ul>
          {spare.length > 0 && (
            <p className="ct-recovery-session__text">
              {tTrainingRecovery('splitSuggestion', { muscles: spare.map(muscleName).join(tTrainingRecovery('listJoin')), threshold: RECOVERY_SPLIT_CONFIG.spareBelowPercent })}
            </p>
          )}
          <p className="ct-recovery-session__hint">{tTrainingRecovery('splitNote')}</p>
        </>
      )}
    </section>
  );
}
