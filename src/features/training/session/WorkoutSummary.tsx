import { useEffect, useRef, useState } from 'react';
import type { RoutineDiff } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { ClosedWorkout } from '../../../db/repositories/workoutRepository';
import { tTraining } from '../../../i18n/trainingText';
import { Button } from '../../../ui';
import { recordText, SummaryFigures } from './SummaryFigures';

/**
 * Résumé de fin de séance (I1-03, § 13.5 ; maquette iPhone-Resume) : durée, séries validées hors échauffement, volume (tonnage des séries de
 * travail seulement : échauffement, dégressives, partielles et chronométrées exclues, règle du domaine), records. Si la séance diffère de
 * son jour de routine, « Mettre à jour la routine ? » (§ 13.8) : rien n'est écrit dans la routine avant « Oui » ; « Cette fois seulement »
 * n'écrit rien. Chargé à la demande depuis l'écran de séance.
 */

type RoutineStep = 'ask' | 'busy' | 'updated' | 'kept';

function diffLines(diff: RoutineDiff): string[] {
  return [
    ...diff.removed.map((r) => tTraining('routineRemoved', { name: r.exerciseName })),
    ...diff.setsChanged.map((c) => tTraining('routineSetsChanged', { name: c.exerciseName, from: c.from, to: c.to })),
    ...diff.added.map((a) => (a.sets === 1 ? tTraining('routineAddedOne', { name: a.exerciseName }) : tTraining('routineAdded', { name: a.exerciseName, n: a.sets }))),
  ];
}

export interface WorkoutSummaryProps {
  readonly access: DataAccess;
  readonly closed: ClosedWorkout;
  readonly onClose: () => void;
  readonly onJournal: () => void;
}

export function WorkoutSummary({ access, closed, onClose, onJournal }: WorkoutSummaryProps) {
  const { workout, summary, routineDiff } = closed;
  const [step, setStep] = useState<RoutineStep>('ask');
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    heading.current?.focus();
    return () => {
      live.current = false;
    };
  }, []);

  async function updateRoutine(): Promise<void> {
    setError(null);
    setStep('busy');
    try {
      await access.transaction(async (repos) => (await repos.workouts()).applyRoutineUpdate(workout.id));
      if (live.current) setStep('updated');
    } catch {
      if (live.current) {
        setStep('ask');
        setError(tTraining('routineUpdateError'));
      }
    }
  }

  const name = workout.name === '' ? tTraining('sessionFree') : workout.name;
  const records = summary.records;
  const asking = routineDiff.hasChanges && (step === 'ask' || step === 'busy');

  return (
    <section className="ct-summary" role="region" aria-label={tTraining('summaryRegion')}>
      <div className="ct-summary__head">
        <h2 ref={heading} tabIndex={-1} className="ct-session__title">
          {tTraining('summaryTitle', { name })}
        </h2>
        {records.length > 0 ? (
          <span className="ct-summary__pill">{records.length === 1 ? tTraining('summaryRecordsOne') : tTraining('summaryRecords', { n: records.length })}</span>
        ) : null}
      </div>

      <SummaryFigures summary={summary} />

      {records.length > 0 ? (
        <div className="ct-summary__card">
          <h3 id="ct-summary-records" className="ct-training__eyebrow">
            {tTraining('summaryRecordsTitle')}
          </h3>
          <ul className="ct-summary__records" aria-labelledby="ct-summary-records">
            {records.map((r) => (
              <li key={`${r.exerciseId}-${r.kind}`} className="ct-summary__record">
                <span className="ct-summary__record-name">{r.exerciseName}</span>
                <span className="ct-session__num">{recordText(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {asking ? (
        <div className="ct-summary__card ct-summary__card--question" role="group" aria-labelledby="ct-summary-routine">
          <h3 id="ct-summary-routine" className="ct-summary__question">
            {tTraining('routineQuestion')}
          </h3>
          <p className="ct-session__hint">{tTraining('routineQuestionHint')}</p>
          <ul className="ct-summary__changes">
            {diffLines(routineDiff).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="ct-training__actions">
            <Button disabled={step === 'busy'} onClick={() => void updateRoutine()}>
              {tTraining('routineYes')}
            </Button>
            <Button variant="secondary" disabled={step === 'busy'} onClick={() => setStep('kept')}>
              {tTraining('routineThisTime')}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      ) : null}
      {step === 'updated' || step === 'kept' ? (
        <p className="ct-session__muted" role="status">
          {tTraining(step === 'updated' ? 'routineUpdated' : 'routineKept')}
        </p>
      ) : null}

      <div className="ct-training__actions">
        <Button variant="secondary" onClick={onJournal}>
          {tTraining('summaryJournal')}
        </Button>
        <Button onClick={onClose}>{tTraining('summaryClose')}</Button>
      </div>
    </section>
  );
}
