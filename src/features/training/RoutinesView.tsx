import { tPlural } from '../../i18n/plural';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import {
  dissolveLoneRoutineCircuits,
  groupRoutineLines,
  incompatibleRoutineLines,
  resolveExercise,
  routineCircuitsOf,
  ungroupRoutineLines,
  validateRoutine,
  type Exercise,
  type Routine,
  type RoutineCircuitLine,
  type RoutineGroupInput,
  type RoutineMode,
  type RoutineSpec,
  type RoutineTree,
} from '../../domain/training';
import type { IdGenerator } from '../../domain/id';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { parseNumber, tTraining } from '../../i18n/trainingText';
import { Button, ConfirmDialog, Icon, useLayout } from '../../ui';
import { programToRoutine, type StarterProgram } from './content';
import { ExerciseList } from './LibraryView';
import type { TrainingData } from './trainingState';

// I6-03b : groupes de la routine (en-tête et formulaire), bloc à la demande avec son catalogue de textes.
const RoutineCircuitHeader = lazy(() => import('./RoutineCircuitUi').then((m) => ({ default: m.RoutineCircuitHeader })));
const RoutineCircuitForm = lazy(() => import('./RoutineCircuitUi').then((m) => ({ default: m.RoutineCircuitForm })));

/**
 * Écran « Routines » (§ 14, § 12.5 ; maquettes iPhone-Routine, PC-Routine) : liste, programmes de départ (une transaction par ajout, noms
 * d'exercices figés), routine vide, édition (jours, exercices, séries, plage, repos, RIR facultatif, ordre), suppression. La saisie est validée
 * par `validateRoutine` ; un exercice non compatible avec le profil actif est signalé sans bloquer.
 */

interface DraftLine {
  readonly id: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly sets: string;
  readonly repMin: string;
  readonly repMax: string;
  readonly rir: string;
  readonly restSec: string;
  /** I6-03b : groupe (superset, triset, circuit) de la ligne ; null : ligne libre. */
  readonly circuitId: string | null;
  readonly circuitRestSec: number | null;
}
interface DraftDay {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly DraftLine[];
}
interface Draft {
  readonly id: string;
  readonly name: string;
  readonly mode: RoutineMode;
  readonly days: readonly DraftDay[];
}

const toDraft = (tree: RoutineTree): Draft => ({
  id: tree.id,
  name: tree.name,
  mode: tree.mode,
  days: tree.days.map((d) => ({
    id: d.id,
    name: d.name,
    lines: d.exercises.map((l) => ({
      id: l.id,
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName,
      sets: String(l.sets),
      repMin: String(l.repMin),
      repMax: String(l.repMax),
      rir: l.rir === null ? '' : String(l.rir),
      restSec: String(l.restSec),
      circuitId: l.circuitId ?? null,
      circuitRestSec: l.circuitRestSec ?? null,
    })),
  })),
});

/** Lignes du brouillon vues par les règles de groupe (saisie illisible : 1 série, repos 0 ; la validation de l'enregistrement la refusera). */
const circuitView = (lines: readonly DraftLine[]): (RoutineCircuitLine & { readonly name: string })[] =>
  lines.map((l, position) => {
    const sets = parseNumber(l.sets);
    const rest = parseNumber(l.restSec);
    return { id: l.id, exerciseId: l.exerciseId, name: l.exerciseName, sets: sets === null ? 1 : sets, restSec: rest === null ? 0 : rest, position, circuitId: l.circuitId, circuitRestSec: l.circuitRestSec };
  });
/** Reporte sur le brouillon le résultat d'une règle de groupe : ordre, groupe, et pour les lignes changées les séries et le repos. */
function applyCircuitLines(lines: readonly DraftLine[], next: readonly RoutineCircuitLine[]): DraftLine[] {
  const before = new Map(circuitView(lines).map((l) => [l.id, l]));
  return [...next]
    .sort((a, b) => a.position - b.position)
    .flatMap((n) => {
      const draft = lines.find((l) => l.id === n.id);
      const old = before.get(n.id);
      if (!draft || !old) return [];
      return [
        {
          ...draft,
          sets: old.sets === n.sets ? draft.sets : String(n.sets),
          restSec: old.restSec === n.restSec ? draft.restSec : String(n.restSec),
          circuitId: n.circuitId ?? null,
          circuitRestSec: n.circuitRestSec ?? null,
        },
      ];
    });
}

/** PROG-03 : liste avec l'élément `from` placé à l'indice `to` (ordre affiché ; hors bornes ou sans effet : la liste telle quelle). */
function moveItem<T>(list: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** PROG-03 : ce qui est en cours de glisser (un exercice d'un jour, ou un jour). */
type Dragging = { readonly kind: 'line'; readonly dayId: string; readonly index: number } | { readonly kind: 'day'; readonly index: number };

/** PROG-03 : Alt+↑ / Alt+↓ ; -1, 1, ou null pour toute autre touche. */
const altStep = (e: KeyboardEvent): -1 | 1 | null => (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ? null : e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : null);

const int = (text: string): number => {
  const n = parseNumber(text);
  return n === null ? Number.NaN : n;
};

/** Brouillon vers la spécification validée : ordre des jours à partir de 1, positions à partir de 0 (ordre affiché). */
const toSpec = (draft: Draft): RoutineSpec => ({
  name: draft.name.trim(),
  mode: draft.mode,
  days: draft.days.map((d, dayIndex) => ({
    name: d.name.trim(),
    dayOrder: dayIndex + 1,
    exercises: d.lines.map((l, position) => ({
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName,
      sets: int(l.sets),
      repMin: int(l.repMin),
      repMax: int(l.repMax),
      rir: l.rir.trim() === '' ? null : int(l.rir),
      restSec: int(l.restSec),
      position,
      circuitId: l.circuitId,
      circuitRestSec: l.circuitRestSec,
    })),
  })),
});

/** Écrit le brouillon dans une transaction : seules les différences avec l'arbre lu (ajouts, modifications, retraits). */
async function saveDraft(access: DataAccess, original: RoutineTree, draft: Draft, spec: RoutineSpec): Promise<void> {
  await access.transaction(async (repos) => {
    const repo = await repos.trainingRoutines();
    if (spec.name !== original.name) await repo.update(original.id, { name: spec.name });
    const keptDays = new Set(draft.days.map((d) => d.id));
    for (const day of original.days) if (!keptDays.has(day.id)) await repo.removeDay(day.id);
    for (const [index, day] of draft.days.entries()) {
      const daySpec = spec.days[index];
      if (!daySpec) continue;
      const before = original.days.find((d) => d.id === day.id);
      const lines = daySpec.exercises.map((l, i) => ({
        ...l,
        id: day.lines[i]?.id ?? '',
      }));
      if (!before) {
        await repo.addDay(original.id, {
          id: day.id,
          name: daySpec.name,
          dayOrder: daySpec.dayOrder,
          exercises: lines,
        });
        continue;
      }
      if (before.name !== daySpec.name || before.dayOrder !== daySpec.dayOrder)
        await repo.updateDay(day.id, {
          name: daySpec.name,
          dayOrder: daySpec.dayOrder,
        });
      const kept = new Set(lines.map((l) => l.id));
      for (const line of before.exercises) if (!kept.has(line.id)) await repo.removeExercise(line.id);
      for (const line of lines) {
        const old = before.exercises.find((l) => l.id === line.id);
        if (!old) {
          await repo.addExercise(day.id, line);
          continue;
        }
        const changed =
          old.sets !== line.sets ||
          old.repMin !== line.repMin ||
          old.repMax !== line.repMax ||
          old.rir !== line.rir ||
          old.restSec !== line.restSec ||
          old.position !== line.position;
        // I6-03b : le groupe n'est écrit que s'il change (capture champ par champ de la 0014).
        const circuitChanged = (old.circuitId ?? null) !== (line.circuitId ?? null) || (old.circuitRestSec ?? null) !== (line.circuitRestSec ?? null);
        if (changed || circuitChanged)
          await repo.updateExercise(line.id, {
            sets: line.sets,
            repMin: line.repMin,
            repMax: line.repMax,
            rir: line.rir,
            restSec: line.restSec,
            position: line.position,
            ...(circuitChanged ? { circuitId: line.circuitId ?? null, circuitRestSec: line.circuitRestSec ?? null } : {}),
          });
      }
    }
  });
}

function issueText(spec: RoutineSpec): string | null {
  const issue = validateRoutine(spec)[0];
  if (!issue) return null;
  if (issue.code === 'name-empty' || issue.code === 'mode') return tTraining('errorRoutineName');
  const day = issue.dayIndex === undefined ? undefined : spec.days[issue.dayIndex];
  if (issue.lineIndex !== undefined && day)
    return tTraining('errorLine', {
      name: day.exercises[issue.lineIndex]?.exerciseName ?? '',
    });
  return tTraining('errorDayName', { day: (issue.dayIndex ?? 0) + 1 });
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Éditeur
// -----------------------------------------------------------------------------------------------------------------------------------

interface EditorProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly ids: IdGenerator;
  readonly tree: RoutineTree;
  readonly initialMessage: string | null;
  /** Retour à la liste ; `message` : confirmation courte affichée sur la liste. */
  readonly onClose: (message?: string) => void;
  readonly onChanged: () => Promise<void>;
}

function NumberField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <label className="ct-training__field ct-training__field--small">
      <span className="ct-training__label">{label}</span>
      <input className="ct-training__input ct-training__num" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function RoutineEditor({ data, access, ids, tree, initialMessage, onClose, onChanged }: EditorProps) {
  const [original, setOriginal] = useState(tree);
  const [draft, setDraft] = useState<Draft>(() => toDraft(tree));
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  // Clavier et lecteur d'écran : le focus suit l'ouverture du choix d'un exercice (l'éditeur, masqué, garde le sien).
  const pickerHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (picking !== null) pickerHeading.current?.focus();
  }, [picking]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const allLines = draft.days.flatMap((d) => d.lines);
  const incompatible = new Set(incompatibleRoutineLines(allLines, data.active, data.content.catalog, data.allCustoms).map((l) => l.id));

  const updateDay = (dayId: string, change: (day: DraftDay) => DraftDay): void =>
    setDraft((now) => ({
      ...now,
      days: now.days.map((d) => (d.id === dayId ? change(d) : d)),
    }));
  const updateLine = (dayId: string, lineId: string, patch: Partial<DraftLine>): void =>
    updateDay(dayId, (d) => ({
      ...d,
      lines: d.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  // PROG-03 (§ 18.1, § 18.6) : l'ordre change dans le brouillon seulement ; l'enregistrement réécrit position et day_order par saveDraft, comme avant.
  // Sur PC, une poignée se glisse ou répond à Alt+↑/↓ ; partout, l'annonce polie dit la nouvelle position.
  const pc = useLayout() === 'pc';
  const [announce, setAnnounce] = useState('');
  const dragging = useRef<Dragging | null>(null);
  const refocus = useRef<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = refocus.current;
    if (id === null) return;
    refocus.current = null;
    const el = editorRef.current?.querySelector<HTMLElement>(`[data-reorder-handle="${id}"]`);
    if (el && document.activeElement !== el) el.focus();
  }, [draft]);
  const moveLine = (dayId: string, from: number, to: number, name: string, focusId?: string): void => {
    const day = draft.days.find((d) => d.id === dayId);
    if (!day || moveItem(day.lines, from, to) === day.lines) return;
    updateDay(dayId, (d) => ({ ...d, lines: [...moveItem(d.lines, from, to)] }));
    if (focusId) refocus.current = focusId;
    setAnnounce(tTraining('reorderMoved', { name, position: to + 1, total: day.lines.length }));
  };
  const moveDay = (from: number, to: number, focusId?: string): void => {
    const day = draft.days[from];
    if (!day || moveItem(draft.days, from, to) === draft.days) return;
    setDraft((now) => ({ ...now, days: [...moveItem(now.days, from, to)] }));
    if (focusId) refocus.current = focusId;
    setAnnounce(tTraining('reorderMoved', { name: day.name, position: to + 1, total: draft.days.length }));
  };
  const move = (dayId: string, index: number, step: -1 | 1, name: string): void => moveLine(dayId, index, index + step, name);
  const startDrag = (e: DragEvent, what: Dragging, id: string): void => {
    dragging.current = what;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  };
  const endDrag = (): void => {
    dragging.current = null;
  };
  /** Dépôt d'un exercice sur une ligne du même jour (un dépôt sur un autre jour, ou sans glisser en cours, est refusé). */
  const lineDropProps = (dayId: string, index: number) => ({
    onDragOver: (e: DragEvent) => {
      const now = dragging.current;
      if (now?.kind !== 'line' || now.dayId !== dayId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    },
    onDrop: (e: DragEvent) => {
      const now = dragging.current;
      if (now?.kind !== 'line' || now.dayId !== dayId) return;
      e.preventDefault();
      e.stopPropagation();
      dragging.current = null;
      const moved = draft.days.find((d) => d.id === dayId)?.lines[now.index];
      if (!moved) return;
      moveLine(dayId, now.index, index, resolveExercise({ id: moved.exerciseId, frozenName: moved.exerciseName }, data.content.catalog, data.allCustoms).name);
    },
  });
  /** Dépôt d'un jour sur un autre jour (n'importe où dans sa carte). */
  const dayDropProps = (index: number) => ({
    onDragOver: (e: DragEvent) => {
      const now = dragging.current;
      if (now?.kind !== 'day' || now.index === index) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    },
    onDrop: (e: DragEvent) => {
      const now = dragging.current;
      if (now?.kind !== 'day' || now.index === index) return;
      e.preventDefault();
      dragging.current = null;
      moveDay(now.index, index);
    },
  });
  const addLine = (dayId: string, exercise: Exercise): void => {
    const [min, max] = exercise.defaultRepRange;
    updateDay(dayId, (d) => ({
      ...d,
      lines: [
        ...d.lines,
        {
          id: ids.next(),
          exerciseId: exercise.id,
          exerciseName: exercise.nameFr,
          sets: '3',
          repMin: String(min),
          repMax: String(max),
          rir: '',
          restSec: String(exercise.defaultRestSec),
          circuitId: null,
          circuitRestSec: null,
        },
      ],
    }));
    setPicking(null);
  };
  // I6-03b : groupes du jour (brouillon) ; un seul formulaire ouvert à la fois.
  const [grouping, setGrouping] = useState<string | null>(null);
  const createGroup = (dayId: string, input: RoutineGroupInput): void => {
    updateDay(dayId, (d) => ({ ...d, lines: applyCircuitLines(d.lines, groupRoutineLines(circuitView(d.lines), input)) }));
    setGrouping(null);
  };
  const ungroup = (dayId: string, circuitId: string): void => updateDay(dayId, (d) => ({ ...d, lines: applyCircuitLines(d.lines, ungroupRoutineLines(circuitView(d.lines), circuitId)) }));
  const removeLine = (dayId: string, lineId: string): void =>
    updateDay(dayId, (d) => {
      const rest = d.lines.filter((l) => l.id !== lineId);
      return { ...d, lines: applyCircuitLines(rest, dissolveLoneRoutineCircuits(circuitView(rest))) };
    });

  async function save(): Promise<void> {
    setMessage(null);
    const spec = toSpec(draft);
    const problem = issueText(spec);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveDraft(access, original, draft, spec);
      const fresh = await (await access.repos.trainingRoutines()).get(original.id);
      if (fresh) {
        setOriginal(fresh);
        setDraft(toDraft(fresh));
      }
      await onChanged();
      onClose(tTraining('routineSaved'));
    } catch {
      setError(tTraining('saveError'));
    } finally {
      setBusy(false);
    }
  }

  // Le choix d'un exercice s'affiche à la place de l'éditeur, qui reste monté (saisie et position conservées).
  const pickingDay = picking === null ? null : (draft.days.find((d) => d.id === picking) ?? null);

  return (
    <>
      {pickingDay && (
        <section className="ct-training__picker" role="region" aria-label={tTraining('pickerTitle', { day: pickingDay.name })}>
          <button type="button" className="ct-training__back" onClick={() => setPicking(null)}>
            <Icon icon={ArrowLeft} size="md" />
            <span>{tTraining('cancel')}</span>
          </button>
          <h2 ref={pickerHeading} tabIndex={-1} className="ct-training__heading">
            {tTraining('pickerTitle', { day: pickingDay.name })}
          </h2>
          <ExerciseList data={data} mode="picker" onSelect={(exercise) => addLine(pickingDay.id, exercise)} />
        </section>
      )}
      <div ref={editorRef} className="ct-training__editor" hidden={pickingDay !== null}>
        <p className="ct-training__reorder-live ct-visually-hidden" aria-live="polite">
          {announce}
        </p>
        <button type="button" className="ct-training__back" onClick={() => onClose()}>
          <Icon icon={ArrowLeft} size="md" />
          <span>{tTraining('backToRoutines')}</span>
        </button>
        <h2 className="ct-training__heading">{tTraining('editRoutine')}</h2>
        {message && (
          <p className="ct-training__message" role="status">
            {message}
          </p>
        )}
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('routineName')}</span>
          <input className="ct-training__input" value={draft.name} maxLength={120} onChange={(e) => setDraft((now) => ({ ...now, name: e.target.value }))} />
        </label>
        {draft.days.map((day, dayIndex) => (
          <fieldset key={day.id} className="ct-training__day" role="group" aria-label={day.name} {...(pc ? dayDropProps(dayIndex) : {})}>
            {pc && (
              <button
                type="button"
                className="ct-training__drag-handle"
                draggable
                data-reorder-handle={day.id}
                aria-label={tTraining('reorderDayHandle', { name: day.name })}
                onDragStart={(e) => startDrag(e, { kind: 'day', index: dayIndex }, day.id)}
                onDragEnd={endDrag}
                onKeyDown={(e) => {
                  const step = altStep(e);
                  if (step === null) return;
                  e.preventDefault();
                  moveDay(dayIndex, dayIndex + step, day.id);
                }}
              >
                <Icon icon={GripVertical} size="md" />
              </button>
            )}
            <label className="ct-training__field">
              <span className="ct-training__label">{tTraining('dayName')}</span>
              <input className="ct-training__input" value={day.name} maxLength={120} onChange={(e) => updateDay(day.id, (d) => ({ ...d, name: e.target.value }))} />
            </label>
            {day.lines.length === 0 && <p className="ct-training__muted">{tTraining('emptyDay')}</p>}
            {routineCircuitsOf(circuitView(day.lines)).map((circuit) => (
              <Suspense key={circuit.circuitId} fallback={null}>
                <RoutineCircuitHeader circuit={circuit} names={circuit.lineIds.map((id) => day.lines.find((l) => l.id === id)?.exerciseName ?? '')} onUngroup={() => ungroup(day.id, circuit.circuitId)} />
              </Suspense>
            ))}
            {grouping === day.id && (
              <Suspense fallback={null}>
                <RoutineCircuitForm lines={circuitView(day.lines)} newId={() => ids.next()} onCreate={(input) => createGroup(day.id, input)} onCancel={() => setGrouping(null)} />
              </Suspense>
            )}
            <ol className="ct-training__lines">
              {day.lines.map((line, index) => {
                const resolved = resolveExercise({ id: line.exerciseId, frozenName: line.exerciseName }, data.content.catalog, data.allCustoms);
                return (
                  <li key={line.id} className="ct-training__line" role="group" aria-label={resolved.name} {...(pc ? lineDropProps(day.id, index) : {})}>
                    <div className="ct-training__line-head">
                      <span className="ct-training__row-name">{resolved.name}</span>
                      <span className="ct-training__line-tools">
                        {pc && (
                          <button
                            type="button"
                            className="ct-training__drag-handle"
                            draggable
                            data-reorder-handle={line.id}
                            aria-label={tTraining('reorderHandle', { name: resolved.name })}
                            onDragStart={(e) => startDrag(e, { kind: 'line', dayId: day.id, index }, line.id)}
                            onDragEnd={endDrag}
                            onKeyDown={(e) => {
                              const step = altStep(e);
                              if (step === null) return;
                              e.preventDefault();
                              moveLine(day.id, index, index + step, resolved.name, line.id);
                            }}
                          >
                            <Icon icon={GripVertical} size="md" />
                          </button>
                        )}
                        <button type="button" className="ct-training__icon-button" aria-label={tTraining('moveUp')} disabled={index === 0} onClick={() => move(day.id, index, -1, resolved.name)}>
                          <Icon icon={ArrowUp} size="md" />
                        </button>
                        <button
                          type="button"
                          className="ct-training__icon-button"
                          aria-label={tTraining('moveDown')}
                          disabled={index === day.lines.length - 1}
                          onClick={() => move(day.id, index, 1, resolved.name)}
                        >
                          <Icon icon={ArrowDown} size="md" />
                        </button>
                        <button
                          type="button"
                          className="ct-training__icon-button"
                          aria-label={tTraining('remove')}
                          onClick={() => removeLine(day.id, line.id)}
                        >
                          <Icon icon={X} size="md" />
                        </button>
                      </span>
                    </div>
                    {resolved.status === 'unknown' && <p className="ct-training__warn">{tTraining('unknownExercise')}</p>}
                    {incompatible.has(line.id) && <p className="ct-training__warn">{tTraining('compatibleNo')}</p>}
                    <div className="ct-training__line-fields">
                      <NumberField label={tTraining('sets')} value={line.sets} onChange={(v) => updateLine(day.id, line.id, { sets: v })} />
                      <NumberField label={tTraining('repMin')} value={line.repMin} onChange={(v) => updateLine(day.id, line.id, { repMin: v })} />
                      <NumberField label={tTraining('repMax')} value={line.repMax} onChange={(v) => updateLine(day.id, line.id, { repMax: v })} />
                      <NumberField label={tTraining('restSec')} value={line.restSec} onChange={(v) => updateLine(day.id, line.id, { restSec: v })} />
                      <NumberField label={tTraining('rir')} value={line.rir} onChange={(v) => updateLine(day.id, line.id, { rir: v })} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="ct-training__actions">
              <Button variant="secondary" onClick={() => setPicking(day.id)}>
                {tTraining('addExercise')}
              </Button>
              <Button variant="secondary" expanded={grouping === day.id} onClick={() => setGrouping((now) => (now === day.id ? null : day.id))}>
                {tTraining('sessionGroup')}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setDraft((now) => ({
                    ...now,
                    days: now.days.filter((d) => d.id !== day.id),
                  }))
                }
              >
                {tTraining('removeDay')}
              </Button>
            </div>
          </fieldset>
        ))}
        <div className="ct-training__actions">
          <Button
            variant="secondary"
            onClick={() =>
              setDraft((now) => ({
                ...now,
                days: [
                  ...now.days,
                  {
                    id: ids.next(),
                    name: tTraining('newDayName', { n: now.days.length + 1 }),
                    lines: [],
                  },
                ],
              }))
            }
          >
            {tTraining('addDay')}
          </Button>
        </div>
        {error && (
          <p className="ct-training__error" role="alert">
            {error}
          </p>
        )}
        <div className="ct-training__actions ct-training__actions--sticky">
          <Button disabled={busy} onClick={() => void save()}>
            {tTraining('saveRoutine')}
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {tTraining('deleteRoutine')}
          </Button>
        </div>
        {confirm && (
          <ConfirmDialog
            title={tTraining('deleteRoutineTitle', { name: original.name })}
            description={tTraining('deleteRoutineHint')}
            confirmLabel={tTraining('delete')}
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              void (async () => {
                try {
                  await access.transaction(async (repos) => (await repos.trainingRoutines()).softDelete(original.id));
                  await onChanged();
                  onClose();
                } catch {
                  setError(tTraining('saveError'));
                }
              })();
            }}
          />
        )}
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Liste et programmes de départ
// -----------------------------------------------------------------------------------------------------------------------------------

function ProgramCard({ data, program, onAdd }: { readonly data: TrainingData; readonly program: StarterProgram; readonly onAdd: () => void }) {
  const lines = program.days.flatMap((d) =>
    d.exercises.map((l) => ({
      exerciseId: l.exerciseId,
      exerciseName: data.content.catalog.get(l.exerciseId)?.nameFr ?? l.exerciseId,
    })),
  );
  const incompatible = new Set(incompatibleRoutineLines(lines, data.active, data.content.catalog, data.allCustoms).map((l) => l.exerciseId)).size;
  return (
    <li className="ct-training__card ct-flat">
      <h3 className="ct-training__subheading">{program.name}</h3>
      <p className="ct-training__muted">
        {program.audienceFr} · {tPlural(tTraining, program.days.length, 'programDaysOne', 'programDays')}
      </p>
      {incompatible > 0 && <p className="ct-training__warn">{tPlural(tTraining, incompatible, 'programIncompatibleOne', 'programIncompatible')}</p>}
      <Button variant="secondary" onClick={onAdd}>
        {tTraining('programAdd', { name: program.name })}
      </Button>
    </li>
  );
}

export interface RoutinesViewProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly ids: IdGenerator;
  readonly reload: () => Promise<void>;
}

export function RoutinesView({ data, access, ids, reload }: RoutinesViewProps) {
  const [routines, setRoutines] = useState<readonly Routine[] | null>(null);
  const [open, setOpen] = useState<{
    readonly tree: RoutineTree;
    readonly message: string | null;
  } | null>(null);
  const [programs, setPrograms] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    setRoutines(await (await access.repos.trainingRoutines()).list());
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await (await access.repos.trainingRoutines()).list();
        if (live) setRoutines(list);
      } catch {
        if (live) setError(tTraining('loadError'));
      }
    })();
    return () => {
      live = false;
    };
  }, [access, data]);

  const openTree = async (id: string, message: string | null): Promise<void> => {
    const tree = await (await access.repos.trainingRoutines()).get(id);
    if (tree) {
      setNotice(null);
      setOpen({ tree, message });
    }
  };

  const create = async (input: Parameters<typeof programToRoutine>[0] | null): Promise<void> => {
    setError(null);
    try {
      const routine = input
        ? programToRoutine(input, data.content.catalog, ids)
        : {
            id: ids.next(),
            name: tTraining('newRoutineName'),
            mode: 'libre' as const,
            days: [
              {
                id: ids.next(),
                name: tTraining('newDayName', { n: 1 }),
                dayOrder: 1,
                exercises: [],
              },
            ],
          };
      await access.transaction(async (repos) => (await repos.trainingRoutines()).create(routine));
      await refresh();
      setPrograms(false);
      await openTree(routine.id, input ? tTraining('programAdded', { name: input.name }) : null);
    } catch {
      setError(tTraining('saveError'));
    }
  };

  if (open) {
    return (
      <RoutineEditor
        key={open.tree.id}
        data={data}
        access={access}
        ids={ids}
        tree={open.tree}
        initialMessage={open.message}
        onClose={(message) => {
          setOpen(null);
          setNotice(message ?? null);
        }}
        onChanged={async () => {
          await refresh();
          await reload();
        }}
      />
    );
  }

  return (
    <div className="ct-training__routines">
      <div className="ct-training__actions">
        <Button onClick={() => void create(null)}>{tTraining('newRoutine')}</Button>
        <Button variant="secondary" expanded={programs} onClick={() => setPrograms((v) => !v)}>
          {tTraining('addProgram')}
        </Button>
      </div>
      {notice && (
        <p className="ct-training__message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      {programs && (
        <section aria-labelledby="ct-programs-title">
          <h2 id="ct-programs-title" className="ct-training__eyebrow ct-section-title">
            {tTraining('programsTitle')}
          </h2>
          <p className="ct-training__muted">{tTraining('programsHint')}</p>
          <ul className="ct-training__cards">
            {data.content.programs.map((program) => (
              <ProgramCard key={program.id} data={data} program={program} onAdd={() => void create(program)} />
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="ct-routines-title">
        <h2 id="ct-routines-title" className="ct-training__eyebrow ct-section-title">
          {tTraining('routines')}
        </h2>
        {routines !== null && routines.length === 0 && <p className="ct-training__empty">{tTraining('noRoutines')}</p>}
        <ul className="ct-training__rows">
          {(routines ?? []).map((routine) => (
            <li key={routine.id}>
              <button type="button" className="ct-training__row" onClick={() => void openTree(routine.id, null)}>
                <span className="ct-training__row-name">{routine.name}</span>
                <span className="ct-training__row-meta">{routine.mode === 'programme' ? tTraining('modeProgramme') : tTraining('modeLibre')}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
