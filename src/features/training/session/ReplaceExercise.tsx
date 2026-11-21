import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ReplacementImplement } from '../../../domain/training/config';
import { estimateReplacementLoad, replacementCandidates, replacementSourceLoad, type ReplacementLoad } from '../../../domain/training/replacement';
import type { Exercise, ExerciseBlock, WorkoutWithSets } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { formatExerciseLoad, formatNumber } from '../../../i18n/trainingText';
import { tSession, type TrainingSessionTextKey } from '../../../i18n/trainingSessionText';
import { Button } from '../../../ui';
import { ExerciseList } from '../LibraryView';
import { exerciseGroup, type TrainingData } from '../trainingState';

/**
 * SESS-01a (§ 13.2 « Remplacer », § 14.1 alternatives) : feuille de remplacement d'un exercice de la séance ouverte, bloc à la demande. Alternatives
 * de la fiche d'abord, puis même groupe musculaire, puis recherche dans la bibliothèque ; tous compatibles avec le profil actif, ni écartés ni
 * déjà dans la séance. Le nouvel exercice sans historique reçoit une charge de départ estimée par la règle de conversion (dite en texte) ; avec
 * historique, aucune : la prescription habituelle s'applique. Case « Remplacer aussi dans la routine » (séance issue d'une routine) : la ligne du
 * jour change dans la même transaction ; sinon la question « Mettre à jour la routine ? » est posée à la clôture (écart retrait + ajout).
 */

const IMPL_KEYS: Readonly<Record<ReplacementImplement, TrainingSessionTextKey>> = { barbell: 'implBarbell', dumbbell: 'implDumbbell', machine: 'implMachine' };

type Estimate = { readonly kind: 'reading' } | { readonly kind: 'history' } | { readonly kind: 'none' } | { readonly kind: 'estimate'; readonly load: ReplacementLoad };

export interface ReplaceExerciseProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly workout: WorkoutWithSets;
  readonly block: ExerciseBlock;
  /** Exercices écartés (« ne plus proposer », SESS-01b). */
  readonly excluded: ReadonlySet<string>;
  /** SESS-01b : « Proposer à nouveau » un exercice écarté (réglage local écrit par l'appelant). */
  readonly onRestore: (exerciseId: string) => Promise<void>;
  readonly onCancel: () => void;
  /** Remplacement écrit : la séance est relue par l'appelant. */
  readonly onDone: () => void;
}

export function ReplaceExercise({ data, access, workout, block, excluded, onRestore, onCancel, onDone }: ReplaceExerciseProps) {
  const [chosen, setChosen] = useState<Exercise | null>(null);
  const [estimate, setEstimate] = useState<Estimate>({ kind: 'reading' });
  const [alsoRoutine, setAlsoRoutine] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const live = useRef(true);
  /** Dernier exercice choisi : une lecture d'historique plus ancienne n'écrase jamais l'estimation du choix courant. */
  const latest = useRef<string | null>(null);
  const routineId = useId();
  const title = tSession('replaceTitle', { name: block.exerciseName });
  const exerciseOf = (id: string): Exercise | undefined => data.content.catalog.get(id) ?? data.allCustoms.find((c) => c.id === id);
  const from = exerciseOf(block.exerciseId);
  const present = useMemo(() => new Set(workout.sets.filter((s) => s.deletedAt === null).map((s) => s.exerciseId)), [workout.sets]);

  const candidates = useMemo(
    () => (from === undefined ? { alternatives: [], similar: [] } : replacementCandidates({ of: from, library: data.exercises, profile: data.active, excluded, present, groupOf: (e) => exerciseGroup(e, data.content) })),
    [from, data, excluded, present],
  );

  useEffect(() => {
    live.current = true;
    heading.current?.focus();
    return () => {
      live.current = false;
    };
  }, []);

  async function choose(exercise: Exercise): Promise<void> {
    setError(null);
    setSearching(false);
    if (present.has(exercise.id)) {
      setError(tSession('replacePresent'));
      return;
    }
    setChosen(exercise);
    latest.current = exercise.id;
    setEstimate({ kind: 'reading' });
    let next: Estimate;
    try {
      const history = await (await access.repos.progression()).history(exercise.id);
      if (history.length > 0) next = { kind: 'history' };
      else {
        const load = from === undefined ? null : estimateReplacementLoad({ from, fromLoadKg: replacementSourceLoad(block.sets), to: exercise, profile: data.active });
        next = load === null ? { kind: 'none' } : { kind: 'estimate', load };
      }
    } catch {
      // Historique illisible : aucune estimation (jamais une charge devinée sur une lecture ratée).
      next = { kind: 'none' };
    }
    if (live.current && latest.current === exercise.id) setEstimate(next);
  }

  async function confirm(): Promise<void> {
    if (chosen === null || estimate.kind === 'reading') return;
    setError(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => {
        await (
          await repos.workouts()
        ).replaceExercise(workout.id, block.exerciseId, {
          exerciseId: chosen.id,
          exerciseName: chosen.nameFr,
          targetLoadKg: estimate.kind === 'estimate' ? estimate.load.loadKg : null,
          setKind: chosen.metric === 'time' ? 'timed' : 'work',
        });
        if (alsoRoutine && workout.routineId !== null && workout.routineDayId !== null) {
          const routines = await repos.trainingRoutines();
          const tree = await routines.get(workout.routineId);
          const line = tree?.days.find((d) => d.id === workout.routineDayId)?.exercises.find((l) => l.exerciseId === block.exerciseId);
          if (line !== undefined) await routines.updateExercise(line.id, { exerciseId: chosen.id, exerciseName: chosen.nameFr });
        }
      });
      onDone();
    } catch {
      if (live.current) {
        setError(tSession('replaceError'));
        setBusy(false);
      }
    }
  }

  async function restore(exercise: Exercise): Promise<void> {
    setError(null);
    try {
      await onRestore(exercise.id);
      if (live.current) setRestored(tSession('restoredExcluded', { name: exercise.nameFr }));
    } catch {
      if (live.current) setError(tSession('restoreError'));
    }
  }
  const excludedList = [...excluded].map((id) => exerciseOf(id)).filter((e): e is Exercise => e !== undefined).sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'));

  const onKey = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
    }
  };

  const list = (label: TrainingSessionTextKey, items: readonly Exercise[]) =>
    items.length === 0 ? null : (
      <>
        <h3 className="ct-session__block-title">{tSession(label)}</h3>
        <ul className="ct-session__replace-list" aria-label={tSession(label)}>
          {items.map((e) => (
            <li key={e.id}>
              <Button variant={chosen?.id === e.id ? 'primary' : 'secondary'} fullWidth disabled={busy} pressed={chosen?.id === e.id} onClick={() => void choose(e)}>
                {e.nameFr}
              </Button>
            </li>
          ))}
        </ul>
      </>
    );

  return (
    <section className="ct-training__picker ct-session__replace" role="region" aria-label={title} onKeyDown={onKey}>
      <h2 ref={heading} tabIndex={-1} className="ct-training__heading">
        {title}
      </h2>
      <p className="ct-session__muted">{tSession('replaceHint')}</p>
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      {list('replaceAlternatives', candidates.alternatives)}
      {list('replaceSimilar', candidates.similar)}
      {candidates.alternatives.length + candidates.similar.length === 0 && <p className="ct-session__muted">{tSession('replaceNone')}</p>}
      <Button variant="secondary" disabled={busy} expanded={searching} onClick={() => setSearching((v) => !v)}>
        {tSession(searching ? 'replaceSearchClose' : 'replaceSearch')}
      </Button>
      {searching && <ExerciseList data={data} mode="picker" onSelect={(exercise) => void choose(exercise)} />}
      {excludedList.length > 0 && (
        <>
          <h3 className="ct-session__block-title">{tSession('excludedTitle')}</h3>
          <ul className="ct-session__replace-list" aria-label={tSession('excludedTitle')}>
            {excludedList.map((e) => (
              <li key={e.id}>
                <Button variant="secondary" fullWidth disabled={busy} onClick={() => void restore(e)}>
                  {tSession('restoreExcluded', { name: e.nameFr })}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {restored !== null && (
        <p className="ct-session__muted" role="status">
          {restored}
        </p>
      )}

      {chosen !== null && (
        <div className="ct-session__replace-confirm" role="group" aria-label={tSession('replaceChosen', { name: chosen.nameFr })}>
          <p className="ct-session__block-title">{tSession('replaceChosen', { name: chosen.nameFr })}</p>
          <p className="ct-session__muted ct-session__num" role="status">
            {estimate.kind === 'reading'
              ? tSession('replaceReading')
              : estimate.kind === 'history'
                ? tSession('replaceHistory')
                : estimate.kind === 'none'
                  ? tSession('replaceNoEstimate')
                  : tSession('replaceEstimate', {
                      load: formatExerciseLoad(estimate.load.loadKg, estimate.load.held),
                      rule: tSession('replaceRule', { from: tSession(IMPL_KEYS[estimate.load.from]), to: tSession(IMPL_KEYS[estimate.load.to]), factor: formatNumber(estimate.load.factor) }),
                    })}
          </p>
          {workout.routineDayId !== null && (
            <div className="ct-session__check">
              <input id={routineId} type="checkbox" checked={alsoRoutine} disabled={busy} onChange={(e) => setAlsoRoutine(e.target.checked)} aria-describedby={`${routineId}-hint`} />
              <label htmlFor={routineId}>{tSession('replaceRoutine')}</label>
              <span id={`${routineId}-hint`} className="ct-session__hint">
                {tSession('replaceRoutineHint')}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="ct-training__actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {tSession('replaceCancel')}
        </Button>
        <Button disabled={busy || chosen === null || estimate.kind === 'reading'} onClick={() => void confirm()}>
          {tSession('replaceConfirm')}
        </Button>
      </div>
    </section>
  );
}
