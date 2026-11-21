import { useCallback, useEffect, useState } from 'react';
import { todayLocal } from '../../../domain/clock';
import { EXERCISE_PATTERNS, type ExercisePattern } from '../../../domain/training';
import { declareInjury, markHealed, parseInjuries, type InjuriesValue, type Injury } from '../../../domain/training/injuries';
import { formatDayLabel } from '../../../i18n/format';
import { tInjuries } from '../../../i18n/injuriesText';
import { tTraining } from '../../../i18n/trainingText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { PATTERN_KEY } from '../../training/labels';
import { replanInjuryReminders } from './replan';
import '../BodyScreen.css';
import './Injuries.css';

interface MuscleOption {
  readonly id: string;
  readonly nameFr: string;
}

const EMPTY: InjuriesValue = { v: 1, items: [] };

/**
 * Profil › Blessures (BLESSURES-a) : déclarer une gêne (muscle du contenu, mouvements douloureux, date, note), la marquer guérie, lister les
 * actives et les passées. Données de santé : réglage local `training.injuries`, jamais synchronisé ni exporté. Bloc chargé à la demande avec ses
 * textes et le catalogue des muscles.
 */
export function InjuriesSection() {
  const container = useAppContainer();
  const { settings } = container.data.repos;
  const today = todayLocal(container.clock);
  const [value, setValue] = useState<InjuriesValue>(EMPTY);
  const [muscles, setMuscles] = useState<readonly MuscleOption[]>([]);
  const [muscleId, setMuscleId] = useState('');
  const [patterns, setPatterns] = useState<readonly ExercisePattern[]>([]);
  const [startedOn, setStartedOn] = useState<string>(today);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ readonly kind: 'ok' | 'error'; readonly text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void settings.get('training.injuries').then(
      (raw) => {
        if (live) setValue(parseInjuries(raw));
      },
      () => undefined,
    );
    void import('../../../../content/exercises/muscles.json').then(
      (m) => {
        const list = (m.default as { readonly muscles: readonly MuscleOption[] }).muscles;
        if (live) setMuscles([...list].sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr')));
      },
      () => {
        if (live) setMessage({ kind: 'error', text: tInjuries('errorMuscles') });
      },
    );
    return () => {
      live = false;
    };
  }, [settings]);

  const persist = useCallback(
    async (next: InjuriesValue): Promise<boolean> => {
      try {
        await settings.set('training.injuries', next);
        setValue(next);
        replanInjuryReminders(container);
        return true;
      } catch {
        setMessage({ kind: 'error', text: tInjuries('errorSave') });
        return false;
      }
    },
    [settings, container],
  );

  async function save(): Promise<void> {
    if (startedOn === '') {
      setMessage({ kind: 'error', text: tInjuries('errorDateRequired') });
      return;
    }
    const result = declareInjury(value, { id: String(container.ids.next()), muscleId: muscleId === '' ? null : muscleId, patterns, startedOn: startedOn as typeof today, note: note === '' ? null : note }, today);
    if (!result.ok) {
      const key = result.issue === 'target' ? 'errorTarget' : result.issue === 'date' ? 'errorDate' : result.issue === 'note' ? 'errorNote' : 'errorSave';
      setMessage({ kind: 'error', text: tInjuries(key) });
      return;
    }
    if (await persist(result.value)) {
      setMuscleId('');
      setPatterns([]);
      setNote('');
      setStartedOn(today);
      setMessage({ kind: 'ok', text: tInjuries('saved') });
    }
  }

  const nameOfMuscle = (id: string | null): string | null => (id === null ? null : (muscles.find((m) => m.id === id)?.nameFr ?? id));
  const label = (injury: Injury): string => {
    const parts = [nameOfMuscle(injury.muscleId), ...injury.patterns.map((p) => tTraining(PATTERN_KEY[p])), injury.note].filter((p): p is string => p !== null);
    return parts.join(' · ');
  };
  const active = value.items.filter((i) => i.status === 'active');
  const past = value.items.filter((i) => i.status === 'healed');

  return (
    <section className="ct-body__card ct-flat ct-injuries" aria-label={tInjuries('title')}>
      <h2 className="ct-body__section ct-section-title">{tInjuries('title')}</h2>
      <p className="ct-body__hint">{tInjuries('notice')}</p>
      <label className="ct-body__field">
        <span className="ct-body__label">{tInjuries('muscle')}</span>
        <select className="ct-body__input" value={muscleId} onChange={(e) => setMuscleId(e.target.value)}>
          <option value="">{tInjuries('muscleNone')}</option>
          {muscles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nameFr}
            </option>
          ))}
        </select>
      </label>
      <div className="ct-body__field" role="group" aria-label={tInjuries('painLabel')}>
        <span className="ct-body__label">{tInjuries('painLabel')}</span>
        <div className="ct-injuries__chips">
          {EXERCISE_PATTERNS.map((p) => (
            <button
              key={p}
              type="button"
              className="ct-injuries__chip"
              aria-pressed={patterns.includes(p)}
              aria-label={tInjuries('painToggle', { pattern: tTraining(PATTERN_KEY[p]) })}
              onClick={() => setPatterns((now) => (now.includes(p) ? now.filter((x) => x !== p) : [...now, p]))}
            >
              {tTraining(PATTERN_KEY[p])}
            </button>
          ))}
        </div>
      </div>
      <label className="ct-body__field ct-body__field--row">
        <span className="ct-body__label">{tInjuries('startedOn')}</span>
        <input className="ct-body__input" type="date" value={startedOn} max={today} onChange={(e) => setStartedOn(e.target.value)} />
      </label>
      <label className="ct-body__field">
        <span className="ct-body__label">{tInjuries('note')}</span>
        <input className="ct-body__input" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button variant="secondary" onClick={() => void save()}>
        {tInjuries('save')}
      </Button>
      {message && (
        <p className="ct-body__message" role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      {value.items.length === 0 ? <p className="ct-body__hint">{tInjuries('empty')}</p> : null}
      {active.length > 0 && (
        <>
          <h3 className="ct-body__label">{tInjuries('activeTitle')}</h3>
          <ul className="ct-body__list" aria-label={tInjuries('activeTitle')}>
            {active.map((i) => (
              <li key={i.id} className="ct-injuries__row">
                <span>
                  {label(i)} ({tInjuries('since', { date: formatDayLabel(i.startedOn) })})
                </span>
                <Button variant="secondary" onClick={() => void persist(markHealed(value, i.id, today))}>
                  {tInjuries('markHealed')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 className="ct-body__label">{tInjuries('pastTitle')}</h3>
          <ul className="ct-body__list" aria-label={tInjuries('pastTitle')}>
            {past.map((i) => (
              <li key={i.id} className="ct-injuries__row">
                <span>
                  {label(i)}
                  {i.healedOn !== null ? ` (${tInjuries('healedOn', { date: formatDayLabel(i.healedOn) })})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
