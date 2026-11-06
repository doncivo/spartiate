import { useEffect, useState } from 'react';
import type { RoutineTree, Workout, WorkoutWithSets } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { StartWorkoutInput } from '../../../db/repositories/workoutRepository';
import { formatDay, tTraining } from '../../../i18n/trainingText';
import { Button } from '../../../ui';

/**
 * Options de départ d'une séance (I1-02, critère 1, § 13.1 et § 13.8) : séance vide, jour d'une routine, copie d'une séance close. Sans
 * historique, la copie dit pourquoi elle n'est pas proposée. Une seule séance ouverte : le repository refuse un second départ.
 */

const COPY_SOURCES = 5;

interface Sources {
  readonly routines: readonly RoutineTree[];
  readonly closed: readonly Workout[];
}

export function StartSession({ access, onStarted }: { readonly access: DataAccess; readonly onStarted: (workout: WorkoutWithSets) => void }) {
  const [sources, setSources] = useState<Sources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [routinesRepo, workouts] = await Promise.all([access.repos.trainingRoutines(), access.repos.workouts()]);
        const list = await routinesRepo.list();
        const trees = (await Promise.all(list.map((r) => routinesRepo.get(r.id)))).filter((t): t is RoutineTree => t !== null);
        const closed = await workouts.listClosed(COPY_SOURCES);
        if (live) setSources({ routines: trees, closed });
      } catch {
        if (live) setError(tTraining('loadError'));
      }
    })();
    return () => {
      live = false;
    };
  }, [access]);

  async function start(input: StartWorkoutInput): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const workout = await access.transaction(async (repos) => (await repos.workouts()).start(input));
      onStarted(workout);
    } catch {
      // Séance déjà ouverte (autre écran) : on la reprend plutôt que d'en créer une seconde.
      const open = await (await access.repos.workouts()).getOpen().catch(() => null);
      if (open) onStarted(open);
      else setError(tTraining('sessionStartError'));
    } finally {
      setBusy(false);
    }
  }

  const days = (sources?.routines ?? []).flatMap((routine) => routine.days.filter((d) => d.exercises.length > 0).map((day) => ({ routine, day })));

  return (
    <div className="ct-session__start">
      <h2 className="ct-training__heading">{tTraining('sessionStartTitle')}</h2>
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      <div className="ct-session__option">
        <Button fullWidth disabled={busy} onClick={() => void start({ source: 'empty' })}>
          {tTraining('sessionEmpty')}
        </Button>
        <p className="ct-session__muted">{tTraining('sessionEmptyHint')}</p>
      </div>
      {sources && (
        <>
          <section aria-labelledby="ct-session-routines">
            <h3 id="ct-session-routines" className="ct-training__eyebrow">
              {tTraining('sessionFromRoutine')}
            </h3>
            {days.length === 0 ? (
              <p className="ct-session__muted">{tTraining('sessionNoRoutine')}</p>
            ) : (
              <ul className="ct-training__rows">
                {days.map(({ routine, day }) => (
                  <li key={day.id}>
                    <button type="button" className="ct-training__row" disabled={busy} onClick={() => void start({ source: 'routine', routineId: routine.id, dayId: day.id })}>
                      <span className="ct-training__row-name">{tTraining('sessionStartDay', { day: day.name })}</span>
                      <span className="ct-training__row-meta">
                        {day.exercises.length === 1
                          ? tTraining('sessionStartDayMetaOne', { routine: routine.name })
                          : tTraining('sessionStartDayMeta', { routine: routine.name, n: day.exercises.length })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="ct-session-copy">
            <h3 id="ct-session-copy" className="ct-training__eyebrow">
              {tTraining('sessionCopy')}
            </h3>
            {sources.closed.length === 0 ? (
              <p className="ct-session__muted">{tTraining('sessionNoHistory')}</p>
            ) : (
              <>
                <p className="ct-session__muted">{tTraining('sessionCopyHint')}</p>
                <ul className="ct-training__rows">
                  {sources.closed.map((w) => (
                    <li key={w.id}>
                      <button type="button" className="ct-training__row" disabled={busy} onClick={() => void start({ source: 'copy', copyFromId: w.id })}>
                        <span className="ct-training__row-name">{tTraining('sessionCopyOne', { name: w.name === '' ? tTraining('sessionFree') : w.name })}</span>
                        <span className="ct-training__row-meta">{formatDay(w.endedAt ?? w.startedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
