import { Suspense, lazy, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatTimerRemaining } from '../../../domain/syntheticTimer';
import {
  REST_CHOICES_SEC,
  groupByExercise,
  restRemainingMs,
  restSecondsFor,
  summarizeSets,
  type Exercise,
  type ExerciseBlock,
  type SetEntry,
  type SetKind,
  type WorkoutSet,
  type WorkoutWithSets,
} from '../../../domain/training';
import { warmupExerciseIds } from '../../../domain/training/warmup';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { RepositoryError } from '../../../db/repositories/common';
import type { ClosedWorkout, WorkoutRepository } from '../../../db/repositories/workoutRepository';
import type { Haptics } from '../../../platform/haptics';
import { formatClock, formatRest, tTraining } from '../../../i18n/trainingText';
import { Button, ConfirmDialog } from '../../../ui';
import { ExerciseList } from '../LibraryView';
import type { TrainingData } from '../trainingState';
import type { RestReport, RestTimerController } from './restTimer';
import { SetRow } from './SetRow';

/**
 * Écran de séance active (§ 13.2–13.4 ; maquettes iPhone-Seance, PC-Seance ; I1-02). Chaque écriture passe par le repository dans une
 * transaction, puis la séance est relue (la base fait foi). Le repos démarre seul à la validation d'une série hors échauffement ; son temps
 * restant est recalculé depuis la date de fin persistée à chaque seconde d'affichage et à chaque retour au premier plan. I1-03 : « Terminer
 * la séance » clôt la séance d'un bloc (`close` dans une transaction : la séance et toutes ses séries deviennent publiables ensemble), arrête
 * le repos, la notification et la Live Activity, puis passe au résumé. Refus sans série de travail validée ; confirmation si des séries
 * prévues restent à faire ; un double appui ne clôt qu'une fois (et un rejeu côté repository renvoie `alreadyClosed` sans rien écrire).
 */

const SESSION_SETS_ON_ADD = 3;

/** I2-01 (PR 2/2) : prescription et ressenti par exercice, bloc à la demande (moteur, repository et textes chargés avec lui). */
const ExerciseProgression = lazy(() => import('./ExerciseProgression').then((m) => ({ default: m.ExerciseProgression })));

interface RestView {
  readonly endAt: string;
  readonly report: RestReport | null;
}

export interface ActiveSessionProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly workout: WorkoutWithSets;
  readonly restSetting: number | null;
  readonly os: 'ios' | 'other';
  readonly timer: RestTimerController;
  readonly clock: { nowMs(): number };
  readonly haptics: Haptics;
  readonly onWorkout: (workout: WorkoutWithSets | null) => void;
  readonly onRestSetting: (seconds: number | null) => void;
  /** Séance close (I1-03) : résumé à afficher. */
  readonly onClosed: (closed: ClosedWorkout) => void;
}

const isTimedExercise = (exercise: Exercise | undefined, set: WorkoutSet): boolean => set.setKind === 'timed' || exercise?.metric === 'time';

export function ActiveSession({ data, access, workout, restSetting, os, timer, clock, haptics, onWorkout, onRestSetting, onClosed }: ActiveSessionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState<
    { readonly kind: 'abandon' } | { readonly kind: 'finish'; readonly pending: number } | { readonly kind: 'exercise'; readonly block: ExerciseBlock } | null
  >(null);
  const [rest, setRest] = useState<RestView | null>(null);
  const [restDone, setRestDone] = useState(false);
  const [now, setNow] = useState(() => clock.nowMs());
  const live = useRef(true);
  // Garde du double appui : un second « Terminer » arrivé avant le nouveau rendu ne relance pas la clôture.
  const closing = useRef(false);
  const pickerHeading = useRef<HTMLHeadingElement>(null);

  const exerciseOf = useCallback(
    (id: string): Exercise | undefined => data.content.catalog.get(id) ?? data.allCustoms.find((c) => c.id === id),
    [data],
  );

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Repos : date de fin persistée, relue au montage, à chaque seconde d'affichage et au retour au premier plan.
  // ---------------------------------------------------------------------------------------------------------------------------------
  const resume = useCallback(async () => {
    try {
      const result = await timer.resume();
      if (!live.current) return;
      setNow(clock.nowMs());
      if (result.phase === 'running') {
        setRest({ endAt: result.endAt, report: result });
      } else {
        setRest(null);
        if (result.phase === 'finished') {
          setRestDone(true);
          haptics.notification('warning');
        }
      }
    } catch {
      if (live.current) setError(tTraining('restError'));
    }
  }, [timer, clock, haptics]);

  useEffect(() => {
    live.current = true;
    const first = setTimeout(() => void resume(), 0);
    const onVisible = (): void => {
      if (document.visibilityState !== 'hidden') void resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live.current = false;
      clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [resume]);

  // Horloge d'AFFICHAGE (chrono et repos) : elle ne fait que redessiner ; les valeurs viennent des dates persistées.
  useEffect(() => {
    const id = setInterval(() => {
      const current = clock.nowMs();
      setNow(current);
      if (rest !== null && restRemainingMs(rest.endAt, current) === 0) void resume();
    }, 1000);
    return () => clearInterval(id);
  }, [clock, rest, resume]);

  useEffect(() => {
    if (picking) pickerHeading.current?.focus();
  }, [picking]);

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Écritures
  // ---------------------------------------------------------------------------------------------------------------------------------
  async function write(work: (repo: WorkoutRepository) => Promise<unknown>, failure: string = tTraining('sessionWriteError')): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => {
        await work(await repos.workouts());
      });
      const fresh = await (await access.repos.workouts()).get(workout.id);
      if (live.current) onWorkout(fresh);
      return true;
    } catch {
      if (live.current) setError(failure);
      return false;
    } finally {
      if (live.current) setBusy(false);
    }
  }

  /** Relit la séance après une écriture faite par un bloc de l'exercice (prescription acceptée, ressenti). */
  const reload = useCallback(async (): Promise<void> => {
    const fresh = await (await access.repos.workouts()).get(workout.id);
    if (live.current) onWorkout(fresh);
  }, [access, workout.id, onWorkout]);

  async function startRest(seconds: number): Promise<void> {
    try {
      const report = await timer.start(seconds);
      if (!live.current) return;
      setNow(clock.nowMs());
      setRestDone(false);
      setRest({ endAt: report.endAt, report });
    } catch {
      if (live.current) setError(tTraining('restError'));
    }
  }

  async function validate(set: WorkoutSet, entry: SetEntry): Promise<void> {
    const exercise = exerciseOf(set.exerciseId);
    const timed = isTimedExercise(exercise, set);
    const ok = await write(async (repo) => {
      // Exercice chronométré démarré en série de travail (routine) : la série est enregistrée comme chronométrée.
      if (timed && set.setKind === 'work') await repo.updateSet(set.id, { setKind: 'timed' });
      await repo.validateSet(set.id, entry);
    });
    if (!ok) return;
    haptics.notification('success');
    const seconds = restSecondsFor(set, restSetting, exercise?.defaultRestSec ?? null);
    if (seconds !== null) await startRest(seconds);
  }

  async function addExercise(exercise: Exercise): Promise<void> {
    setPicking(false);
    const [min, max] = exercise.defaultRepRange;
    await write(async (repo) => {
      const next = await repo.addExercise(workout.id, {
        exerciseId: exercise.id,
        exerciseName: exercise.nameFr,
        sets: SESSION_SETS_ON_ADD,
        targetRepsMin: min,
        targetRepsMax: max,
        targetRestSec: null,
      });
      if (exercise.metric === 'time') for (const s of next.sets.filter((x) => x.exerciseId === exercise.id)) await repo.updateSet(s.id, { setKind: 'timed' });
    }, tTraining(workout.sets.some((s) => s.exerciseId === exercise.id) ? 'sessionExerciseExists' : 'sessionWriteError'));
  }

  async function abandon(): Promise<void> {
    setConfirm(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => (await repos.workouts()).discard(workout.id));
      await timer.stop().catch(() => undefined);
      if (live.current) onWorkout(null);
    } catch {
      if (live.current) {
        setError(tTraining('sessionWriteError'));
        setBusy(false);
      }
    }
  }

  /** « Terminer la séance » : refus sans série de travail validée, confirmation si des séries prévues restent à faire. */
  function askFinish(): void {
    setError(null);
    const current = workout.sets.filter((s) => s.deletedAt === null);
    if (!current.some((s) => s.done && s.setKind !== 'warmup')) {
      setError(tTraining('sessionFinishNone'));
      return;
    }
    const pending = current.filter((s) => !s.done).length;
    if (pending > 0) setConfirm({ kind: 'finish', pending });
    else void finish();
  }

  async function finish(): Promise<void> {
    setConfirm(null);
    if (closing.current) return;
    closing.current = true;
    setError(null);
    setBusy(true);
    try {
      const closed = await access.transaction(async (repos) => {
        const result = await (await repos.workouts()).close(workout.id);
        // 0.2.4 point 6 : la question de routine attend sa réponse même si l'app est fermée pendant le résumé (même transaction que la clôture).
        if (!result.alreadyClosed) await repos.settings.set('training.routineUpdateAsk', result.routineDiff.hasChanges ? workout.id : null);
        // I2-01 (relecture de la #61, point B) : recalibrage « Facile » consigné à la clôture seulement, dans la même transaction.
        if (!result.alreadyClosed) await (await repos.progression()).applyClosedWorkout(workout.id);
        return result;
      });
      // Séance close (repos effacé en base) : minuteur, notification et Live Activity s'arrêtent ; un échec ici ne la rouvre pas.
      await timer.stop().catch(() => undefined);
      haptics.notification('success');
      if (live.current) onClosed(closed);
    } catch (e) {
      closing.current = false;
      if (live.current) {
        setError(tTraining(e instanceof RepositoryError && e.code === 'invalid' ? 'sessionFinishNone' : 'sessionFinishError'));
        setBusy(false);
      }
    }
  }

  async function extendRest(): Promise<void> {
    try {
      const report = await timer.extend();
      if (!live.current) return;
      setNow(clock.nowMs());
      setRest({ endAt: report.endAt, report });
    } catch {
      if (live.current) setError(tTraining('restError'));
    }
  }

  async function skipRest(): Promise<void> {
    try {
      await timer.skip();
      if (live.current) setRest(null);
    } catch {
      if (live.current) setError(tTraining('restError'));
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------------------------------------------------------------
  const blocks = groupByExercise(workout.sets);
  // I2-03 (§ 13.8) : rampe d'échauffement pour le premier exercice composé de chaque pattern, dans l'ordre de la séance.
  const warmupIds = warmupExerciseIds(blocks.map((b) => ({ exerciseId: b.exerciseId, exercise: exerciseOf(b.exerciseId) })));
  const summary = summarizeSets(workout.sets);
  const remaining = rest ? restRemainingMs(rest.endAt, now) : 0;
  const startedMs = Date.parse(workout.startedAt);

  if (picking) {
    const onKey = (event: KeyboardEvent<HTMLElement>): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setPicking(false);
      }
    };
    return (
      <section className="ct-training__picker" role="region" aria-label={tTraining('sessionPickerTitle')} onKeyDown={onKey}>
        <button type="button" className="ct-training__back" onClick={() => setPicking(false)}>
          <span>{tTraining('cancel')}</span>
        </button>
        <h2 ref={pickerHeading} tabIndex={-1} className="ct-training__heading">
          {tTraining('sessionPickerTitle')}
        </h2>
        <p className="ct-session__muted">{tTraining('pickerHint')}</p>
        <ExerciseList data={data} mode="picker" onSelect={(exercise) => void addExercise(exercise)} />
      </section>
    );
  }

  return (
    <div className="ct-session__active">
      <header className="ct-session__head">
        <div>
          <h2 className="ct-session__title">{workout.name === '' ? tTraining('sessionFree') : workout.name}</h2>
          <p className="ct-session__muted ct-session__num">
            <span role="timer" aria-live="off" aria-label={tTraining('sessionElapsed')}>
              {formatClock(now - startedMs)}
            </span>
            {' · '}
            <span>{tTraining('sessionSummary', { done: summary.validated, planned: summary.planned })}</span>
          </p>
        </div>
        <div className="ct-session__field ct-session__field--rest">
          <label className="ct-training__label" htmlFor="ct-session-rest">
            {tTraining('restDefault')}
          </label>
          <select
            id="ct-session-rest"
            className="ct-session__input"
            value={restSetting === null ? '' : String(restSetting)}
            aria-describedby="ct-session-rest-hint"
            onChange={(e) => onRestSetting(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">{tTraining('restDefaultExercise')}</option>
            {REST_CHOICES_SEC.map((s) => (
              <option key={s} value={String(s)}>
                {formatRest(s)}
              </option>
            ))}
          </select>
          <span id="ct-session-rest-hint" className="ct-session__hint">
            {tTraining('restDefaultHint')}
          </span>
        </div>
      </header>

      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}

      {blocks.length === 0 && <p className="ct-session__muted">{tTraining('sessionNoExercise')}</p>}

      {blocks.map((block) => {
        const exercise = exerciseOf(block.exerciseId);
        // Repos affiché : celui de la première série de travail (une rampe d'échauffement n'a pas de repos programmé).
        const first = block.sets.find((s) => s.setKind !== 'warmup') ?? block.sets[0];
        const restSec = first ? restSecondsFor({ setKind: 'work', targetRestSec: first.targetRestSec }, restSetting, exercise?.defaultRestSec ?? null) : null;
        const work = block.sets.filter((s) => s.setKind !== 'warmup').length;
        let rank = 0;
        return (
          <section key={block.exerciseId} className="ct-session__block" role="region" aria-label={block.exerciseName}>
            <div className="ct-session__block-head">
              <h3 className="ct-session__block-title">{block.exerciseName}</h3>
              <p className="ct-session__muted">
                {/* 0.2.3 : un repos nul ou absent n'affiche plus « repos 0 s ». */}
                {!restSec
                  ? work === 1
                    ? tTraining('sessionExerciseMetaOneNoRest')
                    : tTraining('sessionExerciseMetaNoRest', { n: work })
                  : work === 1
                    ? tTraining('sessionExerciseMetaOne', { rest: formatRest(restSec) })
                    : tTraining('sessionExerciseMeta', { n: work, rest: formatRest(restSec) })}
              </p>
            </div>
            <Suspense fallback={null}>
              <ExerciseProgression access={access} workout={workout} exerciseId={block.exerciseId} sets={block.sets} exercise={exercise} equipment={data.active} clock={clock} onChanged={reload} warmup={warmupIds.has(block.exerciseId)} />
            </Suspense>
            <ol className="ct-session__sets">
              {block.sets.map((set) => {
                if (set.setKind !== 'warmup') rank += 1;
                return (
                  <SetRow
                    key={set.id}
                    set={set}
                    number={rank}
                    timed={isTimedExercise(exercise, set)}
                    source={workout.source}
                    busy={busy}
                    onValidate={(entry) => void validate(set, entry)}
                    onUnvalidate={() => void write((repo) => repo.unvalidateSet(set.id))}
                    onKind={(kind: SetKind) => void write((repo) => repo.updateSet(set.id, { setKind: kind }))}
                    onRemove={() => void write((repo) => repo.removeSet(set.id))}
                  />
                );
              })}
            </ol>
            <div className="ct-training__actions">
              <Button variant="secondary" disabled={busy} onClick={() => void write((repo) => repo.addSet(workout.id, block.exerciseId, { setKind: block.sets.at(-1)?.setKind === 'timed' ? 'timed' : 'work' }))}>
                {tTraining('sessionAddSet')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ kind: 'exercise', block })}>
                {tTraining('sessionRemoveExercise')}
              </Button>
            </div>
          </section>
        );
      })}

      <div className="ct-training__actions">
        <Button variant="secondary" disabled={busy} onClick={() => setPicking(true)}>
          {tTraining('sessionAddExercise')}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => setConfirm({ kind: 'abandon' })}>
          {tTraining('sessionAbandon')}
        </Button>
      </div>
      <Button fullWidth disabled={busy} onClick={askFinish}>
        {tTraining('sessionFinish')}
      </Button>

      {(rest !== null || restDone) && (
        <div className="ct-session__rest" role="region" aria-label={tTraining('restEyebrow')}>
          {rest !== null ? (
            <>
              <div className="ct-session__rest-main">
                <span className="ct-training__eyebrow">{tTraining('restEyebrow')}</span>
                <span className="ct-session__rest-time ct-session__num" role="timer" aria-live="off" aria-label={tTraining('restRemaining')}>
                  {formatTimerRemaining(remaining)}
                </span>
              </div>
              <div className="ct-session__rest-actions">
                <Button variant="secondary" onClick={() => void extendRest()}>
                  {tTraining('restExtend')}
                </Button>
                <Button onClick={() => void skipRest()}>{tTraining('restSkip')}</Button>
              </div>
              {os === 'ios' && rest.report ? <RestExplanation report={rest.report} /> : null}
            </>
          ) : (
            <p className="ct-session__rest-done" role="status">
              {tTraining('restFinished')}
            </p>
          )}
        </div>
      )}

      {confirm?.kind === 'abandon' && (
        <ConfirmDialog
          title={tTraining('sessionAbandonTitle')}
          description={tTraining('sessionAbandonHint')}
          confirmLabel={tTraining('sessionAbandonConfirm')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void abandon()}
        />
      )}
      {confirm?.kind === 'finish' && (
        <ConfirmDialog
          title={tTraining('sessionFinishTitle')}
          description={confirm.pending === 1 ? tTraining('sessionFinishPendingOne') : tTraining('sessionFinishPending', { n: confirm.pending })}
          confirmLabel={tTraining('sessionFinishConfirm')}
          cancelLabel={tTraining('sessionFinishContinue')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void finish()}
        />
      )}
      {confirm?.kind === 'exercise' && (
        <ConfirmDialog
          title={tTraining('sessionRemoveExerciseTitle', { name: confirm.block.exerciseName })}
          description={tTraining('sessionRemoveExerciseHint')}
          confirmLabel={tTraining('sessionRemoveConfirm')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { exerciseId } = confirm.block;
            setConfirm(null);
            void write((repo) => repo.removeExercise(workout.id, exerciseId));
          }}
        />
      )}
    </div>
  );
}

/** iPhone : ce qui est vraiment en place (notification, Live Activity ou repli), sans rien promettre au-delà. */
function RestExplanation({ report }: { readonly report: RestReport }) {
  const lines: { readonly text: string; readonly alert: boolean }[] = [];
  if (report.notification === 'scheduled') lines.push({ text: tTraining('restNotificationScheduled'), alert: false });
  else if (report.notification === 'denied') lines.push({ text: tTraining('restNotificationDenied'), alert: true });
  else lines.push({ text: tTraining('restNotificationFailed'), alert: true });
  if (report.live !== 'started') lines.push({ text: tTraining('restLiveFallback'), alert: false });
  return (
    <div className="ct-session__rest-notes">
      {lines.map((line) => (
        <p key={line.text} className="ct-session__hint" role={line.alert ? 'alert' : 'status'}>
          {line.text}
        </p>
      ))}
    </div>
  );
}
