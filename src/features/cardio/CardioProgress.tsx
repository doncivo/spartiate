import { useEffect, useState } from 'react';
import { cardioWeeks, type CardioWeek } from '../../domain/cardio';
import { todayIn } from '../../domain/timeZone';
import { formatDuration, formatKm, sessionsCount, tCardio } from '../../i18n/cardioText';
import { formatDayMonthYear } from '../../i18n/format';
import { detectTimeZone } from '../../platform/timeZone';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import './Cardio.css';

/**
 * Progrès › Cardio (I6-06, D-223) : séances, durée et distance par semaine (du lundi), sur les quatre dernières semaines, la plus récente d'abord.
 * Sans séance : la carte le dit (aucun faux zéro) ; une distance inconnue n'est jamais comptée 0 (« distance non saisie », « n sans distance »).
 * Bloc chargé à la demande avec le catalogue du cardio.
 */
type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | { readonly status: 'ready'; readonly weeks: readonly CardioWeek[] };

export function CardioProgress({ timeZone }: { readonly timeZone?: string }) {
  const container = useAppContainer();
  const tz = timeZone ?? detectTimeZone() ?? 'Europe/Paris';
  const synced = useSyncedData(['cardio_session']);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => cardioWeeks(await (await container.data.repos.cardio()).list(), todayIn(container.clock, tz), tz))().then(
      (weeks) => {
        if (live) setLoad({ status: 'ready', weeks });
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, synced, attempt, tz]);

  return (
    <section className="ct-today__card ct-cardio__card ct-cardio-progress ct-flat" aria-labelledby="ct-cardio-progress-title">
      <h2 id="ct-cardio-progress-title" className="ct-today__eyebrow ct-cardio__progress-title ct-section-title">
        {tCardio('progressTitle')}
      </h2>
      {load.status === 'loading' ? (
        <p className="ct-today__muted" role="status">
          {tCardio('loading')}
        </p>
      ) : load.status === 'failed' ? (
        <div role="alert">
          <p>{tCardio('loadFailed')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {tCardio('retry')}
          </Button>
        </div>
      ) : load.weeks.every((w) => w.count === 0) ? (
        <p className="ct-today__muted">{tCardio('progressEmpty')}</p>
      ) : (
        <>
          <p className="ct-today__muted">{tCardio('progressHint')}</p>
          <ul className="ct-cardio__list">
            {load.weeks.map((w) => (
              <li key={w.weekStart} className="ct-cardio__item">
                <span>{tCardio('progressWeek', { date: formatDayMonthYear(w.weekStart) })}</span>
                <span className="ct-cardio__value">
                  {w.count === 0
                    ? tCardio('progressWeekNone')
                    : tCardio('progressWeekLine', {
                        count: sessionsCount(w.count),
                        duration: formatDuration(w.durationSec),
                        distance: w.distanceM === null ? tCardio('progressNoDistance') : w.sessionsWithoutDistance > 0 ? `${formatKm(w.distanceM)} (${tCardio('progressPartial', { n: w.sessionsWithoutDistance })})` : formatKm(w.distanceM),
                      })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
