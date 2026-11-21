import { tPlural } from '../../../i18n/plural';
import { useEffect, useRef, useState } from 'react';
import { logFailure } from '../../../platform/desktop/log';
import type { RoutineDiff } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { ClosedWorkout } from '../../../db/repositories/workoutRepository';
import { tTraining } from '../../../i18n/trainingText';
import { Button } from '../../../ui';
import type { Held } from '../loadDisplay';
import { recordText, SummaryFigures } from './SummaryFigures';
import { prescriptionGaps, type ExerciseGap, type GapTarget } from '../../../domain/training/summaryGap';
import { nextProgramDay } from '../../../domain/training/programDay';
import { formatExerciseLoad } from '../../../i18n/trainingText';
import { tSession } from '../../../i18n/trainingSessionText';
import { renderSummaryImage, shareSummaryImage, summaryCard, type ShareOutcome, type SummaryCard } from './summaryShare';

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
    ...diff.added.map((a) => (tPlural(tTraining, a.sets, 'routineAddedOne', 'routineAdded', { name: a.exerciseName }))),
  ];
}

export interface WorkoutSummaryProps {
  readonly access: DataAccess;
  readonly closed: ClosedWorkout;
  readonly onClose: () => void;
  readonly onJournal: () => void;
  /** ERGO-02 (D-261) : haltères tenus par exercice, pour un record de charge « 2 × 26 kg » ; absent : charge telle quelle. */
  readonly heldOf?: (exerciseId: string) => Held;
  /** SESS-01e : partage de l'image du résumé ; défaut : canvas local puis feuille du système ou téléchargement. */
  readonly shareImage?: (card: SummaryCard) => Promise<ShareOutcome | 'unavailable'>;
}

async function defaultShareImage(card: SummaryCard, fileName: string): Promise<ShareOutcome | 'unavailable'> {
  const blob = await renderSummaryImage(card);
  return blob === null ? 'unavailable' : shareSummaryImage(blob, fileName);
}

/** Ligne d'écart d'un exercice : séries, charge faite contre prévue, répétitions de plus ou de moins. */
function gapParts(gap: ExerciseGap, held: Held): string[] {
  const parts = [tPlural(tSession, gap.plannedSets, 'gapSetsOne', 'gapSets', { done: gap.doneSets, planned: gap.plannedSets })];
  if (gap.doneLoadKg !== null)
    parts.push(gap.targetLoadKg === null ? tSession('gapLoadDone', { done: formatExerciseLoad(gap.doneLoadKg, held) }) : tSession('gapLoad', { done: formatExerciseLoad(gap.doneLoadKg, held), target: formatExerciseLoad(gap.targetLoadKg, held) }));
  if (gap.repsDelta !== null) {
    const n = Math.abs(gap.repsDelta);
    parts.push(gap.repsDelta === 0 ? tSession('gapRepsSame') : gap.repsDelta > 0 ? tPlural(tSession, n, 'gapRepsMoreOne', 'gapRepsMore', { n }) : tPlural(tSession, n, 'gapRepsLessOne', 'gapRepsLess', { n }));
  }
  return parts;
}

export function WorkoutSummary({ access, closed, onClose, onJournal, heldOf = () => null, shareImage }: WorkoutSummaryProps) {
  const { workout, summary, routineDiff } = closed;
  const [step, setStep] = useState<RoutineStep>('ask');
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const live = useRef(true);
  /** SESS-01e : écart (décisions tracées de la séance), prochaine séance, partage de l'image. */
  const [gaps, setGaps] = useState<readonly ExerciseGap[] | 'error' | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [share, setShare] = useState<'idle' | 'busy' | ShareOutcome | 'unavailable'>('idle');
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const progression = await access.repos.progression();
        const ids = [...new Set(workout.sets.map((s) => s.exerciseId))];
        const targets = new Map<string, GapTarget>();
        for (const id of ids) {
          const decision = await progression.decisionFor(workout.id, id).catch(() => null);
          if (decision !== null && decision.loadKg !== null) targets.set(id, { loadKg: decision.loadKg, reps: decision.reps });
        }
        if (alive) setGaps(prescriptionGaps(workout.sets, targets));
      } catch {
        if (alive) setGaps('error');
      }
      if (workout.routineId === null) return;
      try {
        const tree = await (await access.repos.trainingRoutines()).get(workout.routineId);
        const dayId = tree === null ? null : nextProgramDay(tree.days, [{ routineId: workout.routineId, routineDayId: workout.routineDayId }], workout.routineId);
        const name = tree?.days.find((d) => d.id === dayId)?.name ?? null;
        if (alive) setNext(name);
      } catch {
        // Routine illisible : pas de « prochaine séance » (rien d'inventé).
      }
    })();
    return () => {
      alive = false;
    };
  }, [access, workout]);

  async function shareCard(): Promise<void> {
    setShare('busy');
    const card = summaryCard({
      name: workout.name === '' ? tTraining('sessionFree') : workout.name,
      endedAt: workout.endedAt ?? workout.startedAt,
      durationSec: summary.durationSec,
      workSets: summary.validatedWorkSets,
      volumeKg: summary.tonnageKg,
      records: summary.records.map((r) => ({ exerciseName: r.exerciseName, text: recordText(r, heldOf(r.exerciseId)) })),
    });
    try {
      const outcome = await (shareImage ?? ((c: SummaryCard) => defaultShareImage(c, tSession('shareFile', { date: (workout.endedAt ?? workout.startedAt).slice(0, 10) }))))(card);
      if (live.current) setShare(outcome);
    } catch {
      if (live.current) setShare('unavailable');
    }
  }

  useEffect(() => {
    live.current = true;
    heading.current?.focus();
    return () => {
      live.current = false;
    };
  }, []);

  /** La question a sa réponse (Oui, Cette fois seulement ou fermeture du résumé) : elle ne sera plus reproposée. Un échec est journalisé. */
  function settle(): void {
    if (!routineDiff.hasChanges) return;
    void access.repos.settings.set('training.routineUpdateAsk', null).catch((error: unknown) => logFailure('training', error));
  }

  async function updateRoutine(): Promise<void> {
    setError(null);
    setStep('busy');
    try {
      await access.transaction(async (repos) => (await repos.workouts()).applyRoutineUpdate(workout.id));
      settle();
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
          <span className="ct-summary__pill">{tPlural(tTraining, records.length, 'summaryRecordsOne', 'summaryRecords')}</span>
        ) : null}
      </div>

      <SummaryFigures summary={summary} />

      {gaps !== null && gaps !== 'error' && gaps.length > 0 ? (
        <div className="ct-summary__card">
          <h3 id="ct-summary-gap" className="ct-training__eyebrow ct-section-title">
            {tSession('gapTitle')}
          </h3>
          <ul className="ct-summary__records" aria-labelledby="ct-summary-gap">
            {gaps.map((g) => (
              <li key={g.exerciseId} className="ct-summary__record ct-summary__gap">
                <span className="ct-summary__record-name">{g.exerciseName}</span>
                {gapParts(g, heldOf(g.exerciseId)).map((part) => (
                  <span key={part} className="ct-session__num">
                    {part}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {gaps === 'error' ? <p className="ct-session__muted">{tSession('gapError')}</p> : null}
      {next !== null ? (
        <p className="ct-session__block-title" role="status">
          {tSession('nextSession', { name: next })}
        </p>
      ) : null}

      {records.length > 0 ? (
        <div className="ct-summary__card">
          <h3 id="ct-summary-records" className="ct-training__eyebrow ct-section-title">
            {tTraining('summaryRecordsTitle')}
          </h3>
          <ul className="ct-summary__records" aria-labelledby="ct-summary-records">
            {records.map((r) => (
              <li key={`${r.exerciseId}-${r.kind}`} className="ct-summary__record">
                <span className="ct-summary__record-name">{r.exerciseName}</span>
                <span className="ct-session__num">{recordText(r, heldOf(r.exerciseId))}</span>
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
            <Button variant="secondary" disabled={step === 'busy'} onClick={() => {
                settle();
                setStep('kept');
              }}>
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

      <div className="ct-summary__share">
        <Button variant="secondary" disabled={share === 'busy'} onClick={() => void shareCard()}>
          {tSession('shareImage')}
        </Button>
        <p className="ct-session__hint">{tSession('shareHint')}</p>
        {share !== 'idle' ? (
          <p className={share === 'unavailable' ? 'ct-training__error' : 'ct-session__muted'} role={share === 'unavailable' ? 'alert' : 'status'}>
            {tSession(share === 'busy' ? 'shareBusy' : share === 'shared' ? 'shareDone' : share === 'cancelled' ? 'shareCancelled' : share === 'downloaded' ? 'shareDownloaded' : 'shareError')}
          </p>
        ) : null}
      </div>

      <div className="ct-training__actions">
        <Button
          variant="secondary"
          onClick={() => {
            settle();
            onJournal();
          }}
        >
          {tTraining('summaryJournal')}
        </Button>
        <Button
          onClick={() => {
            settle();
            onClose();
          }}
        >
          {tTraining('summaryClose')}
        </Button>
      </div>
    </section>
  );
}
