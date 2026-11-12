import { useState, type FormEvent } from 'react';
import { groupByExercise, nextCircuitSet, roundOf, validateCircuit, type CircuitInfo, type WorkoutWithSets } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { RepositoryError } from '../../../db/repositories/common';
import { tCircuit } from '../../../i18n/circuitText';
import { formatRest } from '../../../i18n/trainingText';
import { Button } from '../../../ui';
import './Circuit.css';

/**
 * Circuits de la séance active (I6-03, § 13.8), bloc à la demande avec son catalogue de textes : en-tête d'un groupe (nature, tours, repos, exercice
 * suivant, « Défaire le groupe ») et formulaire « Grouper en circuit ». Les écritures passent par `groupExercises` / `ungroupCircuit` (transaction).
 */

const REST_BETWEEN_DEFAULT = '0';
const REST_ROUND_DEFAULT = '90';

const parseInteger = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

export function CircuitHeader({ circuit, workout, busy, onUngroup }: { readonly circuit: CircuitInfo; readonly workout: WorkoutWithSets; readonly busy: boolean; readonly onUngroup: () => void }) {
  const kind = tCircuit(circuit.kind);
  const next = nextCircuitSet(workout.sets, circuit.circuitId);
  const round = next === null ? null : roundOf(workout.sets, next.id);
  return (
    <section className="ct-circuit" role="region" aria-label={tCircuit('region', { kind })}>
      <h3 className="ct-circuit__title">{tCircuit(circuit.rounds === 1 ? 'headlineOne' : 'headline', { kind, n: circuit.exerciseIds.length, rounds: circuit.rounds })}</h3>
      <p className="ct-circuit__line">
        {tCircuit('rests', {
          between: circuit.restBetweenSec > 0 ? formatRest(circuit.restBetweenSec) : tCircuit('restNone'),
          round: circuit.restRoundSec === null ? tCircuit('restOwn') : circuit.restRoundSec > 0 ? formatRest(circuit.restRoundSec) : tCircuit('restNone'),
        })}
      </p>
      <p className="ct-circuit__next" role="status">
        {next === null ? tCircuit('finished') : tCircuit('next', { name: next.exerciseName, round: round ?? 1, rounds: circuit.rounds })}
      </p>
      <div className="ct-training__actions">
        <Button variant="secondary" disabled={busy} onClick={onUngroup}>
          {tCircuit('ungroup')}
        </Button>
      </div>
    </section>
  );
}

export function CircuitForm({ access, workout, onDone, onCancel }: { readonly access: DataAccess; readonly workout: WorkoutWithSets; readonly onDone: () => void; readonly onCancel: () => void }) {
  const free = groupByExercise(workout.sets).filter((block) => block.sets.every((s) => !s.circuitId));
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [rounds, setRounds] = useState('');
  const [restBetween, setRestBetween] = useState(REST_BETWEEN_DEFAULT);
  const [restRound, setRestRound] = useState(REST_ROUND_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string): void => setChecked((now) => (now.has(id) ? new Set([...now].filter((x) => x !== id)) : new Set([...now, id])));

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    const exerciseIds = free.map((b) => b.exerciseId).filter((id) => checked.has(id));
    const roundsValue = rounds.trim() === '' ? undefined : parseInteger(rounds);
    const between = parseInteger(restBetween);
    const round = restRound.trim() === '' ? null : parseInteger(restRound);
    if (exerciseIds.length < 2) {
      setError(tCircuit('errorFew'));
      return;
    }
    const maxSets = Math.max(1, ...exerciseIds.map((id) => workout.sets.filter((s) => s.exerciseId === id && s.setKind !== 'warmup').length));
    if (roundsValue === null || between === null || (restRound.trim() !== '' && round === null) || validateCircuit({ exerciseIds, rounds: roundsValue ?? maxSets, restBetweenSec: between, restRoundSec: round }).length > 0) {
      setError(tCircuit('errorValues'));
      return;
    }
    setBusy(true);
    try {
      await access.transaction(async (repos) => (await repos.workouts()).groupExercises(workout.id, { exerciseIds, ...(roundsValue === undefined ? {} : { rounds: roundsValue }), restBetweenSec: between, restRoundSec: round }));
      onDone();
    } catch (e) {
      setError(tCircuit(e instanceof RepositoryError && e.code === 'invalid' ? 'errorDone' : 'errorWrite'));
      setBusy(false);
    }
  }

  return (
    <section className="ct-circuit-form" role="region" aria-label={tCircuit('formTitle')}>
      <h3 className="ct-circuit-form__title">{tCircuit('formTitle')}</h3>
      <p className="ct-session__muted">{tCircuit('formHint')}</p>
      <form className="ct-circuit-form__body" onSubmit={(e) => void submit(e)} noValidate>
        <fieldset className="ct-circuit-form__pick">
          <legend className="ct-training__label">{tCircuit('pickLegend')}</legend>
          {free.map((block) => (
            <label key={block.exerciseId} className="ct-circuit-form__check">
              <input type="checkbox" checked={checked.has(block.exerciseId)} onChange={() => toggle(block.exerciseId)} />
              <span>{block.exerciseName}</span>
            </label>
          ))}
        </fieldset>
        <div className="ct-circuit-form__field">
          <label className="ct-training__label" htmlFor="ct-circuit-rounds">
            {tCircuit('roundsLabel')}
          </label>
          <input id="ct-circuit-rounds" className="ct-session__input" inputMode="numeric" value={rounds} aria-describedby="ct-circuit-rounds-hint" onChange={(e) => setRounds(e.target.value)} />
          <span id="ct-circuit-rounds-hint" className="ct-session__hint">
            {tCircuit('roundsHint')}
          </span>
        </div>
        <div className="ct-circuit-form__field">
          <label className="ct-training__label" htmlFor="ct-circuit-between">
            {tCircuit('restBetweenLabel')}
          </label>
          <input id="ct-circuit-between" className="ct-session__input" inputMode="numeric" value={restBetween} onChange={(e) => setRestBetween(e.target.value)} />
        </div>
        <div className="ct-circuit-form__field">
          <label className="ct-training__label" htmlFor="ct-circuit-round">
            {tCircuit('restRoundLabel')}
          </label>
          <input id="ct-circuit-round" className="ct-session__input" inputMode="numeric" value={restRound} onChange={(e) => setRestRound(e.target.value)} />
        </div>
        {error && (
          <p className="ct-training__error" role="alert">
            {error}
          </p>
        )}
        <div className="ct-training__actions">
          <Button type="submit" disabled={busy}>
            {tCircuit('create')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {tCircuit('cancel')}
          </Button>
        </div>
      </form>
    </section>
  );
}
