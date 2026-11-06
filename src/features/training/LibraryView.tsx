import { ArrowLeft } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  EXERCISE_KINDS,
  EXERCISE_METRICS,
  EXERCISE_PATTERNS,
  isExerciseCompatible,
  resolveExercise,
  usableEquipment,
  validateCustomExercise,
  type CustomExercise,
  type CustomExerciseInput,
  type Exercise,
  type ExerciseKind,
  type ExerciseMetric,
  type ExercisePattern,
} from '../../domain/training';
import type { IdGenerator } from '../../domain/id';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { RepositoryError } from '../../db/repositories/common';
import { formatNumber, formatRest, parseNumber, tTraining } from '../../i18n/trainingText';
import { Button, ConfirmDialog, Icon, Switch } from '../../ui';
import { groupLabel, KIND_KEY, METRIC_KEY, PATTERN_KEY } from './labels';
import { exerciseGroup, normalizeSearch, type TrainingData } from './trainingState';

// -----------------------------------------------------------------------------------------------------------------------------------
// Liste filtrable (bibliothèque et choix d'un exercice pour une routine)
// -----------------------------------------------------------------------------------------------------------------------------------

export interface ExerciseListProps {
  readonly data: TrainingData;
  /** `picker` : seuls les exercices compatibles avec le profil actif (critère 4), sans bascule. */
  readonly mode: 'library' | 'picker';
  readonly onSelect: (exercise: Exercise) => void;
}

export function ExerciseList({ data, mode, onSelect }: ExerciseListProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [compatibleOnly, setCompatibleOnly] = useState(true);
  const filterId = useId();
  const listId = useId();
  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    const usable = mode === 'picker' || compatibleOnly ? data.active : null;
    return data.exercises
      .filter((e) => (usable ? isExerciseCompatible(e, usable) : true))
      .filter((e) => group === '' || exerciseGroup(e, data.content) === group)
      .filter((e) => q === '' || normalizeSearch(e.nameFr).includes(q) || e.aliasesEn.some((a) => normalizeSearch(a).includes(q)));
  }, [data, query, group, compatibleOnly, mode]);

  return (
    <div className="ct-training__list-block">
      <div className="ct-training__filters">
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('search')}</span>
          <input className="ct-training__input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
        <label className="ct-training__field" htmlFor={filterId}>
          <span className="ct-training__label">{tTraining('groupFilter')}</span>
          <select id={filterId} className="ct-training__input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{tTraining('groupAll')}</option>
            {data.content.groups.map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)}
              </option>
            ))}
          </select>
        </label>
        {mode === 'library' ? (
          <div className="ct-training__switch-row">
            <span>
              {tTraining('compatibleOnly')}
              <span className="ct-training__muted"> · {tTraining('compatibleWith', { name: data.active.name })}</span>
            </span>
            <Switch checked={compatibleOnly} onChange={setCompatibleOnly} label={tTraining('compatibleOnly')} />
          </div>
        ) : (
          <p className="ct-training__muted">{tTraining('pickerHint')}</p>
        )}
      </div>
      <p className="ct-training__muted" aria-live="polite">
        {filtered.length === 1 ? tTraining('countOne') : tTraining('countMany', { n: filtered.length })}
      </p>
      {filtered.length === 0 ? (
        <p className="ct-training__empty">{tTraining('noMatch')}</p>
      ) : (
        <ul className="ct-training__rows" id={listId}>
          {filtered.map((exercise) => {
            const metaId = `${listId}-${exercise.id}`;
            const g = exerciseGroup(exercise, data.content);
            const compatible = isExerciseCompatible(exercise, data.active);
            return (
              <li key={exercise.id}>
                <button type="button" className="ct-training__row" aria-label={exercise.nameFr} aria-describedby={metaId} onClick={() => onSelect(exercise)}>
                  <span className="ct-training__row-name">{exercise.nameFr}</span>
                  <span className="ct-training__row-meta" id={metaId}>
                    {[g === null ? null : groupLabel(g), exercise.origin === 'custom' ? tTraining('custom') : null, compatible ? null : tTraining('compatibleNo')].filter((s) => s !== null).join(' · ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Fiche d'un exercice (sans média : aucun visuel, jamais d'icône cassée, D-71)
// -----------------------------------------------------------------------------------------------------------------------------------

function repText(exercise: Exercise): string {
  const [min, max] = exercise.defaultRepRange;
  if (exercise.metric === 'time') return min === max ? tTraining('durationSame', { min }) : tTraining('durationRange', { min, max });
  return min === max ? tTraining('repRangeSame', { min }) : tTraining('repRange', { min, max });
}

interface DetailProps {
  readonly data: TrainingData;
  readonly exercise: Exercise;
  readonly onBack: () => void;
  readonly onOpen: (exercise: Exercise) => void;
  readonly onEdit: (exercise: CustomExercise) => void;
  readonly onDelete: (exercise: CustomExercise) => void;
}

function ExerciseDetail({ data, exercise, onBack, onOpen, onEdit, onDelete }: DetailProps) {
  const muscleName = new Map(data.content.muscles.map((m) => [m.id, m.nameFr]));
  const equipmentName = new Map(data.content.equipment.map((e) => [e.id, e.nameFr]));
  const compatible = isExerciseCompatible(exercise, data.active);
  const usable = usableEquipment(data.active);
  const missing = compatible ? [] : exercise.equipment.filter((id) => !usable.has(id));
  const alternatives = exercise.origin === 'embedded' ? (exercise.alternatives ?? []) : [];
  return (
    <article className="ct-training__detail" aria-labelledby={`ct-ex-${exercise.id}`}>
      <button type="button" className="ct-training__back" onClick={onBack}>
        <Icon icon={ArrowLeft} size={20} />
        <span>{tTraining('backToLibrary')}</span>
      </button>
      <h2 id={`ct-ex-${exercise.id}`} className="ct-training__heading">
        {exercise.nameFr}
      </h2>
      <p className="ct-training__muted">
        {[tTraining(PATTERN_KEY[exercise.pattern]), tTraining(KIND_KEY[exercise.kind]), tTraining(METRIC_KEY[exercise.metric])].join(' · ')}
        {exercise.origin === 'custom' ? <span className="ct-training__badge">{tTraining('custom')}</span> : null}
      </p>
      <div className="ct-training__facts">
        <span className="ct-training__fact">{repText(exercise)}</span>
        <span className="ct-training__fact">{tTraining('rest', { time: formatRest(exercise.defaultRestSec) })}</span>
      </div>
      <p className="ct-training__note" data-ok={compatible}>
        {compatible ? tTraining('compatibleYes') : tTraining('compatibleNo')}
        {missing.length > 0 ? ` : ${missing.map((id) => equipmentName.get(id) ?? id).join(', ')}` : ''}
      </p>
      <section className="ct-training__card">
        <h3 className="ct-training__eyebrow">{tTraining('muscles')}</h3>
        <ul className="ct-training__plain">
          {exercise.muscles.map((m) => (
            <li key={m.id}>
              {muscleName.get(m.id) ?? m.id} · <span className="ct-training__num">{formatNumber(m.weight)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="ct-training__card">
        <h3 className="ct-training__eyebrow">{tTraining('equipment')}</h3>
        <p>{exercise.equipment.length === 0 ? tTraining('noEquipment') : exercise.equipment.map((id) => equipmentName.get(id) ?? id).join(', ')}</p>
      </section>
      {exercise.instructions.setup !== '' || exercise.instructions.execution !== '' || exercise.instructions.mistakes.length > 0 ? (
        <section className="ct-training__card">
          <h3 className="ct-training__eyebrow">{tTraining('instructions')}</h3>
          {exercise.instructions.setup !== '' && (
            <>
              <h4 className="ct-training__subheading">{tTraining('setup')}</h4>
              <p>{exercise.instructions.setup}</p>
            </>
          )}
          {exercise.instructions.execution !== '' && (
            <>
              <h4 className="ct-training__subheading">{tTraining('execution')}</h4>
              <p>{exercise.instructions.execution}</p>
            </>
          )}
          {exercise.instructions.mistakes.length > 0 && (
            <>
              <h4 className="ct-training__subheading">{tTraining('mistakes')}</h4>
              <ul>
                {exercise.instructions.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}
      {alternatives.length > 0 && (
        <section className="ct-training__card">
          <h3 className="ct-training__eyebrow">{tTraining('alternatives')}</h3>
          <ul className="ct-training__plain">
            {alternatives.map((id) => {
              const resolved = resolveExercise({ id }, data.content.catalog, data.allCustoms);
              return (
                <li key={id}>
                  {resolved.exercise ? (
                    <button type="button" className="ct-training__link" onClick={() => onOpen(resolved.exercise)}>
                      {resolved.name}
                    </button>
                  ) : (
                    <span>
                      {resolved.name} <span className="ct-training__muted">({tTraining('unknownExercise')})</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {exercise.origin === 'custom' && (
        <div className="ct-training__actions">
          <Button variant="secondary" onClick={() => onEdit(exercise)}>
            {tTraining('edit')}
          </Button>
          <Button variant="danger" onClick={() => onDelete(exercise)}>
            {tTraining('delete')}
          </Button>
        </div>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Exercice personnalisé : création et modification (UUID généré, collision refusée par le repository, D-71)
// -----------------------------------------------------------------------------------------------------------------------------------

interface FormProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly ids: IdGenerator;
  readonly initial: CustomExercise | null;
  readonly onSaved: (exercise: CustomExercise) => void;
  readonly onCancel: () => void;
}

function CustomExerciseForm({ data, access, ids, initial, onSaved, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.nameFr ?? '');
  const [aliases, setAliases] = useState(initial?.aliasesEn.join(', ') ?? '');
  const [muscle, setMuscle] = useState(initial?.muscles[0]?.id ?? data.content.muscles[0]?.id ?? 'chest');
  const [pattern, setPattern] = useState<ExercisePattern>(initial?.pattern ?? 'isolation');
  const [kind, setKind] = useState<ExerciseKind>(initial?.kind ?? 'isolation');
  const [metric, setMetric] = useState<ExerciseMetric>(initial?.metric ?? 'load-reps');
  const [repMin, setRepMin] = useState(String(initial?.defaultRepRange[0] ?? 8));
  const [repMax, setRepMax] = useState(String(initial?.defaultRepRange[1] ?? 12));
  const [rest, setRest] = useState(String(initial?.defaultRestSec ?? 90));
  const [equipment, setEquipment] = useState<readonly string[]>(initial?.equipment ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    const min = parseNumber(repMin);
    const max = parseNumber(repMax);
    const restSec = parseNumber(rest);
    const others = initial?.muscles.slice(1).filter((m) => m.id !== muscle) ?? [];
    const input: CustomExerciseInput = {
      id: initial?.id ?? ids.next(),
      nameFr: name.trim(),
      aliasesEn: aliases
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a !== ''),
      muscles: [{ id: muscle, weight: 1 }, ...others],
      equipment,
      pattern,
      kind,
      metric,
      bodyweightFraction: initial?.bodyweightFraction ?? null,
      defaultRepRange: [min ?? Number.NaN, max ?? Number.NaN],
      defaultRestSec: restSec ?? Number.NaN,
      instructions: initial?.instructions ?? { setup: '', execution: '', mistakes: [] },
      media: null,
      strengthStandardKey: null,
    };
    const issues = validateCustomExercise(input).map((i) => i.code);
    if (issues.length > 0) {
      setError(issues.includes('name') ? tTraining('errorName') : issues.includes('rep-range') ? tTraining('errorRepRange') : issues.includes('rest') ? tTraining('errorRest') : tTraining('errorExercise'));
      return;
    }
    setBusy(true);
    try {
      const repo = await access.repos.exercises();
      const { id, ...patch } = input;
      onSaved(initial ? await repo.update(id, patch) : await repo.create(input));
    } catch (failure) {
      setError(failure instanceof RepositoryError && failure.code === 'conflict' ? tTraining('errorCollision') : tTraining('saveError'));
    } finally {
      setBusy(false);
    }
  }

  const toggleEquipment = (id: string, on: boolean): void => setEquipment((now) => (on ? [...now.filter((e) => e !== id), id] : now.filter((e) => e !== id)));

  return (
    <form
      className="ct-training__form"
      aria-labelledby="ct-custom-title"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 id="ct-custom-title" className="ct-training__heading">
        {initial ? tTraining('customTitleEdit') : tTraining('customTitleNew')}
      </h2>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('name')}</span>
        <input className="ct-training__input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('aliases')}</span>
        <input className="ct-training__input" value={aliases} onChange={(e) => setAliases(e.target.value)} />
      </label>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('primaryMuscle')}</span>
        <select className="ct-training__input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {data.content.muscles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nameFr}
            </option>
          ))}
        </select>
      </label>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('pattern')}</span>
        <select className="ct-training__input" value={pattern} onChange={(e) => setPattern(e.target.value as ExercisePattern)}>
          {EXERCISE_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {tTraining(PATTERN_KEY[p])}
            </option>
          ))}
        </select>
      </label>
      <div className="ct-training__grid2">
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('kind')}</span>
          <select className="ct-training__input" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            {EXERCISE_KINDS.map((k) => (
              <option key={k} value={k}>
                {tTraining(KIND_KEY[k])}
              </option>
            ))}
          </select>
        </label>
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('metric')}</span>
          <select className="ct-training__input" value={metric} onChange={(e) => setMetric(e.target.value as ExerciseMetric)}>
            {EXERCISE_METRICS.map((m) => (
              <option key={m} value={m}>
                {tTraining(METRIC_KEY[m])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ct-training__grid3">
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('repMin')}</span>
          <input className="ct-training__input ct-training__num" inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
        </label>
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('repMax')}</span>
          <input className="ct-training__input ct-training__num" inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
        </label>
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('restSec')}</span>
          <input className="ct-training__input ct-training__num" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
        </label>
      </div>
      <fieldset className="ct-training__fieldset">
        <legend className="ct-training__label">{tTraining('equipmentNeeded')}</legend>
        <div className="ct-training__checks">
          {data.content.equipment.map((item) => (
            <label key={item.id} className="ct-training__check">
              <input type="checkbox" checked={equipment.includes(item.id)} onChange={(e) => toggleEquipment(item.id, e.target.checked)} />
              <span>{item.nameFr}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      <div className="ct-training__actions">
        <Button type="submit" disabled={busy}>
          {tTraining('saveExercise')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {tTraining('cancel')}
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Écran Bibliothèque
// -----------------------------------------------------------------------------------------------------------------------------------

type View = { readonly kind: 'list' } | { readonly kind: 'detail'; readonly id: string } | { readonly kind: 'form'; readonly id: string | null };

export interface LibraryViewProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly ids: IdGenerator;
  readonly reload: () => Promise<void>;
}

export function LibraryView({ data, access, ids, reload }: LibraryViewProps) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [confirm, setConfirm] = useState<CustomExercise | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const find = (id: string): Exercise | null => data.content.catalog.get(id) ?? data.customs.find((c) => c.id === id) ?? null;

  if (view.kind === 'form') {
    const initial = view.id === null ? null : (data.customs.find((c) => c.id === view.id) ?? null);
    return (
      <CustomExerciseForm
        data={data}
        access={access}
        ids={ids}
        initial={initial}
        onCancel={() => setView(initial ? { kind: 'detail', id: initial.id } : { kind: 'list' })}
        onSaved={(saved) => {
          void reload().then(() => {
            setMessage(tTraining('exerciseSaved'));
            setView({ kind: 'detail', id: saved.id });
          });
        }}
      />
    );
  }

  const shown = view.kind === 'detail' ? find(view.id) : null;
  return (
    <div className="ct-training__library">
      {message && (
        <p className="ct-training__message" role="status">
          {message}
        </p>
      )}
      {shown ? (
        <ExerciseDetail
          data={data}
          exercise={shown}
          onBack={() => {
            setMessage(null);
            setView({ kind: 'list' });
          }}
          onOpen={(e) => setView({ kind: 'detail', id: e.id })}
          onEdit={(e) => setView({ kind: 'form', id: e.id })}
          onDelete={setConfirm}
        />
      ) : (
        <>
          <div className="ct-training__actions">
            <Button
              variant="secondary"
              onClick={() => {
                setMessage(null);
                setView({ kind: 'form', id: null });
              }}
            >
              {tTraining('newExercise')}
            </Button>
          </div>
          <ExerciseList data={data} mode="library" onSelect={(e) => setView({ kind: 'detail', id: e.id })} />
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={tTraining('deleteExerciseTitle', { name: confirm.nameFr })}
          description={tTraining('deleteExerciseHint')}
          confirmLabel={tTraining('delete')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const target = confirm;
            setConfirm(null);
            void (async () => {
              try {
                await (await access.repos.exercises()).softDelete(target.id);
                await reload();
                setMessage(tTraining('exerciseDeleted'));
                setView({ kind: 'list' });
              } catch {
                setMessage(tTraining('saveError'));
              }
            })();
          }}
        />
      )}
    </div>
  );
}
