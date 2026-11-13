import { Check, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { defaultEntry, validateSetEntry, type SetEntry, type SetKind, type WorkoutSet, type WorkoutSource } from '../../../domain/training';
import { stepLoad } from '../../../domain/training/loadGrid';
import { formatNumber, parseNumber, tTraining, type TrainingTextKey } from '../../../i18n/trainingText';
import { Icon } from '../../../ui';

/**
 * Une série de la séance active (§ 13.2, I1-02 critères 2 et 5) : cible rappelée (plage de la routine, ou valeurs de la séance copiée),
 * saisie pré-remplie seulement par des valeurs explicites (jamais une cible inventée), validation en une interaction (bouton ou Entrée),
 * état écrit en toutes lettres (« À faire », « Validée ») et non par la couleur seule. Pavé numérique, police ≥ 16 px (pas de zoom iOS).
 */

interface Draft {
  readonly load: string;
  readonly reps: string;
  readonly duration: string;
  readonly rir: string;
}

const text = (n: number | null): string => (n === null ? '' : formatNumber(n));
const sameDraft = (x: Draft, y: Draft): boolean => x.load === y.load && x.reps === y.reps && x.duration === y.duration && x.rir === y.rir;

function initialDraft(set: WorkoutSet, timed: boolean): Draft {
  const entry = defaultEntry(set);
  const single = set.targetRepsMin !== null && set.targetRepsMin === set.targetRepsMax ? set.targetRepsMin : null;
  return {
    load: text(entry.loadKg),
    reps: timed ? '' : text(entry.reps),
    // Exercice chronométré saisi en série de travail : la cible unique est une durée.
    duration: timed ? text(set.durationSec ?? entry.durationSec ?? single) : '',
    rir: text(entry.rir),
  };
}

/** Rappel de la cible : « Dernière fois » pour une séance copiée (cible unique), sinon la plage de la routine. */
export function targetText(set: WorkoutSet, timed: boolean, source: WorkoutSource): string | null {
  const { targetRepsMin: min, targetRepsMax: max, targetLoadKg: load } = set;
  if (source === 'copy' && min !== null && min === max) {
    if (timed) return tTraining('sessionLastDuration', { n: min });
    return load === null ? tTraining('sessionLastReps', { reps: min }) : tTraining('sessionLastLoad', { load: formatNumber(load), reps: min });
  }
  if (min !== null && max !== null) {
    if (timed) return min === max ? tTraining('sessionTargetDuration', { n: min }) : tTraining('sessionTargetDurationRange', { min, max });
    return min === max ? tTraining('sessionTargetReps', { n: min }) : tTraining('sessionTargetRange', { min, max });
  }
  return load === null ? null : tTraining('sessionTargetLoad', { n: formatNumber(load) });
}

function doneText(set: WorkoutSet): string {
  if (set.durationSec !== null && set.reps === null)
    return set.loadKg === null ? tTraining('sessionDoneDuration', { n: set.durationSec }) : tTraining('sessionDoneLoadDuration', { load: formatNumber(set.loadKg), n: set.durationSec });
  if (set.loadKg === null) return tTraining('sessionDoneReps', { reps: set.reps ?? 0 });
  return tTraining('sessionDoneLoad', { load: formatNumber(set.loadKg), reps: set.reps ?? 0 });
}

export interface SetRowProps {
  readonly set: WorkoutSet;
  /** Rang parmi les séries hors échauffement de l'exercice (1, 2…). */
  readonly number: number;
  /** ERGO-01 : série en cours (première à faire de la séance), bloc central mis en avant et annoncé (`aria-current="step"`). */
  readonly current?: boolean;
  /** ERGO-01b P3 : charges disponibles de l'exercice avec le profil de matériel actif (cran du « − / + ») ; null : cran par défaut. */
  readonly loads?: readonly number[] | null;
  readonly timed: boolean;
  readonly source: WorkoutSource;
  readonly busy: boolean;
  readonly onValidate: (entry: SetEntry) => void;
  readonly onUnvalidate: () => void;
  readonly onKind: (kind: SetKind) => void;
  readonly onRemove: () => void;
}

export function SetRow({ set, number, current = false, loads = null, timed, source, busy, onValidate, onUnvalidate, onKind, onRemove }: SetRowProps) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(set, timed));
  const [issue, setIssue] = useState<string | null>(null);
  // I2-01 : une proposition acceptée écrit charge et répétitions dans une série à faire ; la saisie repart des valeurs enregistrées (la ligne
  // n'est pas remontée : le focus reste où il est), SAUF si Ali a déjà tapé quelque chose dans cette ligne : sa saisie l'emporte toujours.
  const stored = [set.loadKg, set.reps, set.durationSec, set.rir].map(String).join('|');
  const [synced, setSynced] = useState<{ readonly key: string; readonly draft: Draft }>(() => ({ key: stored, draft: draft }));
  if (synced.key !== stored) {
    const next = initialDraft(set, timed);
    setSynced({ key: stored, draft: next });
    if (!set.done && sameDraft(draft, synced.draft)) setDraft(next);
  }
  const warmup = set.setKind === 'warmup';
  const target = targetText(set, timed, source);
  const label = warmup ? tTraining('sessionWarmupSet') : tTraining('sessionSet', { n: number });

  function validate(): void {
    const fields = timed ? [draft.load, draft.duration, draft.rir] : [draft.load, draft.reps, draft.rir];
    if (fields.some((f) => f.trim() !== '' && parseNumber(f) === null)) {
      setIssue(tTraining('sessionErrorValues'));
      return;
    }
    const entry: SetEntry = {
      reps: timed ? null : parseNumber(draft.reps),
      loadKg: parseNumber(draft.load),
      durationSec: timed ? parseNumber(draft.duration) : null,
      rir: parseNumber(draft.rir),
    };
    const issues = validateSetEntry(entry, timed ? 'timed' : set.setKind);
    if (issues.length > 0) {
      setIssue(tTraining(issues.includes('empty') ? 'sessionErrorEmpty' : issues.length === 1 && issues[0] === 'duration' && entry.durationSec === null ? 'sessionErrorDuration' : 'sessionErrorValues'));
      return;
    }
    setIssue(null);
    onValidate(entry);
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!busy) validate();
    }
  };
  /** ERGO-01b P3 : un tap = un cran (charge) ou une répétition ; la saisie au clavier reste possible. */
  function step(key: 'load' | 'reps', dir: 1 | -1): void {
    setDraft((now) => {
      const value = parseNumber(now[key]);
      const next = key === 'load' ? stepLoad(value, loads, dir) : value === null ? (dir === 1 ? 1 : null) : Math.max(0, value + dir);
      return next === null ? now : { ...now, [key]: formatNumber(next) };
    });
  }
  const stepper = (key: 'load' | 'reps', down: TrainingTextKey, up: TrainingTextKey) => (
    <div className="ct-session__stepper">
      <button type="button" className="ct-session__step" aria-label={tTraining(down)} disabled={busy} onClick={() => step(key, -1)}>
        {tTraining('sessionStepMinus')}
      </button>
      <button type="button" className="ct-session__step" aria-label={tTraining(up)} disabled={busy} onClick={() => step(key, 1)}>
        {tTraining('sessionStepPlus')}
      </button>
    </div>
  );
  const steps = current && !timed;
  const field = (key: keyof Draft, labelKey: TrainingTextKey, mode: 'decimal' | 'numeric') => (
    <label className="ct-session__field">
      <span className="ct-training__label">{tTraining(labelKey)}</span>
      <input
        className="ct-session__input"
        inputMode={mode}
        enterKeyHint="done"
        autoComplete="off"
        value={draft[key]}
        onChange={(e) => setDraft((now) => ({ ...now, [key]: e.target.value }))}
        onKeyDown={onKey}
      />
    </label>
  );

  return (
    <li
      className={set.done ? 'ct-session__set ct-session__set--done' : current ? 'ct-session__set ct-session__set--current' : 'ct-session__set'}
      role="group"
      aria-label={label}
      aria-current={current ? 'step' : undefined}
    >
      {current ? <span className="ct-session__current">{tTraining('sessionCurrentSet')}</span> : null}
      <div className="ct-session__set-head">
        <span className="ct-session__set-mark ct-session__num" aria-hidden="true">
          {warmup ? tTraining('sessionWarmupMark') : number}
        </span>
        <span className="ct-session__set-target">{target ?? ''}</span>
        <span className={set.done ? 'ct-session__state ct-session__state--done' : 'ct-session__state'}>
          {set.done ? <Icon icon={Check} size="sm" /> : null}
          {tTraining(set.done ? 'sessionDone' : 'sessionTodo')}
        </span>
      </div>
      {set.done ? (
        <div className="ct-session__set-body">
          <span className="ct-session__done-value ct-session__num">{doneText(set)}</span>
          {set.rir !== null ? <span className="ct-session__muted">{tTraining('sessionDoneRir', { n: set.rir })}</span> : null}
          <button type="button" className="ct-training__link" disabled={busy} onClick={onUnvalidate}>
            {tTraining('sessionUnvalidate')}
          </button>
        </div>
      ) : (
        <>
          <div className="ct-session__fields">
            {field('load', 'sessionLoad', 'decimal')}
            {steps ? stepper('load', 'sessionLoadDown', 'sessionLoadUp') : null}
            {timed ? field('duration', 'sessionDuration', 'numeric') : field('reps', 'sessionReps', 'numeric')}
            {steps ? stepper('reps', 'sessionRepsDown', 'sessionRepsUp') : null}
            {field('rir', 'sessionRir', 'numeric')}
          </div>
          <div className="ct-session__set-actions">
            <label className="ct-session__field ct-session__field--kind">
              <span className="ct-training__label">{tTraining('sessionSetKind')}</span>
              <select className="ct-session__input" aria-describedby={`${set.id}-kind-help`} value={set.setKind} disabled={busy} onChange={(e) => onKind(e.target.value as SetKind)}>
                <option value={timed && set.setKind === 'timed' ? 'timed' : 'work'}>{tTraining(timed && set.setKind === 'timed' ? 'kindTimed' : 'kindWork')}</option>
                <option value="warmup">{tTraining('kindWarmup')}</option>
                <option value="drop">{tTraining('kindDrop')}</option>
                <option value="partial">{tTraining('kindPartial')}</option>
              </select>
            </label>
            <button type="button" className="ct-training__icon-button" aria-label={tTraining('sessionRemoveSet')} disabled={busy} onClick={onRemove}>
              <Icon icon={X} size="md" />
            </button>
            <button type="button" className="ct-session__validate" disabled={busy} onClick={validate}>
              {tTraining('sessionValidate')}
            </button>
          </div>
          <p id={`${set.id}-kind-help`} className="ct-training__muted">
            {tTraining('sessionKindHelp')}
          </p>
          {issue && (
            <p className="ct-training__error" role="alert">
              {issue}
            </p>
          )}
        </>
      )}
    </li>
  );
}
