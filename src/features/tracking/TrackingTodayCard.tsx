import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { stepsToday, type StepsToday } from '../../domain/tracking';
import { formatCount, tTracking } from '../../i18n/trackingText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { MorningRatings } from './MorningRatings';
import { isPhone, loadGoals, readStepsDays } from './trackingData';
import './Tracking.css';

/**
 * SUIVIS-029 : carte « Suivis du jour » d'Aujourd'hui (objectif de pas, notes du matin). Bloc chargé à la demande avec son catalogue de textes (jamais dans le
 * départ). Pas inconnus : « — » et la raison (H-25 UNVERIFIED), jamais 0 ; la barre est doublée du texte.
 */
/** `failed` : lecture impossible (objectifs ou pas), dite avec « Réessayer », jamais un chargement sans fin (relecture SUIVIS-029). */
type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | { readonly status: 'ready'; readonly steps: StepsToday };

export function StepsGoal({ steps }: { readonly steps: StepsToday }) {
  return (
    <div className="ct-tracking__block" data-steps="">
      <h3 className="ct-today__eyebrow ct-section-title">{tTracking('stepsGoalTitle')}</h3>
      {steps.kind === 'value' ? (
        <>
          <p className="ct-tracking__value">{tTracking('stepsProgress', { steps: formatCount(steps.steps), goal: formatCount(steps.goal), percent: steps.percent })}</p>
          <div className="ct-tracking__bar" role="progressbar" aria-label={tTracking('stepsGoalTitle')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, steps.percent)}>
            <div className="ct-tracking__bar-fill" style={{ width: `${String(Math.min(100, steps.percent))}%` }} />
          </div>
          {steps.reached ? <p className="ct-today__muted">{tTracking('stepsReached')}</p> : null}
        </>
      ) : (
        <>
          <p className="ct-tracking__value">{tTracking('missing')}</p>
          <p className="ct-today__muted">{tTracking(`stepsReason_${steps.reason}`)}</p>
        </>
      )}
    </div>
  );
}

export function TrackingTodayCard() {
  const container = useAppContainer();
  const today = todayLocal(container.clock);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const goals = await loadGoals(container);
      const phone = isPhone(container);
      const read = phone ? await readStepsDays(container, today, 1) : { days: [], everRead: false };
      return stepsToday({ platform: phone ? 'phone' : 'pc', days: read.days, everRead: read.everRead, today, goal: goals.stepsDaily });
    })().then(
      (steps) => {
        if (live) setLoad({ status: 'ready', steps });
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, attempt]);

  return (
    <section className="ct-today__card ct-tracking" aria-labelledby="ct-tracking-today-title">
      <h2 id="ct-tracking-today-title" className="ct-today__eyebrow ct-section-title">
        {tTracking('todayTitle')}
      </h2>
      {load.status === 'loading' ? (
        <p className="ct-today__muted" role="status">
          {tTracking('loading')}
        </p>
      ) : load.status === 'failed' ? (
        <div role="alert">
          <p className="ct-today__muted">{tTracking('loadFailed')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            {tTracking('retry')}
          </Button>
        </div>
      ) : (
        <StepsGoal steps={load.steps} />
      )}
      <MorningRatings today={today} />
    </section>
  );
}
