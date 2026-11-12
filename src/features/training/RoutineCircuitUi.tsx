import { useState, type FormEvent } from 'react';
import { routineCircuitsOf, validateRoutineGroup, type RoutineCircuitInfo, type RoutineCircuitLine, type RoutineGroupInput } from '../../domain/training';
import { tCircuit } from '../../i18n/circuitText';
import { tRoutineCircuit } from '../../i18n/routineCircuitText';
import { formatRest } from '../../i18n/trainingText';
import { Button } from '../../ui';
import './session/Circuit.css';

/**
 * Groupes dans l'éditeur de routine (I6-03b, § 13.8), bloc à la demande avec son catalogue de textes : en-tête d'un groupe (nature, tours, repos,
 * exercices, « Défaire le groupe ») et formulaire « Grouper en circuit ». Rien n'est écrit ici : le brouillon de l'éditeur reçoit le groupe, la routine
 * l'enregistre avec le reste (`saveDraft`). Mêmes libellés que la séance (catalogue fr.circuit).
 */

/** Ligne du jour vue par le formulaire : nom affiché en plus des valeurs utiles aux règles. */
export interface RoutineCircuitFormLine extends RoutineCircuitLine {
  readonly name: string;
}

const parseInteger = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

export function RoutineCircuitHeader({ circuit, names, onUngroup }: { readonly circuit: RoutineCircuitInfo; readonly names: readonly string[]; readonly onUngroup: () => void }) {
  const kind = tCircuit(circuit.kind);
  return (
    <section className="ct-circuit" role="region" aria-label={tCircuit('region', { kind })}>
      <h3 className="ct-circuit__title">{tCircuit(circuit.rounds === 1 ? 'headlineOne' : 'headline', { kind, n: circuit.lineIds.length, rounds: circuit.rounds })}</h3>
      <p className="ct-circuit__line">
        {tCircuit('rests', {
          between: circuit.restBetweenSec > 0 ? formatRest(circuit.restBetweenSec) : tCircuit('restNone'),
          round: circuit.restRoundSec > 0 ? formatRest(circuit.restRoundSec) : tCircuit('restNone'),
        })}
      </p>
      <p className="ct-circuit__line">
        <span>{tRoutineCircuit('membersLabel')} </span>
        <span>{names.join(', ')}</span>
      </p>
      <div className="ct-training__actions">
        <Button variant="secondary" onClick={onUngroup}>
          {tCircuit('ungroup')}
        </Button>
      </div>
    </section>
  );
}

export function RoutineCircuitForm({
  lines,
  newId,
  onCreate,
  onCancel,
}: {
  readonly lines: readonly RoutineCircuitFormLine[];
  readonly newId: () => string;
  readonly onCreate: (input: RoutineGroupInput) => void;
  readonly onCancel: () => void;
}) {
  const grouped = new Set(routineCircuitsOf(lines).flatMap((c) => c.lineIds));
  const free = [...lines].sort((a, b) => a.position - b.position).filter((l) => !grouped.has(l.id));
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [rounds, setRounds] = useState('');
  const [restBetween, setRestBetween] = useState('0');
  const [restRound, setRestRound] = useState('90');
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string): void => setChecked((now) => (now.has(id) ? new Set([...now].filter((x) => x !== id)) : new Set([...now, id])));

  function submit(event: FormEvent): void {
    event.preventDefault();
    setError(null);
    const lineIds = free.map((l) => l.id).filter((id) => checked.has(id));
    if (lineIds.length < 2) {
      setError(tCircuit('errorFew'));
      return;
    }
    const roundsValue = rounds.trim() === '' ? null : parseInteger(rounds);
    const between = parseInteger(restBetween);
    const round = restRound.trim() === '' ? null : parseInteger(restRound);
    const bad = (rounds.trim() !== '' && roundsValue === null) || between === null || (restRound.trim() !== '' && round === null);
    const input: RoutineGroupInput = { circuitId: newId(), lineIds, rounds: roundsValue, restBetweenSec: between ?? -1, restRoundSec: round };
    if (bad || validateRoutineGroup(lines, input).length > 0) {
      setError(tRoutineCircuit('errorValues'));
      return;
    }
    onCreate(input);
  }

  return (
    <section className="ct-circuit-form" role="region" aria-label={tCircuit('formTitle')}>
      <h3 className="ct-circuit-form__title">{tCircuit('formTitle')}</h3>
      <p className="ct-session__muted">{tRoutineCircuit('formHint')}</p>
      {free.length < 2 ? <p className="ct-session__muted">{tRoutineCircuit('pickNone')}</p> : null}
      <form className="ct-circuit-form__body" onSubmit={submit} noValidate>
        <fieldset className="ct-circuit-form__pick">
          <legend className="ct-training__label">{tCircuit('pickLegend')}</legend>
          {free.map((line) => (
            <label key={line.id} className="ct-circuit-form__check">
              <input type="checkbox" checked={checked.has(line.id)} onChange={() => toggle(line.id)} />
              <span>{line.name}</span>
            </label>
          ))}
        </fieldset>
        <div className="ct-circuit-form__field">
          <label className="ct-training__label" htmlFor="ct-routine-circuit-rounds">
            {tCircuit('roundsLabel')}
          </label>
          <input id="ct-routine-circuit-rounds" className="ct-session__input" inputMode="numeric" value={rounds} aria-describedby="ct-routine-circuit-rounds-hint" onChange={(e) => setRounds(e.target.value)} />
          <span id="ct-routine-circuit-rounds-hint" className="ct-session__hint">
            {tRoutineCircuit('roundsHint')}
          </span>
        </div>
        <div className="ct-circuit-form__field">
          <label className="ct-training__label" htmlFor="ct-routine-circuit-between">
            {tCircuit('restBetweenLabel')}
          </label>
          <input id="ct-routine-circuit-between" className="ct-session__input" inputMode="numeric" value={restBetween} onChange={(e) => setRestBetween(e.target.value)} />
        </div>
        <div className="ct-circuit-form__field">
          <label className="ct-training__label" htmlFor="ct-routine-circuit-round">
            {tCircuit('restRoundLabel')}
          </label>
          <input id="ct-routine-circuit-round" className="ct-session__input" inputMode="numeric" value={restRound} aria-describedby="ct-routine-circuit-round-hint" onChange={(e) => setRestRound(e.target.value)} />
          <span id="ct-routine-circuit-round-hint" className="ct-session__hint">
            {tRoutineCircuit('restRoundHint')}
          </span>
        </div>
        {error && (
          <p className="ct-training__error" role="alert">
            {error}
          </p>
        )}
        <p className="ct-session__muted">{tRoutineCircuit('saveHint')}</p>
        <div className="ct-training__actions">
          <Button type="submit">{tCircuit('create')}</Button>
          <Button variant="secondary" onClick={onCancel}>
            {tCircuit('cancel')}
          </Button>
        </div>
      </form>
    </section>
  );
}
