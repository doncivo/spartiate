import { replayWorkout, type ReplayEffort, type ReplayLoad, type ReplayRest, type ReplayStep } from '../../../domain/training/replay';
import type { WorkoutWithSets } from '../../../domain/training';
import { formatNumber, formatRest } from '../../../i18n/trainingText';
import { formatReplayTime, tReplay } from '../../../i18n/workoutReplayText';
import type { Held } from '../loadDisplay';

/**
 * Déroulé série par série d'une séance passée (I6-03b, § 13.8 « Replay set par set »), bloc à la demande avec son catalogue : séries dans l'ordre réel
 * des validations, charge, répétitions (ou durée) et repos réels face aux cibles, écarts dits en texte (§ 18.6). Lecture seule : rien n'est écrit. Le
 * calcul est dans `src/domain/training/replay.ts`.
 */

/** ERGO-02 (D-261) : charge de deux haltères en « 2 × 26 kg », écart dit « par haltère » ; la valeur stockée reste celle d'un haltère. */
const kg = (n: number, held: Held): string => tReplay(held === 2 ? 'kgPair' : 'kg', { n: formatNumber(n) });

function loadText(load: ReplayLoad, held: Held): string {
  if (load.actual === null) return tReplay('loadNoValue');
  if (load.target === null || load.delta === null) return tReplay('loadNoTarget', { actual: kg(load.actual, held) });
  const more = held === 2 ? 'loadMorePair' : 'loadMore';
  const less = held === 2 ? 'loadLessPair' : 'loadLess';
  const gap = load.deviation === 'onTarget' ? tReplay('onTarget') : tReplay(load.delta > 0 ? more : less, { n: formatNumber(Math.abs(load.delta)) });
  return tReplay('load', { actual: kg(load.actual, held), target: kg(load.target, held), gap });
}

function effortText(effort: ReplayEffort): string {
  const timed = effort.measure === 'duration';
  const value = (n: number): string => (timed ? formatRest(n) : String(n));
  if (effort.actual === null) return tReplay(timed ? 'durationNoValue' : 'repsNoValue');
  if (effort.delta === null) return tReplay(timed ? 'durationNoTarget' : 'repsNoTarget', { actual: value(effort.actual) });
  const { targetMin: min, targetMax: max } = effort;
  const target =
    min !== null && max !== null ? (min === max ? value(min) : tReplay('range', { min: value(min), max: value(max) })) : min !== null ? tReplay('rangeMin', { min: value(min) }) : tReplay('rangeMax', { max: value(max as number) });
  const gap =
    effort.deviation === 'onTarget'
      ? tReplay('onTarget')
      : timed
        ? tReplay(effort.delta > 0 ? 'restLonger' : 'restShorter', { d: formatRest(Math.abs(effort.delta)) })
        : tReplay(effort.delta > 0 ? 'countMore' : 'countLess', { n: Math.abs(effort.delta) });
  return tReplay(timed ? 'duration' : 'reps', { actual: value(effort.actual), target, gap });
}

function restText(rest: ReplayRest): string {
  if (rest.deviation === 'last') return tReplay('restLast');
  if (rest.actualSec === null) return tReplay('restUnknown');
  if (rest.targetSec === null || rest.deltaSec === null) return tReplay('restNoTarget', { actual: formatRest(rest.actualSec) });
  const gap = rest.deviation === 'onTarget' ? tReplay('onTarget') : tReplay(rest.deltaSec > 0 ? 'restLonger' : 'restShorter', { d: formatRest(Math.abs(rest.deltaSec)) });
  return tReplay('rest', { actual: formatRest(rest.actualSec), target: formatRest(rest.targetSec), gap });
}

function stepTitle(step: ReplayStep): string {
  const name = step.set.exerciseName;
  if (step.setNumber === null) return tReplay('stepTitleWarmup', { order: step.order, name });
  return step.round === null ? tReplay('stepTitle', { order: step.order, name, n: step.setNumber }) : tReplay('stepTitleRound', { order: step.order, name, n: step.setNumber, round: step.round });
}

export function HistoryTimelineView({ workout, heldOf = () => null }: { readonly workout: WorkoutWithSets; readonly heldOf?: (exerciseId: string) => Held }) {
  const replay = replayWorkout(workout);
  return (
    <section className="ct-summary__card" role="region" aria-label={tReplay('title')}>
      <h3 className="ct-training__eyebrow ct-section-title">{tReplay('title')}</h3>
      <p className="ct-session__muted">{tReplay('intro')}</p>
      {replay.steps.length === 0 ? (
        <p className="ct-session__muted">{tReplay('empty')}</p>
      ) : (
        <ol className="ct-session__sets">
          {replay.steps.map((step) => (
            <li key={step.set.id} className="ct-summary__record">
              <div>
                <p className="ct-summary__record-name">{stepTitle(step)}</p>
                <p className="ct-session__muted">{step.set.doneAt === null ? tReplay('atUnknown') : tReplay('at', { time: formatReplayTime(step.set.doneAt) })}</p>
                <p>{loadText(step.load, heldOf(step.set.exerciseId))}</p>
                <p>{effortText(step.effort)}</p>
                <p>{restText(step.rest)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {replay.notDone > 0 ? <p className="ct-session__muted">{replay.notDone === 1 ? tReplay('notDoneOne') : tReplay('notDone', { n: replay.notDone })}</p> : null}
      {replay.missingInstants > 0 ? <p className="ct-session__muted">{replay.missingInstants === 1 ? tReplay('missingOne') : tReplay('missing', { n: replay.missingInstants })}</p> : null}
    </section>
  );
}
