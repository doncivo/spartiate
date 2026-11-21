import { useEffect, useState } from 'react';
import { isAssistedEquipment } from '../../../domain/training/assisted';
import { revertDecisionPrescription, revertProposal, type RevertProposal, type RevertTarget } from '../../../domain/training/revertPrescription';
import type { Exercise } from '../../../domain/training/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { formatDay, formatExerciseLoad, tTraining } from '../../../i18n/trainingText';
import { Button, ConfirmDialog, SectionTitle } from '../../../ui';

/**
 * MOTEUR-0281b (PRD § 11.5) : « Revenir à la prescription précédente » dans la fiche d'un exercice. Les décisions des séances closes donnent
 * la valeur d'avant la dernière hausse (`revertProposal`) ; après confirmation, une décision tracée (raison `revert-previous`) est écrite,
 * attachée à la dernière séance close de l'exercice (publiée avec elle, D-27) : rien n'est effacé, la prochaine proposition la reprend.
 */

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly proposal: RevertProposal; readonly workoutId: string | null }
  | { readonly status: 'done'; readonly target: RevertTarget };

/** Valeur dite : « 60 kg × 10 · 10 · 10 », « Poids du corps × 12 · 12 », « 45 s · 45 s » (lest éventuel devant). */
export function revertValueText(exercise: Pick<Exercise, 'metric'>, target: Pick<RevertTarget, 'loadKg' | 'reps'>, held: 1 | 2 | null): string {
  const join = tTraining('revertJoin');
  if (exercise.metric === 'time') {
    const secs = target.reps.map((sec) => tTraining('revertSeconds', { sec })).join(join);
    return target.loadKg > 0 ? tTraining('revertBallast', { load: formatExerciseLoad(target.loadKg, held), reps: secs }) : secs;
  }
  if (exercise.metric === 'bodyweight-reps' && !(target.loadKg > 0)) return tTraining('revertBodyweight', { reps: target.reps.join(join) });
  return tTraining('revertValue', { load: formatExerciseLoad(target.loadKg, held), reps: target.reps.join(join) });
}

export function RevertPrescription({ access, exercise, held }: { readonly access: DataAccess; readonly exercise: Exercise; readonly held: 1 | 2 | null }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Composant remonté par exercice (`key`) : l'état initial « loading » suffit.
    let live = true;
    void (async () => {
      try {
        const repo = await access.repos.progression();
        const [decisions, history] = await Promise.all([repo.decisions(exercise.id), repo.history(exercise.id, 1)]);
        const steps = decisions.map((d) => ({ workoutId: d.workoutId, decidedAt: d.decidedAt, loadKg: d.loadKg, reps: d.reps, revert: d.revert === true }));
        const proposal = revertProposal(steps, { metric: exercise.metric, assisted: isAssistedEquipment(exercise.equipment) });
        if (live) setState({ status: 'ready', proposal, workoutId: history[0]?.workoutId ?? null });
      } catch {
        if (live) setState({ status: 'error' });
      }
    })();
    return () => {
      live = false;
    };
  }, [access, exercise.id, exercise.metric, exercise.equipment]);

  async function confirm(target: RevertTarget, workoutId: string): Promise<void> {
    setConfirming(false);
    setBusy(true);
    setError(false);
    try {
      await access.transaction(async (repos) =>
        (await repos.progression()).recordDecision({
          exerciseId: exercise.id,
          workoutId,
          prescription: revertDecisionPrescription(target, exercise.metric),
          accepted: false,
          chosenLoadKg: target.loadKg,
          chosenReps: target.reps,
        }),
      );
      setState({ status: 'done', target });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  let body: JSX.Element;
  if (state.status === 'loading') body = <p className="ct-training__muted">{tTraining('revertLoading')}</p>;
  else if (state.status === 'error') body = <p className="ct-training__muted">{tTraining('revertLoadError')}</p>;
  else if (state.status === 'done') body = <p role="status">{tTraining('revertDone')}</p>;
  else if (state.proposal.kind === 'already') body = <p className="ct-training__muted">{tTraining('revertAlready')}</p>;
  else if (state.proposal.kind === 'none' || state.workoutId === null) body = <p className="ct-training__muted">{tTraining('revertNone')}</p>;
  else {
    const { target } = state.proposal;
    const workoutId = state.workoutId;
    const value = revertValueText(exercise, target, held);
    body = (
      <>
        <p className="ct-training__num">{tTraining('revertFrom', { date: formatDay(target.decidedAt), value })}</p>
        <p className="ct-training__muted">{tTraining('revertHint')}</p>
        <div className="ct-training__actions">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>
            {tTraining('revertButton')}
          </Button>
        </div>
        {error ? (
          <p className="ct-training__error" role="alert">
            {tTraining('revertWriteError')}
          </p>
        ) : null}
        {confirming ? (
          <ConfirmDialog
            title={tTraining('revertConfirmTitle')}
            description={tTraining('revertConfirmText', { value })}
            confirmLabel={tTraining('revertConfirm')}
            cancelLabel={tTraining('cancel')}
            onConfirm={() => void confirm(target, workoutId)}
            onCancel={() => setConfirming(false)}
          />
        ) : null}
      </>
    );
  }
  return (
    <section className="ct-sheet__section" aria-label={tTraining('revertTitle')}>
      <SectionTitle level={3}>{tTraining('revertTitle')}</SectionTitle>
      {body}
    </section>
  );
}
