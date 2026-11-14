import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { generationWeekOf } from '../../../domain/training/mesocycle';
import { generateSession } from '../../../domain/training/generateSession';
import {
  EXERCISE_PATTERNS,
  type ExercisePattern,
  type GeneratedExercise,
  type GeneratedSession as Generated,
  type GenerationIssueCode,
  type OmittedExercise,
  type RoutineTree,
  type SetStyle,
  type SplitKind,
  type VarietyLevel,
  type WorkoutWithSets,
} from '../../../domain/training';
import type { IsoDateTime } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { tGeneration, type TrainingGenerationTextKey } from '../../../i18n/trainingGenerationText';
import { formatRest, tTraining } from '../../../i18n/trainingText';
import { Button, SegmentedControl } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { loadCurrentCycle, localDayOf, type CurrentCycle } from '../cycle/currentCycle';
import { groupLabel, PATTERN_KEY } from '../labels';
import type { TrainingData } from '../trainingState';
import { buildGenerationInput, defaultGenerationSettings, defaultSplitFor, startGeneratedSession, type GenerationSettings } from './generationInput';
import './GeneratedSession.css';

/**
 * « Séance proposée » (I3-01 ; § 12.1, § 12.3 ; D-73) : bloc à la demande ouvert depuis « Nouvelle séance », avec son catalogue de textes.
 * Réglages éphémères (mode, répartition, variété, style, temps disponible, priorités, douleurs) : la proposition est recalculée à chaque
 * changement par `generateSession`, sans aucune écriture. « Commencer cette séance » crée la séance (une transaction) ; la routine reste telle
 * quelle. L'instant de la proposition est figé à l'ouverture (même proposition tant que le bloc reste ouvert).
 */

/** I5-02 point 2.2 : Recovery Split de la proposition, bloc à la demande (lecture, domaine et textes chargés avec lui). */
const RecoverySplitView = lazy(() => import('./RecoverySession').then((m) => ({ default: m.RecoverySplitView })));

const BUDGETS = [null, 20, 30, 35, 45, 60, 75, 90] as const;
const ISSUE_KEY: Readonly<Record<GenerationIssueCode, TrainingGenerationTextKey>> = {
  'imported-unavailable': 'importedUnavailable',
  'day-out-of-range': 'issueDay',
  'split-days': 'issueSplitDays',
  'custom-day-groups': 'issueCustomDayGroups',
  'home-profile-required': 'issueHomeProfile',
  'budget-invalid': 'issueBudget',
};
const MODE_HINT = { guide: 'modeHintGuide', libre: 'modeHintLibre', maison: 'modeHintMaison' } as const;
/** Le style n'a pas de colonne dans la séance (I3-01) : il est dit comme une consigne d'exécution, jamais présenté comme appliqué. */
const STYLE_HINT = { straight: 'styleHintStraight', pyramid: 'styleHintPyramid', reverse: 'styleHintReverse' } as const satisfies Record<SetStyle, TrainingGenerationTextKey>;

const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const minutes = (sec: number): number => Math.round(sec / 60);

interface Props {
  readonly access: DataAccess;
  readonly data: TrainingData;
  readonly routines: readonly RoutineTree[];
  readonly onStarted: (workout: WorkoutWithSets) => void;
  readonly onClose: () => void;
}

export function GeneratedSession({ access, data, routines, onStarted, onClose }: Props) {
  const container = useAppContainer();
  const [now] = useState(() => new Date(container.clock.nowMs()).toISOString() as IsoDateTime);
  const entries = useMemo(
    () =>
      routines.flatMap((routine) => {
        const sorted = [...routine.days].sort((a, b) => a.dayOrder - b.dayOrder);
        return sorted.flatMap((day, index) => (day.exercises.length > 0 ? [{ routine, day, index, days: sorted }] : []));
      }),
    [routines],
  );
  const [dayId, setDayId] = useState(entries[0]?.day.id ?? '');
  const entry = entries.find((e) => e.day.id === dayId) ?? entries[0];
  const [settings, setSettings] = useState<GenerationSettings>(() => defaultGenerationSettings(entry?.days.length ?? 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  /** I3-02 : cycle suivi au jour de la proposition ; `undefined` pendant la lecture, une erreur de lecture est dite. */
  const [cycle, setCycle] = useState<CurrentCycle | null | undefined | 'error'>(undefined);
  useEffect(() => {
    let alive = true;
    loadCurrentCycle(access, localDayOf(Date.parse(now))).then(
      (c) => {
        if (alive) setCycle(c);
      },
      () => {
        if (alive) setCycle('error');
      },
    );
    return () => {
      alive = false;
    };
  }, [access, now]);
  const followed = cycle !== undefined && cycle !== null && cycle !== 'error' && entry !== undefined && cycle.record.routineId === entry.routine.id ? cycle : null;
  const cycleInput = followed !== null && followed.state.phase === 'active' ? { week: generationWeekOf(followed.state), mesocycleIndex: followed.state.mesocycleIndex } : null;

  const session = useMemo(
    () => (entry ? generateSession(buildGenerationInput(data, { days: entry.days, startedAt: entry.routine.createdAt }, entry.index, settings, now, cycleInput)) : null),
    // La semaine ne change que si le cycle change (lu une fois à l'ouverture).
    [entry, data, settings, now, cycle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cycleLine = ((): string | null => {
    if (cycle === 'error') return tGeneration('cycleError');
    if (followed === null) return null;
    const s = followed.state;
    if (s.phase === 'paused') return tGeneration('cyclePaused');
    if (s.phase !== 'active' || s.plan === null) return tGeneration('cycleInactive');
    if (s.plan.deload) return tGeneration(s.plan.deloadSets !== undefined ? 'cycleProgramDeload' : 'cycleDeload');
    const week = s.totalWeeks === null ? tGeneration('cycleBlockWeek', { week: s.blockWeek, block: s.blockIndex + 1 }) : tGeneration('cycleWeekOf', { week: s.week, total: s.totalWeeks });
    const sets = tGeneration(s.plan.setsOffset < 0 ? 'cycleSetsMinus' : s.plan.setsOffset > 0 ? 'cycleSetsPlus' : 'cycleSetsSame');
    const rir = s.plan.rirLow !== undefined && s.plan.rirLow < s.plan.rir ? tGeneration('cycleRirRange', { low: s.plan.rirLow, high: s.plan.rir }) : s.plan.rir === 1 ? tGeneration('cycleRirOne') : tGeneration('cycleRirMany', { rir: s.plan.rir });
    return tGeneration(s.kind === 'light' ? 'cycleLight' : 'cycleWork', { week, sets, rir });
  })();
  const set = (patch: Partial<GenerationSettings>): void => setSettings((s) => ({ ...s, ...patch }));
  const chooseDay = (id: string): void => {
    const next = entries.find((e) => e.day.id === id);
    if (next && entry && next.routine.id !== entry.routine.id) set({ split: defaultSplitFor(next.days.length), customGroups: [] });
    else if (next && settings.split === 'custom') set({ customGroups: [] });
    setDayId(id);
  };

  async function start(): Promise<void> {
    if (!session || session.status !== 'ready' || session.exercises.length === 0) return;
    setBusy(true);
    setError(false);
    try {
      onStarted(await startGeneratedSession(access, session, entry?.routine.id ?? null));
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const guided = settings.mode !== 'libre';
  const sourceName = (id: string): string => entry?.day.exercises.find((l) => l.exerciseId === id)?.exerciseName ?? id;
  const nameOf = (id: string): string => data.exercises.find((e) => e.id === id)?.nameFr ?? id;
  const musclesOf = (id: string) => data.exercises.find((e) => e.id === id)?.muscles ?? [];
  const muscleNameOf = (id: string): string => data.content.muscles.find((m) => m.id === id)?.nameFr ?? id;

  // I3-02 : aucune proposition avant la lecture du cycle (jamais les séries de la routine présentées à la place de celles de la semaine).
  if (cycle === undefined) {
    return (
      <p className="ct-session__muted" role="status">
        {tGeneration('loading')}
      </p>
    );
  }

  return (
    <section className="ct-generated" aria-labelledby="ct-generated-title">
      <div className="ct-generated__head">
        <h3 id="ct-generated-title" className="ct-training__heading">
          {tGeneration('title')}
        </h3>
        <Button variant="secondary" onClick={onClose}>
          {tGeneration('close')}
        </Button>
      </div>
      {!entry || !session ? (
        <p className="ct-session__muted">{tGeneration('noRoutine')}</p>
      ) : (
        <>
          <SegmentedControl
            label={tGeneration('dayLabel')}
            value={entry.day.id}
            onChange={chooseDay}
            options={entries.map((e) => ({ value: e.day.id, label: routines.length > 1 ? tGeneration('dayWithRoutine', { day: e.day.name, routine: e.routine.name }) : e.day.name }))}
          />
          {cycleLine !== null && (
            <p className="ct-generated__note" role={cycle === 'error' ? 'alert' : undefined}>
              {cycleLine}
            </p>
          )}
          <div className="ct-generated__field">
            <SegmentedControl
              label={tGeneration('modeLabel')}
              value={settings.mode}
              onChange={(mode) => set({ mode })}
              options={[
                { value: 'guide', label: tGeneration('modeGuide') },
                { value: 'libre', label: tGeneration('modeLibre') },
                { value: 'maison', label: tGeneration('modeMaison') },
              ]}
            />
            <p className="ct-generated__note">{tGeneration(MODE_HINT[settings.mode])}</p>
            <p className="ct-generated__note">{tGeneration('importedUnavailable')}</p>
          </div>
          {guided && (
            <SegmentedControl<SplitKind>
              label={tGeneration('splitLabel')}
              value={settings.split}
              onChange={(split) => set({ split, customGroups: [] })}
              columns={2}
              options={[
                { value: 'full-body', label: tGeneration('splitFullBody') },
                { value: 'upper-lower', label: tGeneration('splitUpperLower') },
                { value: 'ppl', label: tGeneration('splitPpl') },
                { value: 'custom', label: tGeneration('splitCustom') },
              ]}
            />
          )}
          {guided && settings.split === 'custom' && (
            <Toggles
              legend={tGeneration('customGroupsLabel')}
              items={data.content.groups.map((g) => ({ value: g, label: tGeneration('customGroupToggle', { group: groupLabel(g) }), text: groupLabel(g) }))}
              selected={settings.customGroups}
              onToggle={(g) => set({ customGroups: toggle(settings.customGroups, g) })}
            />
          )}
          {guided && (
            <div className="ct-generated__field">
              <SegmentedControl<VarietyLevel>
                label={tGeneration('varietyLabel')}
                value={settings.variety}
                onChange={(variety) => set({ variety })}
                options={[
                  { value: 'consistent', label: tGeneration('varietyConsistent') },
                  { value: 'balanced', label: tGeneration('varietyBalanced') },
                  { value: 'varied', label: tGeneration('varietyVaried') },
                ]}
              />
              <p className="ct-generated__note">{tGeneration('varietyHint')}</p>
            </div>
          )}
          <div className="ct-generated__field">
            <SegmentedControl<SetStyle>
              label={tGeneration('styleLabel')}
              value={settings.style}
              onChange={(style) => set({ style })}
              options={[
                { value: 'straight', label: tGeneration('styleStraight') },
                { value: 'pyramid', label: tGeneration('stylePyramid') },
                { value: 'reverse', label: tGeneration('styleReverse') },
              ]}
            />
            <p className="ct-generated__note">{tGeneration(STYLE_HINT[settings.style])}</p>
            <p className="ct-generated__note">{tGeneration('styleNotSaved')}</p>
          </div>
          <SegmentedControl<string>
            label={tGeneration('budgetLabel')}
            value={settings.budgetMin === null ? 'none' : String(settings.budgetMin)}
            onChange={(v) => set({ budgetMin: v === 'none' ? null : Number(v) })}
            options={BUDGETS.map((b) => ({ value: b === null ? 'none' : String(b), label: b === null ? tGeneration('budgetNone') : tGeneration('budgetMinutes', { n: b }) }))}
          />
          {guided && (
            <Toggles
              legend={tGeneration('priorityLabel')}
              items={data.content.groups.map((g) => ({ value: g, label: tGeneration('priorityToggle', { group: groupLabel(g) }), text: groupLabel(g) }))}
              selected={settings.priorities}
              onToggle={(g) => set({ priorities: toggle(settings.priorities, g) })}
            />
          )}
          <Toggles<ExercisePattern>
            legend={tGeneration('painLabel')}
            hint={tGeneration('painHint')}
            items={EXERCISE_PATTERNS.map((p) => ({ value: p, label: tGeneration('painToggle', { pattern: tTraining(PATTERN_KEY[p]) }), text: tTraining(PATTERN_KEY[p]) }))}
            selected={settings.painfulPatterns}
            onToggle={(p) => set({ painfulPatterns: toggle(settings.painfulPatterns, p) })}
          />
          <Proposal session={session} entryDays={entry.days.length} sourceName={sourceName} nameOf={nameOf} />
          {session.status === 'ready' && session.exercises.length > 0 && (
            <Suspense fallback={null}>
              <RecoverySplitView access={access} atMs={Date.parse(now)} exercises={session.exercises.map((e) => ({ muscles: musclesOf(e.exerciseId) }))} muscleName={muscleNameOf} />
            </Suspense>
          )}
          {error && (
            <p className="ct-training__error" role="alert">
              {tGeneration('startError')}
            </p>
          )}
          <Button fullWidth disabled={busy || session.status !== 'ready' || session.exercises.length === 0} onClick={() => void start()}>
            {busy ? tGeneration('starting') : tGeneration('start')}
          </Button>
          <p className="ct-generated__note">{tGeneration('startHint')}</p>
        </>
      )}
    </section>
  );
}

function Toggles<T extends string>({
  legend,
  hint,
  items,
  selected,
  onToggle,
}: {
  readonly legend: string;
  readonly hint?: string;
  readonly items: readonly { readonly value: T; readonly label: string; readonly text: string }[];
  readonly selected: readonly T[];
  readonly onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="ct-generated__field">
      <legend>{legend}</legend>
      {hint && <p className="ct-generated__note">{hint}</p>}
      <div className="ct-generated__toggles">
        {items.map((item) => (
          <button key={item.value} type="button" className="ct-generated__toggle" aria-label={item.label} aria-pressed={selected.includes(item.value)} onClick={() => onToggle(item.value)}>
            {item.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function setsLine(e: GeneratedExercise): string {
  const rest = formatRest(e.restSec);
  if (e.metric === 'time') return tGeneration('setsLineTime', { sets: e.sets, min: e.repMin, rest });
  if (e.sets === 1) return tGeneration('setsLineNoRest', { sets: e.sets, min: e.repMin, max: e.repMax });
  if (e.repMin === e.repMax) return tGeneration('setsLineSingle', { sets: e.sets, min: e.repMin, rest });
  return tGeneration('setsLine', { sets: e.sets, min: e.repMin, max: e.repMax, rest });
}

function omittedText(o: OmittedExercise, nameOf: (id: string) => string): string {
  const suggestion = o.suggestionId === null ? null : nameOf(o.suggestionId);
  switch (o.reason) {
    case 'time-budget':
      return tGeneration('omittedTime', { name: o.exerciseName });
    case 'unknown-exercise':
      return tGeneration('omittedUnknown', { name: o.exerciseName });
    case 'pain':
      return suggestion === null ? tGeneration('omittedPain', { name: o.exerciseName }) : tGeneration('omittedPainSuggestion', { name: o.exerciseName, suggestion });
    case 'equipment':
      return suggestion === null ? tGeneration('omittedEquipment', { name: o.exerciseName }) : tGeneration('omittedEquipmentSuggestion', { name: o.exerciseName, suggestion });
  }
}

interface ProposalProps {
  readonly session: Generated;
  readonly entryDays: number;
  /** Nom figé de la ligne de routine d'origine. */
  readonly sourceName: (id: string) => string;
  /** Nom d'un exercice de la bibliothèque (remplaçant suggéré). */
  readonly nameOf: (id: string) => string;
}

function Proposal({ session, entryDays, sourceName, nameOf }: ProposalProps) {
  if (session.status !== 'ready') {
    return (
      <ul className="ct-generated__list" aria-label={tGeneration('listLabel')}>
        {session.issues.map((code) => (
          <li key={code} className="ct-generated__issue" role="alert">
            {tGeneration(ISSUE_KEY[code], { n: entryDays })}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {session.exercises.length === 0 ? (
        <p className="ct-session__muted">{tGeneration('empty')}</p>
      ) : (
        <ul className="ct-generated__list" aria-label={tGeneration('listLabel')}>
          {session.exercises.map((e) => (
            <li key={`${e.sourcePosition}-${e.exerciseId}`} className="ct-generated__item">
              <h4 className="ct-generated__name">{e.exerciseName}</h4>
              <p className="ct-generated__sets">
                {setsLine(e)}
                {e.rir !== null ? ` · ${tGeneration('rir', { rir: e.rir })}` : ''}
              </p>
              {e.origin === 'substitution' && (
                <p className="ct-generated__note">{tGeneration(e.substitutionReason === 'pain' ? 'originSubstitutionPain' : 'originSubstitutionEquipment', { name: sourceName(e.sourceExerciseId) })}</p>
              )}
              {e.origin === 'rotation' && <p className="ct-generated__note">{tGeneration('originRotation', { name: sourceName(e.sourceExerciseId) })}</p>}
              {e.setsRemoved > 0 && <p className="ct-generated__note">{e.setsRemoved === 1 ? tGeneration('setsRemovedOne') : tGeneration('setsRemovedMany', { n: e.setsRemoved })}</p>}
              {e.warnings.includes('duplicate-in-routine') && <p className="ct-generated__note">{tGeneration('duplicateInRoutine')}</p>}
              {e.warnings.includes('off-split-in-routine') && <p className="ct-generated__note">{tGeneration('offSplitInRoutine')}</p>}
            </li>
          ))}
        </ul>
      )}
      {session.omitted.length > 0 && (
        <ul className="ct-generated__list" aria-label={tGeneration('omittedLabel')}>
          {session.omitted.map((o) => (
            <li key={`${o.sourcePosition}-${o.exerciseId}`} className="ct-generated__note">
              {omittedText(o, nameOf)}
            </li>
          ))}
        </ul>
      )}
      <p className="ct-generated__duration">
        {session.budgetSec === null
          ? tGeneration('duration', { min: minutes(session.estimatedSec) })
          : tGeneration('durationBudget', { min: minutes(session.estimatedSec), budget: minutes(session.budgetSec) })}
      </p>
      <p className="ct-generated__note">{tGeneration('durationHint')}</p>
      {session.warnings.includes('over-budget') && <p className="ct-generated__note">{tGeneration('overBudget')}</p>}
      {session.warnings.includes('under-budget') && <p className="ct-generated__note">{tGeneration('underBudget')}</p>}
      {session.uncoveredGroups.length > 0 && <p className="ct-generated__note">{tGeneration('uncovered', { groups: session.uncoveredGroups.map(groupLabel).join(', ') })}</p>}
    </>
  );
}
