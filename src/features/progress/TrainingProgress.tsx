import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { DEFAULT_PROGRESS_CONFIG } from '../../domain/training/config';
import { trailingWeeks, weeklyMuscleVolume, type WeeklyVolume } from '../../domain/training/progressStats';
import type { MuscleWeight } from '../../domain/training/types';
import type { IsoDateTime, LocalDate } from '../../domain/types';
import { getFirstWeekday } from '../../i18n/formatPrefs';
import { tPlural } from '../../i18n/plural';
import { formatDayMonth, formatTenth, tTrainingProgress } from '../../i18n/trainingProgressText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { localDayOf } from '../training/cycle/currentCycle';
import { readTrainingData } from '../training/trainingState';
import './TrainingProgress.css';

/**
 * Progrès › Entraînement (PROGRES, § 17.1) : volume par muscle et par semaine. Lecture seule des séances closes (repository), calcul dans le
 * domaine (`progressStats`). Valeurs écrites ; barres en SVG décoratif doublées d'une étiquette textuelle (Recharts non importé, C-167 :
 * aucune dépendance de plus pour huit barres). Bloc chargé à la demande avec son catalogue de textes (jamais dans le départ).
 */

const READ_TABLES = ['workout', 'workout_set', 'exercise'] as const;

interface Loaded {
  readonly volume: WeeklyVolume;
  readonly muscleName: (id: string) => string;
}
type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | ({ readonly status: 'ready' } & Loaded);

/** Instant (ISO) du début local du jour `day`. */
const localMidnightIso = (day: LocalDate): IsoDateTime => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toISOString() as IsoDateTime;
};

async function load(access: ReturnType<typeof useAppContainer>['data'], today: LocalDate): Promise<Loaded> {
  const first = getFirstWeekday();
  const weeks = trailingWeeks(today, DEFAULT_PROGRESS_CONFIG.volumeWeeks, first);
  const [training, workouts] = await Promise.all([readTrainingData(access), (await access.repos.workouts()).closedSince(localMidnightIso(weeks[0] ?? today))]);
  const muscles = new Map<string, readonly MuscleWeight[]>();
  for (const x of [...training.content.catalog.list(), ...training.allCustoms]) muscles.set(x.id, x.muscles);
  const names = new Map(training.content.muscles.map((m) => [m.id, m.nameFr]));
  const volume = weeklyMuscleVolume({
    workouts: workouts.map((w) => ({ day: localDayOf(Date.parse(w.startedAt)), sets: w.sets })),
    musclesOf: (id) => muscles.get(id) ?? null,
    today,
    firstWeekday: first,
  });
  return { volume, muscleName: (id) => names.get(id) ?? id };
}

function VolumeBars({ perWeek, label }: { readonly perWeek: readonly number[]; readonly label: string }) {
  const max = Math.max(...perWeek, 1);
  const width = 8 * perWeek.length;
  return (
    <svg className="ct-tprogress__bars" viewBox={`0 0 ${String(width)} 20`} preserveAspectRatio="none" role="img" aria-label={label}>
      {perWeek.map((n, i) => {
        const h = n === 0 ? 0.5 : Math.max(1.5, (n / max) * 20);
        return <rect key={i} className={i === perWeek.length - 1 ? 'ct-tprogress__bar ct-tprogress__bar--current' : 'ct-tprogress__bar'} x={i * 8 + 1} y={20 - h} width={6} height={h} />;
      })}
    </svg>
  );
}

function Volume({ volume, muscleName }: Loaded) {
  const weeks = volume.weekStarts.length;
  return (
    <section className="ct-today__card ct-tprogress ct-flat" aria-labelledby="ct-tprogress-volume">
      <h2 id="ct-tprogress-volume" className="ct-today__eyebrow ct-section-title">
        {tTrainingProgress('volumeTitle')}
      </h2>
      <p className="ct-today__muted ct-tprogress__lead">{tTrainingProgress('volumeSubtitle', { weeks })}</p>
      {volume.muscles.length === 0 ? (
        <p className="ct-today__text">{tTrainingProgress('volumeEmpty')}</p>
      ) : (
        <ul className="ct-tprogress__list">
          {volume.muscles.map((m) => {
            const name = muscleName(m.muscleId);
            const id = `ct-tprogress-muscle-${m.muscleId}`;
            const values = m.perWeek.map((n, i) => tTrainingProgress('volumeWeek', { date: formatDayMonth(volume.weekStarts[i] ?? ''), n: formatTenth(n) })).join(' ; ');
            return (
              <li key={m.muscleId} className="ct-tprogress__row" aria-labelledby={id}>
                <span id={id} className="ct-tprogress__name">
                  {name}
                </span>
                <VolumeBars perWeek={m.perWeek} label={tTrainingProgress('volumeChart', { muscle: name, values })} />
                <span className="ct-tprogress__value">{tTrainingProgress('volumeLine', { n: formatTenth(m.perWeek.at(-1) ?? 0), mean: formatTenth(m.total / weeks), weeks })}</span>
              </li>
            );
          })}
        </ul>
      )}
      {volume.unknownSets > 0 ? <p className="ct-today__muted">{tPlural(tTrainingProgress, volume.unknownSets, 'volumeUnknownOne', 'volumeUnknown')}</p> : null}
      <p className="ct-today__muted ct-tprogress__foot">{tTrainingProgress('volumeNoRange')}</p>
    </section>
  );
}

export function TrainingProgress() {
  const container = useAppContainer();
  const synced = useSyncedData(READ_TABLES);
  const today = todayLocal(container.clock);
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load(container.data, today).then(
      (data) => {
        if (live) setState({ status: 'ready', ...data });
      },
      () => {
        if (live) setState({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced, attempt]);

  if (state.status === 'loading') {
    return (
      <p className="ct-today__muted" role="status">
        {tTrainingProgress('loading')}
      </p>
    );
  }
  if (state.status === 'failed') {
    return (
      <section className="ct-today__card ct-tprogress ct-flat" role="alert">
        <p className="ct-today__text">{tTrainingProgress('loadFailed')}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {tTrainingProgress('retry')}
        </Button>
      </section>
    );
  }
  return <Volume volume={state.volume} muscleName={state.muscleName} />;
}
