import { ArrowDown, ArrowLeft, ArrowUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  incompatibleRoutineLines,
  resolveExercise,
  validateRoutine,
  type Exercise,
  type Routine,
  type RoutineMode,
  type RoutineSpec,
  type RoutineTree,
} from "../../domain/training";
import type { IdGenerator } from "../../domain/id";
import type { DataAccess } from "../../db/repositories/dataAccess";
import { parseNumber, tTraining } from "../../i18n/trainingText";
import { Button, ConfirmDialog, Icon } from "../../ui";
import { programToRoutine, type StarterProgram } from "./content";
import { ExerciseList } from "./LibraryView";
import type { TrainingData } from "./trainingState";

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
      rir: l.rir === null ? "" : String(l.rir),
      restSec: String(l.restSec),
    })),
  })),
});

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
      rir: l.rir.trim() === "" ? null : int(l.rir),
      restSec: int(l.restSec),
      position,
    })),
  })),
});

/** Écrit le brouillon dans une transaction : seules les différences avec l'arbre lu (ajouts, modifications, retraits). */
async function saveDraft(
  access: DataAccess,
  original: RoutineTree,
  draft: Draft,
  spec: RoutineSpec,
): Promise<void> {
  await access.transaction(async (repos) => {
    const repo = await repos.trainingRoutines();
    if (spec.name !== original.name)
      await repo.update(original.id, { name: spec.name });
    const keptDays = new Set(draft.days.map((d) => d.id));
    for (const day of original.days)
      if (!keptDays.has(day.id)) await repo.removeDay(day.id);
    for (const [index, day] of draft.days.entries()) {
      const daySpec = spec.days[index];
      if (!daySpec) continue;
      const before = original.days.find((d) => d.id === day.id);
      const lines = daySpec.exercises.map((l, i) => ({
        ...l,
        id: day.lines[i]?.id ?? "",
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
      for (const line of before.exercises)
        if (!kept.has(line.id)) await repo.removeExercise(line.id);
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
        if (changed)
          await repo.updateExercise(line.id, {
            sets: line.sets,
            repMin: line.repMin,
            repMax: line.repMax,
            rir: line.rir,
            restSec: line.restSec,
            position: line.position,
          });
      }
    }
  });
}

function issueText(spec: RoutineSpec): string | null {
  const issue = validateRoutine(spec)[0];
  if (!issue) return null;
  if (issue.code === "name-empty" || issue.code === "mode")
    return tTraining("errorRoutineName");
  const day =
    issue.dayIndex === undefined ? undefined : spec.days[issue.dayIndex];
  if (issue.lineIndex !== undefined && day)
    return tTraining("errorLine", {
      name: day.exercises[issue.lineIndex]?.exerciseName ?? "",
    });
  return tTraining("errorDayName", { day: (issue.dayIndex ?? 0) + 1 });
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
  readonly onClose: () => void;
  readonly onChanged: () => Promise<void>;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  return (
    <label className="ct-training__field ct-training__field--small">
      <span className="ct-training__label">{label}</span>
      <input
        className="ct-training__input ct-training__num"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function RoutineEditor({
  data,
  access,
  ids,
  tree,
  initialMessage,
  onClose,
  onChanged,
}: EditorProps) {
  const [original, setOriginal] = useState(tree);
  const [draft, setDraft] = useState<Draft>(() => toDraft(tree));
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const allLines = draft.days.flatMap((d) => d.lines);
  const incompatible = new Set(
    incompatibleRoutineLines(
      allLines,
      data.active,
      data.content.catalog,
      data.allCustoms,
    ).map((l) => l.id),
  );

  const updateDay = (
    dayId: string,
    change: (day: DraftDay) => DraftDay,
  ): void =>
    setDraft((now) => ({
      ...now,
      days: now.days.map((d) => (d.id === dayId ? change(d) : d)),
    }));
  const updateLine = (
    dayId: string,
    lineId: string,
    patch: Partial<DraftLine>,
  ): void =>
    updateDay(dayId, (d) => ({
      ...d,
      lines: d.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  const move = (dayId: string, index: number, step: -1 | 1): void =>
    updateDay(dayId, (d) => {
      const target = index + step;
      if (target < 0 || target >= d.lines.length) return d;
      const lines = [...d.lines];
      const [line] = lines.splice(index, 1);
      if (line) lines.splice(target, 0, line);
      return { ...d, lines };
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
          sets: "3",
          repMin: String(min),
          repMax: String(max),
          rir: "",
          restSec: String(exercise.defaultRestSec),
        },
      ],
    }));
    setPicking(null);
  };

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
      const fresh = await (
        await access.repos.trainingRoutines()
      ).get(original.id);
      if (fresh) {
        setOriginal(fresh);
        setDraft(toDraft(fresh));
      }
      await onChanged();
      setMessage(tTraining("routineSaved"));
    } catch {
      setError(tTraining("saveError"));
    } finally {
      setBusy(false);
    }
  }

  // Le choix d'un exercice s'affiche à la place de l'éditeur, qui reste monté (saisie et position conservées).
  const pickingDay =
    picking === null
      ? null
      : (draft.days.find((d) => d.id === picking) ?? null);

  return (
    <>
      {pickingDay && (
        <section
          className="ct-training__picker"
          role="region"
          aria-label={tTraining("pickerTitle", { day: pickingDay.name })}
        >
          <button
            type="button"
            className="ct-training__back"
            onClick={() => setPicking(null)}
          >
            <Icon icon={ArrowLeft} size={20} />
            <span>{tTraining("cancel")}</span>
          </button>
          <h2 className="ct-training__heading">
            {tTraining("pickerTitle", { day: pickingDay.name })}
          </h2>
          <ExerciseList
            data={data}
            mode="picker"
            onSelect={(exercise) => addLine(pickingDay.id, exercise)}
          />
        </section>
      )}
      <div className="ct-training__editor" hidden={pickingDay !== null}>
        <button type="button" className="ct-training__back" onClick={onClose}>
          <Icon icon={ArrowLeft} size={20} />
          <span>{tTraining("backToRoutines")}</span>
        </button>
        <h2 className="ct-training__heading">{tTraining("editRoutine")}</h2>
        {message && (
          <p className="ct-training__message" role="status">
            {message}
          </p>
        )}
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining("routineName")}</span>
          <input
            className="ct-training__input"
            value={draft.name}
            maxLength={120}
            onChange={(e) =>
              setDraft((now) => ({ ...now, name: e.target.value }))
            }
          />
        </label>
        {draft.days.map((day) => (
          <fieldset
            key={day.id}
            className="ct-training__day"
            role="group"
            aria-label={day.name}
          >
            <label className="ct-training__field">
              <span className="ct-training__label">{tTraining("dayName")}</span>
              <input
                className="ct-training__input"
                value={day.name}
                maxLength={120}
                onChange={(e) =>
                  updateDay(day.id, (d) => ({ ...d, name: e.target.value }))
                }
              />
            </label>
            {day.lines.length === 0 && (
              <p className="ct-training__muted">{tTraining("emptyDay")}</p>
            )}
            <ol className="ct-training__lines">
              {day.lines.map((line, index) => {
                const resolved = resolveExercise(
                  { id: line.exerciseId, frozenName: line.exerciseName },
                  data.content.catalog,
                  data.allCustoms,
                );
                return (
                  <li
                    key={line.id}
                    className="ct-training__line"
                    role="group"
                    aria-label={resolved.name}
                  >
                    <div className="ct-training__line-head">
                      <span className="ct-training__row-name">
                        {resolved.name}
                      </span>
                      <span className="ct-training__line-tools">
                        <button
                          type="button"
                          className="ct-training__icon-button"
                          aria-label={tTraining("moveUp")}
                          disabled={index === 0}
                          onClick={() => move(day.id, index, -1)}
                        >
                          <Icon icon={ArrowUp} size={20} />
                        </button>
                        <button
                          type="button"
                          className="ct-training__icon-button"
                          aria-label={tTraining("moveDown")}
                          disabled={index === day.lines.length - 1}
                          onClick={() => move(day.id, index, 1)}
                        >
                          <Icon icon={ArrowDown} size={20} />
                        </button>
                        <button
                          type="button"
                          className="ct-training__icon-button"
                          aria-label={tTraining("remove")}
                          onClick={() =>
                            updateDay(day.id, (d) => ({
                              ...d,
                              lines: d.lines.filter((l) => l.id !== line.id),
                            }))
                          }
                        >
                          <Icon icon={X} size={20} />
                        </button>
                      </span>
                    </div>
                    {resolved.status === "unknown" && (
                      <p className="ct-training__warn">
                        {tTraining("unknownExercise")}
                      </p>
                    )}
                    {incompatible.has(line.id) && (
                      <p className="ct-training__warn">
                        {tTraining("compatibleNo")}
                      </p>
                    )}
                    <div className="ct-training__line-fields">
                      <NumberField
                        label={tTraining("sets")}
                        value={line.sets}
                        onChange={(v) =>
                          updateLine(day.id, line.id, { sets: v })
                        }
                      />
                      <NumberField
                        label={tTraining("repMin")}
                        value={line.repMin}
                        onChange={(v) =>
                          updateLine(day.id, line.id, { repMin: v })
                        }
                      />
                      <NumberField
                        label={tTraining("repMax")}
                        value={line.repMax}
                        onChange={(v) =>
                          updateLine(day.id, line.id, { repMax: v })
                        }
                      />
                      <NumberField
                        label={tTraining("restSec")}
                        value={line.restSec}
                        onChange={(v) =>
                          updateLine(day.id, line.id, { restSec: v })
                        }
                      />
                      <NumberField
                        label={tTraining("rir")}
                        value={line.rir}
                        onChange={(v) =>
                          updateLine(day.id, line.id, { rir: v })
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="ct-training__actions">
              <Button variant="secondary" onClick={() => setPicking(day.id)}>
                {tTraining("addExercise")}
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
                {tTraining("removeDay")}
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
                    name: tTraining("newDayName", { n: now.days.length + 1 }),
                    lines: [],
                  },
                ],
              }))
            }
          >
            {tTraining("addDay")}
          </Button>
        </div>
        {error && (
          <p className="ct-training__error" role="alert">
            {error}
          </p>
        )}
        <div className="ct-training__actions ct-training__actions--sticky">
          <Button disabled={busy} onClick={() => void save()}>
            {tTraining("saveRoutine")}
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {tTraining("deleteRoutine")}
          </Button>
        </div>
        {confirm && (
          <ConfirmDialog
            title={tTraining("deleteRoutineTitle", { name: original.name })}
            description={tTraining("deleteRoutineHint")}
            confirmLabel={tTraining("delete")}
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              void (async () => {
                try {
                  await access.transaction(async (repos) =>
                    (await repos.trainingRoutines()).softDelete(original.id),
                  );
                  await onChanged();
                  onClose();
                } catch {
                  setError(tTraining("saveError"));
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

function ProgramCard({
  data,
  program,
  onAdd,
}: {
  readonly data: TrainingData;
  readonly program: StarterProgram;
  readonly onAdd: () => void;
}) {
  const lines = program.days.flatMap((d) =>
    d.exercises.map((l) => ({
      exerciseId: l.exerciseId,
      exerciseName:
        data.content.catalog.get(l.exerciseId)?.nameFr ?? l.exerciseId,
    })),
  );
  const incompatible = new Set(
    incompatibleRoutineLines(
      lines,
      data.active,
      data.content.catalog,
      data.allCustoms,
    ).map((l) => l.exerciseId),
  ).size;
  return (
    <li className="ct-training__card">
      <h3 className="ct-training__subheading">{program.name}</h3>
      <p className="ct-training__muted">
        {program.audienceFr} ·{" "}
        {tTraining("programDays", { n: program.days.length })}
      </p>
      {incompatible > 0 && (
        <p className="ct-training__warn">
          {incompatible === 1
            ? tTraining("programIncompatibleOne")
            : tTraining("programIncompatible", { n: incompatible })}
        </p>
      )}
      <Button variant="secondary" onClick={onAdd}>
        {tTraining("programAdd", { name: program.name })}
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
        if (live) setError(tTraining("loadError"));
      }
    })();
    return () => {
      live = false;
    };
  }, [access, data]);

  const openTree = async (
    id: string,
    message: string | null,
  ): Promise<void> => {
    const tree = await (await access.repos.trainingRoutines()).get(id);
    if (tree) setOpen({ tree, message });
  };

  const create = async (
    input: Parameters<typeof programToRoutine>[0] | null,
  ): Promise<void> => {
    setError(null);
    try {
      const routine = input
        ? programToRoutine(input, data.content.catalog, ids)
        : {
            id: ids.next(),
            name: tTraining("newRoutineName"),
            mode: "libre" as const,
            days: [
              {
                id: ids.next(),
                name: tTraining("newDayName", { n: 1 }),
                dayOrder: 1,
                exercises: [],
              },
            ],
          };
      await access.transaction(async (repos) =>
        (await repos.trainingRoutines()).create(routine),
      );
      await refresh();
      setPrograms(false);
      await openTree(
        routine.id,
        input ? tTraining("programAdded", { name: input.name }) : null,
      );
    } catch {
      setError(tTraining("saveError"));
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
        onClose={() => setOpen(null)}
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
        <Button onClick={() => void create(null)}>
          {tTraining("newRoutine")}
        </Button>
        <Button
          variant="secondary"
          expanded={programs}
          onClick={() => setPrograms((v) => !v)}
        >
          {tTraining("addProgram")}
        </Button>
      </div>
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      {programs && (
        <section aria-labelledby="ct-programs-title">
          <h2 id="ct-programs-title" className="ct-training__eyebrow">
            {tTraining("programsTitle")}
          </h2>
          <p className="ct-training__muted">{tTraining("programsHint")}</p>
          <ul className="ct-training__cards">
            {data.content.programs.map((program) => (
              <ProgramCard
                key={program.id}
                data={data}
                program={program}
                onAdd={() => void create(program)}
              />
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="ct-routines-title">
        <h2 id="ct-routines-title" className="ct-training__eyebrow">
          {tTraining("routines")}
        </h2>
        {routines !== null && routines.length === 0 && (
          <p className="ct-training__empty">{tTraining("noRoutines")}</p>
        )}
        <ul className="ct-training__rows">
          {(routines ?? []).map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                className="ct-training__row"
                onClick={() => void openTree(routine.id, null)}
              >
                <span className="ct-training__row-name">{routine.name}</span>
                <span className="ct-training__row-meta">
                  {routine.mode === "programme"
                    ? tTraining("modeProgramme")
                    : tTraining("modeLibre")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
