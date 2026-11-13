import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { groupByExercise, type Exercise, type WorkoutSummary, type WorkoutWithSets } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { SetCorrection } from '../../../db/repositories/workoutRepository';
import { formatDay, tTraining } from '../../../i18n/trainingText';
import { Button, ConfirmDialog } from '../../../ui';
import { recordText, SummaryFigures } from '../session/SummaryFigures';
import type { TrainingData } from '../trainingState';
import { HistorySetRow } from './HistorySetRow';

// I6-03b : déroulé série par série, bloc à la demande avec son catalogue (fr.workoutReplay) et sa règle (domain/training/replay).
const HistoryTimelineView = lazy(() => import('./HistoryTimelineView').then((m) => ({ default: m.HistoryTimelineView })));

/**
 * Détail d'une séance close (I1-03) : résumé (§ 13.5), exercices et séries (charge, répétitions ou durée, RIR, type, état écrit), nom figé
 * de l'exercice (D-71) et mention s'il n'existe plus dans la bibliothèque (P-09). Correction d'une série par `correctSet` (tracée,
 * synchronisée) ; suppression de la séance par `deleteClosed` dans une transaction, après confirmation. I6-03b : « Voir le déroulé série par
 * série » (lecture seule, ordre réel, écarts) et « Refaire cette séance » (copie en nouvelle séance, ex-« Rejouer ») sont deux actions distinctes.
 */

type DetailLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'gone' }
  | { readonly status: 'ready'; readonly workout: WorkoutWithSets; readonly summary: WorkoutSummary };

async function readDetail(access: DataAccess, id: string): Promise<{ workout: WorkoutWithSets; summary: WorkoutSummary } | null> {
  const repo = await access.repos.workouts();
  const workout = await repo.getClosed(id);
  if (workout === null) return null;
  return { workout, summary: await repo.summary(id) };
}

export interface HistoryDetailProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly workoutId: string;
  /** Compteur des lots de synchro appliqués (`useSyncedData`) : relecture à chaque changement. */
  readonly synced: number;
  readonly onDeleted: () => void;
  /** Rejeu (I6-03) : la nouvelle séance est ouverte ; l'appelant affiche la séance active. */
  readonly onReplay: () => void;
}

export function HistoryDetail({ data, access, workoutId, synced, onDeleted, onReplay }: HistoryDetailProps) {
  const [load, setLoad] = useState<DetailLoad>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const next = await readDetail(access, workoutId);
        if (current) setLoad(next === null ? { status: 'gone' } : { status: 'ready', ...next });
      } catch {
        // Relecture impossible après une correction : la dernière vue lue reste affichée (jamais un état vide trompeur).
        if (current) setLoad((now) => (now.status === 'ready' ? now : { status: 'error' }));
      }
    })();
    return () => {
      current = false;
    };
  }, [access, workoutId, version, synced]);

  const ready = load.status === 'ready';
  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [ready]);

  const exerciseOf = (id: string): Exercise | undefined => data.content.catalog.get(id) ?? data.allCustoms.find((c) => c.id === id);

  async function correct(setId: string, patch: SetCorrection): Promise<boolean> {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => (await repos.workouts()).correctSet(setId, patch));
      if (!live.current) return true;
      setNotice(tTraining('historyCorrectionSaved'));
      setVersion((v) => v + 1);
      return true;
    } catch {
      if (live.current) setError(tTraining('historyCorrectError'));
      return false;
    } finally {
      if (live.current) setBusy(false);
    }
  }

  /** Rejeu : copie les exercices, groupes, charges et répétitions comme CIBLES d'une nouvelle séance ouverte (aucune série faite). */
  async function replay(): Promise<void> {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => (await repos.workouts()).start({ source: 'copy', copyFromId: workoutId }));
      if (live.current) onReplay();
    } catch {
      const open = await (await access.repos.workouts()).getOpen().catch(() => null);
      if (live.current) {
        setError(tTraining(open === null ? 'historyReplayError' : 'historyReplayOpen'));
        setBusy(false);
      }
    }
  }

  async function remove(): Promise<void> {
    setConfirmDelete(false);
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => (await repos.workouts()).deleteClosed(workoutId));
      if (live.current) onDeleted();
    } catch {
      if (live.current) {
        setError(tTraining('historyDeleteError'));
        setBusy(false);
      }
    }
  }

  return (
    <section className="ct-history__detail" role="region" aria-label={tTraining('historyDetail')}>
      {load.status === 'loading' ? (
        <p className="ct-training__muted" role="status">
          {tTraining('loading')}
        </p>
      ) : load.status === 'error' ? (
        <div role="alert" className="ct-training__error-block">
          <p>{tTraining('loadError')}</p>
          <Button variant="secondary" onClick={() => setVersion((v) => v + 1)}>
            {tTraining('retry')}
          </Button>
        </div>
      ) : load.status === 'gone' ? (
        <p className="ct-session__muted">{tTraining('historyNotFound')}</p>
      ) : (
        <>
          <div>
            <p className="ct-training__eyebrow">{formatDay(load.workout.endedAt ?? load.workout.startedAt)}</p>
            <h2 ref={heading} tabIndex={-1} className="ct-session__title">
              {load.workout.name === '' ? tTraining('sessionFree') : load.workout.name}
            </h2>
          </div>
          <SummaryFigures summary={load.summary} />
          {load.summary.records.length > 0 ? (
            <div className="ct-summary__card">
              <h3 id="ct-history-records" className="ct-training__eyebrow ct-section-title">
                {tTraining('summaryRecordsTitle')}
              </h3>
              <ul className="ct-summary__records" aria-labelledby="ct-history-records">
                {load.summary.records.map((r) => (
                  <li key={`${r.exerciseId}-${r.kind}`} className="ct-summary__record">
                    <span className="ct-summary__record-name">{r.exerciseName}</span>
                    <span className="ct-session__num">{recordText(r)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {notice ? (
            <p className="ct-session__muted" role="status">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="ct-training__error" role="alert">
              {error}
            </p>
          ) : null}
          {groupByExercise(load.workout.sets).map((block) => {
            const exercise = exerciseOf(block.exerciseId);
            let rank = 0;
            return (
              <section key={block.exerciseId} className="ct-session__block" role="region" aria-label={block.exerciseName}>
                <div className="ct-session__block-head">
                  <h3 className="ct-session__block-title">{block.exerciseName}</h3>
                  {exercise === undefined ? <p className="ct-session__hint">{tTraining('unknownExercise')}</p> : null}
                </div>
                <ol className="ct-session__sets">
                  {block.sets.map((set) => {
                    if (set.setKind !== 'warmup') rank += 1;
                    return (
                      <HistorySetRow
                        key={set.id}
                        set={set}
                        number={rank}
                        timedExercise={exercise?.metric === 'time'}
                        busy={busy}
                        onCorrect={(patch) => correct(set.id, patch)}
                      />
                    );
                  })}
                </ol>
              </section>
            );
          })}
          <div className="ct-training__actions">
            <Button variant="secondary" expanded={timeline} onClick={() => setTimeline((v) => !v)}>
              {tTraining('historyTimeline')}
            </Button>
          </div>
          <p className="ct-session__muted">{tTraining('historyTimelineHint')}</p>
          {timeline ? (
            <Suspense fallback={null}>
              <HistoryTimelineView workout={load.workout} />
            </Suspense>
          ) : null}
          <div className="ct-training__actions">
            <Button disabled={busy} onClick={() => void replay()}>
              {tTraining('historyReplay')}
            </Button>
          </div>
          <p className="ct-session__muted">{tTraining('historyReplayHint')}</p>
          <div className="ct-training__actions">
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              {tTraining('historyDelete')}
            </Button>
          </div>
          {confirmDelete ? (
            <ConfirmDialog
              title={tTraining('historyDeleteTitle', { name: load.workout.name === '' ? tTraining('sessionFree') : load.workout.name })}
              description={tTraining('historyDeleteHint')}
              confirmLabel={tTraining('delete')}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() => void remove()}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
