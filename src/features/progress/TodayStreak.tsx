import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { constancy, type Constancy } from '../../domain/training/progressStats';
import { getFirstWeekday } from '../../i18n/formatPrefs';
import { tPlural } from '../../i18n/plural';
import { tTrainingProgress } from '../../i18n/trainingProgressText';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { CONSTANCY_TABLES, readConstancy } from './constancyData';
import './TrainingProgress.css';

/**
 * Aujourd'hui › Constance (PROGRES-b, § 18.2) : série en semaines et semaine en cours, même règle que Progrès. Bloc chargé à la demande par
 * Aujourd'hui (déclaré dans TodayScreen.tsx, hors du départ). Lecture impossible : rien n'est affiché (Progrès le dit).
 */
type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly result: Constancy; readonly sessions: number };

export function StreakLines({ result, sessions }: { readonly result: Constancy; readonly sessions: number }) {
  if (sessions === 0) return <p className="ct-today__text">{tTrainingProgress('streakNone')}</p>;
  return (
    <>
      <p className="ct-tprogress__hero">
        <span className="ct-tprogress__hero-value">{tPlural(tTrainingProgress, result.streakWeeks, 'streakOne', 'streak')}</span>
      </p>
      <p className="ct-today__text">{tPlural(tTrainingProgress, result.thisWeek.done, 'weekDoneOne', 'weekDone', { target: result.thisWeek.target })}</p>
    </>
  );
}

export function TodayStreak() {
  const { data, clock } = useAppContainer();
  const synced = useSyncedData(CONSTANCY_TABLES);
  const today = todayLocal(clock);
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    readConstancy(data, today).then(
      (c) => {
        if (live) setLoad({ status: 'ready', result: constancy({ ...c, today, firstWeekday: getFirstWeekday() }), sessions: c.days.length });
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [data, today, synced]);

  if (load.status !== 'ready') return null;
  return (
    <section className="ct-today__card ct-tprogress" aria-labelledby="ct-today-streak">
      <h2 id="ct-today-streak" className="ct-today__eyebrow ct-section-title">
        {tTrainingProgress('constancyTitle')}
      </h2>
      <StreakLines result={load.result} sessions={load.sessions} />
    </section>
  );
}
