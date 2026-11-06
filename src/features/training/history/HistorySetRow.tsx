import { Check } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { SET_KINDS, validateSetBounds, validateSetEntry, type SetEntry, type SetKind, type WorkoutSet } from '../../../domain/training';
import type { SetCorrection } from '../../../db/repositories/workoutRepository';
import { formatNumber, parseNumber, tTraining, type TrainingTextKey } from '../../../i18n/trainingText';
import { Icon } from '../../../ui';

/**
 * Une série d'une séance close dans le journal (I1-03) : type, valeurs, RIR et état écrits en toutes lettres (« Validée », « Non validée »,
 * « corrigée » : jamais la couleur seule). « Corriger » ouvre la saisie de la charge, des répétitions (ou de la durée), du RIR et du type ;
 * la saisie suit les règles du domaine avant tout envoi au repository. Champs à 17 px (pas de zoom iOS), Entrée enregistre, Échap annule.
 */

const KIND_TEXT: Record<SetKind, TrainingTextKey> = {
  work: 'kindWork',
  warmup: 'kindWarmup',
  drop: 'kindDrop',
  partial: 'kindPartial',
  timed: 'kindTimed',
};

interface Draft {
  readonly kind: SetKind;
  readonly load: string;
  readonly reps: string;
  readonly duration: string;
  readonly rir: string;
}

const text = (n: number | null): string => (n === null ? '' : formatNumber(n));

export function valueText(set: WorkoutSet): string {
  const { loadKg, reps, durationSec } = set;
  if (reps === null && durationSec !== null)
    return loadKg === null ? tTraining('sessionDoneDuration', { n: durationSec }) : tTraining('sessionDoneLoadDuration', { load: formatNumber(loadKg), n: durationSec });
  if (reps === null) return loadKg === null ? '—' : tTraining('kg', { n: formatNumber(loadKg) });
  return loadKg === null ? tTraining('sessionDoneReps', { reps }) : tTraining('sessionDoneLoad', { load: formatNumber(loadKg), reps });
}

export interface HistorySetRowProps {
  readonly set: WorkoutSet;
  /** Rang parmi les séries hors échauffement de l'exercice. */
  readonly number: number;
  /** Exercice mesuré en durée (bibliothèque) : la saisie porte sur la durée. */
  readonly timedExercise: boolean;
  readonly busy: boolean;
  readonly onCorrect: (patch: SetCorrection) => Promise<boolean>;
}

export function HistorySetRow({ set, number, timedExercise, busy, onCorrect }: HistorySetRowProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const label = set.setKind === 'warmup' ? tTraining('sessionWarmupSet') : tTraining('sessionSet', { n: number });
  const corrected = set.correctedAt !== undefined && set.correctedAt !== null;

  const open = (): void => {
    setIssue(null);
    setDraft({ kind: set.setKind, load: text(set.loadKg), reps: text(set.reps), duration: text(set.durationSec), rir: text(set.rir) });
  };
  const cancel = (): void => {
    setIssue(null);
    setDraft(null);
  };

  async function save(current: Draft): Promise<void> {
    const timed = current.kind === 'timed' || timedExercise;
    const fields = [current.load, timed ? current.duration : current.reps, current.rir];
    if (fields.some((f) => f.trim() !== '' && parseNumber(f) === null)) {
      setIssue(tTraining('sessionErrorValues'));
      return;
    }
    // Les répétitions (ou la durée) non saisies dans ce formulaire gardent leur valeur.
    const entry: SetEntry = {
      loadKg: parseNumber(current.load),
      reps: timed ? set.reps : parseNumber(current.reps),
      durationSec: timed ? parseNumber(current.duration) : set.durationSec,
      rir: parseNumber(current.rir),
    };
    const issues = set.done ? validateSetEntry(entry, current.kind) : validateSetBounds(entry);
    if (issues.length > 0) {
      setIssue(tTraining(issues.includes('empty') ? 'sessionErrorEmpty' : issues.length === 1 && issues[0] === 'duration' && entry.durationSec === null ? 'sessionErrorDuration' : 'sessionErrorValues'));
      return;
    }
    setIssue(null);
    const patch: SetCorrection = timed
      ? { setKind: current.kind, loadKg: entry.loadKg, durationSec: entry.durationSec, rir: entry.rir }
      : { setKind: current.kind, loadKg: entry.loadKg, reps: entry.reps, rir: entry.rir };
    if (await onCorrect(patch)) setDraft(null);
  }

  const onKey = (event: KeyboardEvent<HTMLElement>): void => {
    if (!draft) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
    } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      if (!busy) void save(draft);
    }
  };

  const field = (key: 'load' | 'reps' | 'duration' | 'rir', labelKey: TrainingTextKey, mode: 'decimal' | 'numeric') => (
    <label className="ct-session__field">
      <span className="ct-training__label">{tTraining(labelKey)}</span>
      <input
        className="ct-session__input"
        inputMode={mode}
        enterKeyHint="done"
        autoComplete="off"
        value={draft?.[key] ?? ''}
        onChange={(e) => setDraft((now) => (now ? { ...now, [key]: e.target.value } : now))}
      />
    </label>
  );

  return (
    <li className={set.done ? 'ct-session__set ct-session__set--done' : 'ct-session__set'} role="group" aria-label={label} onKeyDown={onKey}>
      <div className="ct-session__set-head">
        <span className="ct-session__set-mark ct-session__num" aria-hidden="true">
          {set.setKind === 'warmup' ? tTraining('sessionWarmupMark') : number}
        </span>
        <span className="ct-session__set-target">{tTraining(KIND_TEXT[set.setKind])}</span>
        {corrected ? <span className="ct-session__state ct-history__corrected">{tTraining('historyCorrected')}</span> : null}
        <span className={set.done ? 'ct-session__state ct-session__state--done' : 'ct-session__state'}>
          {set.done ? <Icon icon={Check} size={16} /> : null}
          {tTraining(set.done ? 'sessionDone' : 'historyNotDone')}
        </span>
      </div>
      {draft === null ? (
        <div className="ct-session__set-body">
          <span className="ct-session__done-value ct-session__num">{valueText(set)}</span>
          {set.rir !== null ? <span className="ct-session__muted">{tTraining('sessionDoneRir', { n: set.rir })}</span> : null}
          <button type="button" className="ct-training__link" disabled={busy} onClick={open}>
            {tTraining('historyCorrect')}
          </button>
        </div>
      ) : (
        <>
          <div className="ct-session__fields">
            {field('load', 'sessionLoad', 'decimal')}
            {draft.kind === 'timed' || timedExercise ? field('duration', 'sessionDuration', 'numeric') : field('reps', 'sessionReps', 'numeric')}
            {field('rir', 'sessionRir', 'numeric')}
          </div>
          <div className="ct-session__set-actions">
            <label className="ct-session__field ct-session__field--kind">
              <span className="ct-training__label">{tTraining('sessionSetKind')}</span>
              <select className="ct-session__input" value={draft.kind} disabled={busy} onChange={(e) => setDraft((now) => (now ? { ...now, kind: e.target.value as SetKind } : now))}>
                {SET_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {tTraining(KIND_TEXT[kind])}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="ct-session__validate" disabled={busy} onClick={() => void save(draft)}>
              {tTraining('historyCorrectSave')}
            </button>
            <button type="button" className="ct-training__link" disabled={busy} onClick={cancel}>
              {tTraining('cancel')}
            </button>
          </div>
          {issue ? (
            <p className="ct-training__error" role="alert">
              {issue}
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}
