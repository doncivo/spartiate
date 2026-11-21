import { useEffect, useMemo, useRef, useState } from 'react';
import { importedRoutineSpec, matchExerciseName, parseProgramText, type ImportMatch, type ImportedExercise, type ProgramImport } from '../../../domain/training/programImport';
import { validateRoutine } from '../../../domain/training/routineRules';
import type { Exercise, RoutineInput } from '../../../domain/training';
import type { IdGenerator } from '../../../domain/id';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { tPlural } from '../../../i18n/plural';
import { tImport } from '../../../i18n/programImportText';
import { Button } from '../../../ui';
import { ExerciseList } from '../LibraryView';
import type { TrainingData } from '../trainingState';
import { PhotoReader, type PhotoReaderProps } from './PhotoReader';
import './ProgramImport.css';

/**
 * Import d'un programme (IMPORT-029, § 17.4) : texte collé ou lu sur une photo → analyse pure (`parseProgramText`) → aperçu complet
 * (séances, exercices rapprochés de la bibliothèque, séries, plage, RIR, lignes non reconnues) → « Créer la routine » : une routine Libre
 * écrite en une transaction par le repository des routines. Rien n'est écrit avant la confirmation. Bloc à la demande (hors du départ).
 */

export interface ProgramImportViewProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly ids: IdGenerator;
  readonly onClose: () => void;
  /** Routine créée : l'appelant rafraîchit la liste et ouvre l'éditeur avec le message. */
  readonly onCreated: (routineId: string, message: string) => Promise<void>;
  /** IMPORT-029b : moteurs de lecture d'image (façade OCR) ; par défaut ceux de l'appareil. */
  readonly ocr?: PhotoReaderProps['open'];
}

interface Pick {
  /** Identifiant de l'exercice de la bibliothèque choisi ; null : à choisir. */
  readonly exerciseId: string | null;
  readonly removed: boolean;
}

const keyOf = (session: number, exercise: number): string => `${session}:${exercise}`;
const percent = (score: number): number => Math.round(score * 100);

function schemeText(exercise: ImportedExercise): string {
  const reps = exercise.repsMin === exercise.repsMax ? String(exercise.repsMin) : `${exercise.repsMin}–${exercise.repsMax}`;
  return tImport(exercise.notes.some((n) => n.code === 'seconds') ? 'schemeSeconds' : 'scheme', { sets: exercise.sets, reps });
}

export function ProgramImportView({ data, access, ids, onClose, onCreated, ocr }: ProgramImportViewProps) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ProgramImport | null>(null);
  const [name, setName] = useState('');
  const [picks, setPicks] = useState<ReadonlyMap<string, Pick>>(new Map());
  const [picking, setPicking] = useState<{ readonly key: string; readonly name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  const byId = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data]);
  const matches = useMemo(() => {
    const out = new Map<string, ImportMatch>();
    if (!parsed) return out;
    const candidates = data.exercises.map((e) => ({ id: e.id, nameFr: e.nameFr, aliasesEn: e.aliasesEn }));
    parsed.sessions.forEach((session, s) => session.exercises.forEach((exercise, e) => out.set(keyOf(s, e), matchExerciseName(exercise.name, candidates))));
    return out;
  }, [parsed, data]);

  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (parsed && picking === null) previewHeading.current?.focus();
  }, [parsed, picking]);

  const analyze = (): void => {
    setError(null);
    if (text.trim() === '') {
      setMessage(tImport('emptyText'));
      return;
    }
    const result = parseProgramText(text);
    const candidates = data.exercises.map((e) => ({ id: e.id, nameFr: e.nameFr, aliasesEn: e.aliasesEn }));
    const initial = new Map<string, Pick>();
    result.sessions.forEach((session, s) =>
      session.exercises.forEach((exercise, e) => {
        const match = matchExerciseName(exercise.name, candidates);
        initial.set(keyOf(s, e), { exerciseId: match.level === 'sure' ? (match.choices[0]?.id ?? null) : null, removed: false });
      }),
    );
    setMessage(null);
    setPicks(initial);
    setName(result.name ?? tImport('defaultName'));
    setParsed(result);
  };

  const setPick = (key: string, patch: Partial<Pick>): void => {
    setPicks((current) => {
      const next = new Map(current);
      next.set(key, { exerciseId: null, removed: false, ...current.get(key), ...patch });
      return next;
    });
  };

  if (picking) {
    return (
      <section className="ct-training__picker" role="region" aria-label={tImport('pickerTitle', { name: picking.name })}>
        <Button variant="secondary" onClick={() => setPicking(null)}>
          {tImport('pickerCancel')}
        </Button>
        <h2 className="ct-training__eyebrow ct-section-title">{tImport('pickerTitle', { name: picking.name })}</h2>
        <ExerciseList
          data={data}
          mode="library"
          onSelect={(exercise: Exercise) => {
            setPick(picking.key, { exerciseId: exercise.id, removed: false });
            setPicking(null);
          }}
        />
      </section>
    );
  }

  const exerciseCount = parsed ? parsed.sessions.reduce((n, s) => n + s.exercises.length, 0) : 0;
  const active = [...picks.values()].filter((p) => !p.removed);
  const unresolved = active.filter((p) => p.exerciseId === null || !byId.has(p.exerciseId)).length;
  const blocked = unresolved > 0 ? tPlural(tImport, unresolved, 'blockedOne', 'blockedMany') : active.length === 0 ? tImport('blockedEmpty') : name.trim() === '' ? tImport('blockedName') : null;

  const create = async (): Promise<void> => {
    if (!parsed || blocked !== null) return;
    setBusy(true);
    setError(null);
    try {
      const routineName = name.trim();
      const spec = importedRoutineSpec(
        routineName,
        parsed.sessions,
        (s, e) => {
          const pick = picks.get(keyOf(s, e));
          const exercise = pick && !pick.removed && pick.exerciseId !== null ? byId.get(pick.exerciseId) : undefined;
          return exercise ? { exerciseId: exercise.id, exerciseName: exercise.nameFr, defaultRestSec: exercise.defaultRestSec } : null;
        },
        (index) => tImport('sessionN', { n: index + 1 }),
      );
      if (validateRoutine(spec).length > 0) throw new Error('routine importée invalide');
      const routine: RoutineInput = {
        id: ids.next(),
        name: spec.name,
        mode: spec.mode,
        days: spec.days.map((day) => ({ ...day, id: ids.next(), exercises: day.exercises.map((line) => ({ ...line, id: ids.next() })) })),
      };
      await access.transaction(async (repos) => (await repos.trainingRoutines()).create(routine));
      await onCreated(routine.id, tImport('created', { name: routineName }));
    } catch {
      setError(tImport('createError'));
      setBusy(false);
    }
  };

  return (
    <div className="ct-training__routines ct-import">
      <div className="ct-training__actions">
        <Button variant="secondary" onClick={onClose}>
          {tImport('back')}
        </Button>
      </div>
      <h2 ref={heading} tabIndex={-1} className="ct-training__eyebrow ct-section-title">
        {tImport('title')}
      </h2>
      {message && (
        <p className="ct-training__message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      {!parsed ? (
        <div className="ct-training__form">
          <p className="ct-training__muted">{tImport('intro')}</p>
          <p className="ct-training__muted">{tImport('guideHint')}</p>
          <label className="ct-training__field">
            <span className="ct-training__label">{tImport('textLabel')}</span>
            <textarea className="ct-training__input ct-import__text" rows={12} value={text} placeholder={tImport('textPlaceholder')} spellCheck={false} onChange={(e) => setText(e.target.value)} />
          </label>
          <PhotoReader
            {...(ocr ? { open: ocr } : {})}
            onLines={(lines) => setText((current) => (current.trim() === '' ? lines.join('\n') : `${current.replace(/\s+$/, '')}\n${lines.join('\n')}`))}
            onStatus={setMessage}
          />
          <p className="ct-training__muted">{tImport('privacy')}</p>
          <div className="ct-training__actions">
            <Button onClick={analyze}>{tImport('analyze')}</Button>
          </div>
        </div>
      ) : (
        <div className="ct-training__form">
          <h2 ref={previewHeading} tabIndex={-1} className="ct-training__eyebrow ct-section-title">
            {tImport('previewTitle')}
          </h2>
          <p className="ct-training__muted">{tImport('previewHint')}</p>
          {exerciseCount > 0 && (
            <label className="ct-training__field">
              <span className="ct-training__label">{tImport('routineName')}</span>
              <input className="ct-training__input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          {exerciseCount === 0 && <p className="ct-training__empty">{tImport('nothing')}</p>}
          {parsed.sessions.map((session, s) => (
            <section key={s} className="ct-import__session" aria-labelledby={`ct-import-session-${s}`}>
              <h3 id={`ct-import-session-${s}`} className="ct-training__subheading">
                {session.name ?? tImport('sessionN', { n: s + 1 })}
              </h3>
              {session.exercises.length === 0 && <p className="ct-training__muted">{tImport('emptySession')}</p>}
              <ul className="ct-training__cards">
                {session.exercises.map((exercise, e) => {
                  const key = keyOf(s, e);
                  const match = matches.get(key) ?? { level: 'none' as const, choices: [] };
                  const pick = picks.get(key) ?? { exerciseId: null, removed: false };
                  return (
                    <li key={key}>
                      <ExerciseCard
                        exercise={exercise}
                        match={match}
                        pick={pick}
                        chosen={pick.exerciseId === null ? null : (byId.get(pick.exerciseId) ?? null)}
                        groupName={`ct-import-${key}`}
                        onChoose={(id) => setPick(key, { exerciseId: id })}
                        onPick={() => setPicking({ key, name: exercise.name })}
                        onRemove={(removed) => setPick(key, { removed })}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {parsed.rejected.length > 0 && (
            <section className="ct-training__card ct-import__rejected" aria-labelledby="ct-import-rejected">
              <h3 id="ct-import-rejected" className="ct-training__subheading">
                {tImport('rejectedTitle', { n: parsed.rejected.length })}
              </h3>
              <p className="ct-training__muted">{tImport('rejectedHint')}</p>
              <ul className="ct-import__rejected-list">
                {parsed.rejected.map((line, index) => (
                  <li key={index}>
                    <span className="ct-import__rejected-text">{line.line === null ? tImport('rejectedBlock', { text: line.text }) : tImport('rejectedLine', { line: line.line, text: line.text })}</span>{' '}
                    <span className="ct-training__muted">{tImport(`reason_${line.reason}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="ct-training__actions">
            <Button variant="secondary" onClick={() => setParsed(null)}>
              {tImport('editText')}
            </Button>
            {exerciseCount > 0 && (
              <Button onClick={() => void create()} disabled={busy || blocked !== null}>
                {busy ? tImport('creating') : tImport('create')}
              </Button>
            )}
          </div>
          {exerciseCount > 0 && blocked !== null && (
            <p className="ct-training__warn" role="status">
              {blocked}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface ExerciseCardProps {
  readonly exercise: ImportedExercise;
  readonly match: ImportMatch;
  readonly pick: Pick;
  readonly chosen: Exercise | null;
  readonly groupName: string;
  readonly onChoose: (id: string) => void;
  readonly onPick: () => void;
  readonly onRemove: (removed: boolean) => void;
}

function ExerciseCard({ exercise, match, pick, chosen, groupName, onChoose, onPick, onRemove }: ExerciseCardProps) {
  const proposed = match.level === 'sure' ? match.choices[0] : undefined;
  const isProposed = proposed !== undefined && pick.exerciseId === proposed.id;
  const inChoices = match.level === 'doubt' && match.choices.some((c) => c.id === pick.exerciseId);
  const level = match.level === 'sure' ? 'levelSure' : match.level === 'doubt' ? 'levelDoubt' : 'levelNone';
  return (
    <fieldset className="ct-training__card ct-import__exercise" aria-label={tImport('exerciseGroup', { name: exercise.name })} data-removed={pick.removed ? 'true' : undefined}>
      <p className="ct-import__head">
        <span className={`ct-training__badge${match.level === 'sure' ? '' : ' ct-training__badge--warn'}`}>{tImport(level)}</span> <span>{tImport('readAs', { name: exercise.name })}</span>
      </p>
      <p className="ct-training__facts ct-training__num">
        <span>{schemeText(exercise)}</span>
        {exercise.rir !== null && <span>{tImport('rir', { rir: exercise.rir })}</span>}
        {exercise.restSec !== null && <span>{tImport('rest', { sec: exercise.restSec })}</span>}
      </p>
      {exercise.notes.map((note, index) => (
        <p key={index} className="ct-training__muted">
          {note.code === 'unread' ? tImport('note_unread', { text: note.text ?? '' }) : tImport(`note_${note.code}`)}
        </p>
      ))}
      {pick.removed ? (
        <p className="ct-training__muted">{tImport('removed')}</p>
      ) : (
        <>
          {isProposed && proposed && <p>{tImport('proposed', { name: proposed.nameFr, score: percent(proposed.score) })}</p>}
          {match.level === 'doubt' && (
            <fieldset className="ct-import__choices">
              <legend className="ct-training__label">{tImport('choicesLegend', { name: exercise.name })}</legend>
              {match.choices.map((choice) => (
                <label key={choice.id} className="ct-import__choice">
                  <input type="radio" name={groupName} checked={pick.exerciseId === choice.id} onChange={() => onChoose(choice.id)} />
                  <span>{tImport('choiceLabel', { name: choice.nameFr, score: percent(choice.score) })}</span>
                </label>
              ))}
            </fieldset>
          )}
          {chosen && !isProposed && !inChoices && <p>{tImport('chosen', { name: chosen.nameFr })}</p>}
          <div className="ct-training__actions">
            {match.level === 'sure' || chosen ? (
              <Button variant="secondary" onClick={onPick}>
                {match.level === 'doubt' ? tImport('pickOther') : tImport('change')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={onPick}>
                {match.level === 'doubt' ? tImport('pickOther') : tImport('pickLibrary')}
              </Button>
            )}
          </div>
        </>
      )}
      <div className="ct-training__actions">
        <Button variant="secondary" pressed={pick.removed} onClick={() => onRemove(!pick.removed)}>
          {pick.removed ? tImport('restore') : tImport('remove')}
        </Button>
      </div>
    </fieldset>
  );
}
