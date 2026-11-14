import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from '../../../domain/training/config';
import { anticipateDeload, changeNextWeeks, closeMesocycle, createMesocycleSpec, MESO_WEEK_CHOICES, nextMesocycleSpec, type MesocycleSpec, type MesocycleState, type WeekPlan } from '../../../domain/training/mesocycle';
import { pauseProgram, resumeProgram, resumeProposal } from '../../../domain/training/programPause';
import type { Routine } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { MesocycleRecord } from '../../../db/repositories/mesocycleRepository';
import { parseDraft } from '../../../domain/onboarding/draft';
import { cycleDate, tCycle } from '../../../i18n/trainingCycleText';
import { Button, SegmentedControl, Switch } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { loadCurrentCycle, localDayOf, type CurrentCycle } from './currentCycle';
import './CycleView.css';

/**
 * Section « Cycle » de l'onglet Entraînement (I3-02 ; § 12.2, § 12.5, § 12.6 ; D-73 points 3, 8, 9). Bloc à la demande, avec son catalogue.
 *
 * - Sans cycle : routine suivie et durée (5 semaines par défaut, 4 à 7 ou illimité) ; rien n'est écrit avant « Commencer le cycle ».
 * - Cycle en cours : semaine, séries et RIR de la semaine (ou deload), deload anticipé PROPOSÉ puis confirmé (jamais déclenché seul), pause,
 *   « Terminer le cycle ». En pause : jours non comptés, aucune séance manquée, aucun rappel (aucune notification n'est programmée ici) ;
 *   reprise après plus de 21 jours : semaine allégée proposée, acceptée ou non.
 * - Fin de bloc : bilan (répéter, régénérer, changer de programme, terminer sans suite) ; le cycle suivant repart en semaine 1.
 * - Chaque écriture passe par le repository (transaction quand il y en a deux) ; une erreur est dite, rien n'est changé.
 */

type WeeksChoice = '4' | '5' | '6' | '7' | 'unlimited';
type Mode = 'view' | 'anticipate' | 'resume' | 'review' | 'change';
type Load = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly current: CurrentCycle | null; readonly routines: readonly Routine[] };

const WEEKS: readonly WeeksChoice[] = ['4', '5', '6', '7', 'unlimited'];
const toWeeks = (choice: WeeksChoice): number | 'unlimited' => (choice === 'unlimited' ? 'unlimited' : Number(choice));

const rirText = (rir: number): string => (rir === 1 ? tCycle('rirOne') : tCycle('rirMany', { rir }));
const setsText = (offset: number): string => tCycle(offset < 0 ? 'setsMinus' : offset > 0 ? 'setsPlus' : 'setsSame');

function planText(state: MesocycleState, plan: WeekPlan): string {
  // PROG-01 : décharge d'un cycle de 4 ou 6 semaines (2 séries, 90 %, RIR 3-4) ; plage de RIR (« 2 à 3 »).
  if (plan.deload) return tCycle(plan.deloadSets !== undefined ? 'programDeloadWeek' : 'deloadWeek');
  const rir = plan.rirLow !== undefined && plan.rirLow < plan.rir ? tCycle('rirRange', { low: plan.rirLow, high: plan.rir }) : rirText(plan.rir);
  const params = { sets: setsText(plan.setsOffset), rir };
  return tCycle(state.kind === 'light' ? 'lightWeek' : 'workWeek', params);
}

function weekLabel(state: MesocycleState, routine: string): string {
  if (state.totalWeeks === null) {
    const block = state.blockIndex + 1;
    if (state.anticipated && state.kind === 'deload') return tCycle('blockWeekAnticipated', { block, routine });
    return tCycle(state.kind === 'light' ? 'blockWeekLight' : 'blockWeek', { week: state.blockWeek, block, routine });
  }
  const key = state.kind === 'light' ? 'weekOfLight' : state.anticipated && state.kind === 'deload' ? 'weekOfAnticipated' : 'weekOf';
  return tCycle(key, { week: state.week, total: state.totalWeeks, routine });
}

export function CycleView({ access }: { readonly access: DataAccess }) {
  const container = useAppContainer();
  const today = useCallback(() => localDayOf(container.clock.nowMs()), [container]);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [mode, setMode] = useState<Mode>('view');
  const [routineId, setRoutineId] = useState('');
  const [weeks, setWeeks] = useState<WeeksChoice>('5');
  const [rampUp, setRampUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const fetchCycle = useCallback(async () => {
    const [current, routines, answers] = await Promise.all([
      loadCurrentCycle(access, today()),
      (await access.repos.trainingRoutines()).list(),
      // PROG-01 (D-269 (7)) : durée et semaine de reprise de l'étape 7 de l'onboarding, valeurs du formulaire du premier cycle.
      access.repos.settings.get('onboarding.answers').catch(() => null),
    ]);
    return { current, routines, answers: answers === null || answers === undefined ? null : parseDraft(answers) };
  }, [access, today]);
  const apply = useCallback(({ current, routines, answers }: { readonly current: CurrentCycle | null; readonly routines: readonly Routine[]; readonly answers?: ReturnType<typeof parseDraft> | null }): void => {
    setLoad({ status: 'ready', current, routines });
    if (answers) {
      setWeeks(String(answers.mesoWeeks) as WeeksChoice);
      setRampUp(answers.rampUp);
    }
    setRoutineId((id) => (routines.some((r) => r.id === id) ? id : (current?.record.routineId ?? routines[0]?.id ?? '')));
  }, []);
  const reload = async (): Promise<void> => {
    try {
      apply(await fetchCycle());
    } catch {
      setLoad({ status: 'error' });
    }
  };

  useEffect(() => {
    let alive = true;
    fetchCycle().then(
      (result) => {
        if (alive) apply(result);
      },
      () => {
        if (alive) setLoad({ status: 'error' });
      },
    );
    return () => {
      alive = false;
    };
  }, [fetchCycle, apply]);

  /** Écriture puis relecture (la base fait foi) ; `null` : geste refusé par le domaine, dit comme une erreur (jamais un bouton sans effet). */
  async function write(work: ((repos: DataAccess['repos']) => Promise<void>) | null): Promise<void> {
    if (work === null) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await access.transaction(work);
      setMode('view');
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const saving = (record: MesocycleRecord, spec: MesocycleSpec | null) => (spec === null ? null : async (repos: DataAccess['repos']) => void (await (await repos.mesocycles()).save(record.id, spec)));
  /** Clôt `record` (bilan) puis commence `next` dans la même transaction. */
  const chaining = (record: MesocycleRecord | null, outcome: 'repeat' | 'regenerate' | 'change', next: MesocycleSpec | null) =>
    next === null
      ? null
      : async (repos: DataAccess['repos']) => {
          const repo = await repos.mesocycles();
          if (record !== null && record.readable) await repo.save(record.id, closeMesocycle(record, outcome, today()));
          await repo.start(next);
        };

  if (load.status === 'loading') {
    return (
      <p className="ct-training__muted" role="status">
        {tCycle('loading')}
      </p>
    );
  }
  if (load.status === 'error') {
    return (
      <div role="alert" className="ct-training__error-block">
        <p>{tCycle('loadError')}</p>
        <Button variant="secondary" onClick={() => void reload()}>
          {tCycle('retry')}
        </Button>
      </div>
    );
  }

  const { current, routines } = load;
  const routineName = (id: string): string => routines.find((r) => r.id === id)?.name ?? tCycle('unknownRoutine');
  const errorLine = error ? (
    <p role="alert" className="ct-cycle__error">
      {tCycle('writeError')}
    </p>
  ) : null;

  const form = (onStart: () => void) =>
    routines.length === 0 ? (
      <p className="ct-training__muted">{tCycle('noRoutine')}</p>
    ) : (
      <div className="ct-cycle__form">
        <SegmentedControl label={tCycle('routineLabel')} value={routineId} onChange={setRoutineId} options={routines.map((r) => ({ value: r.id, label: r.name }))} />
        <SegmentedControl<WeeksChoice>
          label={tCycle('weeksLabel')}
          value={weeks}
          onChange={setWeeks}
          options={WEEKS.map((w) => ({ value: w, label: w === 'unlimited' ? tCycle('unlimited') : tCycle('weeksOption', { weeks: w }) }))}
        />
        {weeks === 'unlimited' && <p className="ct-cycle__note">{tCycle('unlimitedHint')}</p>}
        {mode !== 'change' && <Switch checked={rampUp} label={tCycle('rampUpLabel')} onChange={setRampUp} />}
        {mode !== 'change' && <p className="ct-cycle__note">{tCycle('rampUpHint')}</p>}
        <div className="ct-cycle__actions">
          <Button variant="primary" disabled={busy || routineId === ''} onClick={onStart}>
            {tCycle('start')}
          </Button>
          {mode === 'change' && (
            <Button variant="secondary" disabled={busy} onClick={() => setMode('review')}>
              {tCycle('back')}
            </Button>
          )}
        </div>
      </div>
    );

  const startFresh = () => {
    const spec = createMesocycleSpec({ routineId, startDate: today(), weeks: toWeeks(weeks), rampUp }, CONFIG);
    void write(spec === null ? null : async (repos) => void (await (await repos.mesocycles()).start(spec)));
  };

  let body: React.ReactNode;
  if (current === null || current.state.phase === 'invalid') {
    body = (
      <>
        <p className="ct-cycle__status">{current === null ? tCycle('none') : tCycle('invalid')}</p>
        <p className="ct-cycle__note">{tCycle('intro')}</p>
        {form(startFresh)}
      </>
    );
  } else {
    const { record, state } = current;
    const routine = routineName(record.routineId);
    if (mode === 'change') {
      body = form(() => void write(chaining(record, 'change', nextMesocycleSpec(record, 'change', today(), CONFIG, { routineId, weeks: toWeeks(weeks) }))));
    } else if (state.phase === 'finished' || mode === 'review') {
      const summary =
        state.phase === 'finished'
          ? tCycle('reviewDone', { routine, weeks: record.unlimited ? tCycle('reviewUnlimited') : tCycle('reviewWeeks', { weeks: record.weeks }) })
          : tCycle('reviewOpen', { routine, week: state.week });
      body = (
        <div className="ct-cycle__review">
          <h4 id="ct-cycle-review" className="ct-cycle__subtitle">
            {tCycle('reviewTitle')}
          </h4>
          <p className="ct-cycle__status">{summary}</p>
          <div className="ct-cycle__choices">
            <Button variant="primary" disabled={busy} onClick={() => void write(chaining(record, 'repeat', nextMesocycleSpec(record, 'repeat', today(), CONFIG)))}>
              {tCycle('repeat')}
            </Button>
            <p className="ct-cycle__note">{tCycle('repeatHint')}</p>
            <Button variant="secondary" disabled={busy} onClick={() => void write(chaining(record, 'regenerate', nextMesocycleSpec(record, 'regenerate', today(), CONFIG)))}>
              {tCycle('regenerate')}
            </Button>
            <p className="ct-cycle__note">{tCycle('regenerateHint')}</p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setRoutineId(record.routineId);
                setWeeks(record.unlimited ? 'unlimited' : (String(record.weeks) as WeeksChoice));
                setMode('change');
              }}
            >
              {tCycle('change')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void write(saving(record, closeMesocycle(record, 'stopped', today())))}>
              {tCycle('stop')}
            </Button>
            {state.phase !== 'finished' && (
              <Button variant="secondary" disabled={busy} onClick={() => setMode('view')}>
                {tCycle('back')}
              </Button>
            )}
          </div>
        </div>
      );
    } else if (state.phase === 'paused') {
      const proposal = resumeProposal(record, today(), CONFIG);
      body = (
        <>
          <p className="ct-cycle__status">{tCycle('paused', { date: cycleDate(state.pausedSince ?? today()) })}</p>
          <p className="ct-cycle__note">{tCycle('pauseHint')}</p>
          {mode === 'resume' && proposal?.lightWeekProposed === true ? (
            <div className="ct-cycle__confirm">
              <p className="ct-cycle__status">{tCycle('lightProposal', { days: proposal.pausedDays })}</p>
              <div className="ct-cycle__actions">
                <Button variant="primary" disabled={busy} onClick={() => void write(saving(record, resumeProgram(record, today(), true, CONFIG)))}>
                  {tCycle('resumeLight')}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void write(saving(record, resumeProgram(record, today(), false, CONFIG)))}>
                  {tCycle('resumePlain')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="ct-cycle__actions">
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => (proposal?.lightWeekProposed === true ? setMode('resume') : void write(saving(record, resumeProgram(record, today(), false, CONFIG))))}
              >
                {tCycle('resume')}
              </Button>
            </div>
          )}
        </>
      );
    } else if (state.phase === 'not-started') {
      body = <p className="ct-cycle__status">{tCycle('notStarted', { date: cycleDate(record.startDate) })}</p>;
    } else {
      body = (
        <>
          <p className="ct-cycle__week">{weekLabel(state, routine)}</p>
          {state.plan !== null && <p className="ct-cycle__status">{planText(state, state.plan)}</p>}
          {state.plan?.rampUp === true && state.kind === 'work' && <p className="ct-cycle__note">{tCycle('rampUpWeek')}</p>}
          {state.plan?.isolationRir !== undefined && <p className="ct-cycle__note">{tCycle('isolationRir', { rir: state.plan.isolationRir })}</p>}
          {!record.unlimited && (
            <SegmentedControl<string>
              label={tCycle('nextWeeksLabel')}
              value={String(record.nextWeeks ?? record.weeks)}
              onChange={(value) => void write(saving(record, changeNextWeeks(record, Number(value), CONFIG)))}
              options={MESO_WEEK_CHOICES.map((w) => ({ value: String(w), label: tCycle('weeksOption', { weeks: w }) }))}
            />
          )}
          {!record.unlimited && record.nextWeeks !== undefined && record.nextWeeks !== null && record.nextWeeks !== record.weeks && (
            <p className="ct-cycle__note">{tCycle('nextWeeksNote', { weeks: record.weeks })}</p>
          )}
          {state.kind === 'work' && <p className="ct-cycle__note">{tCycle('priorityNote')}</p>}
          <p className="ct-cycle__note">{tCycle('scopeNote')}</p>
          {mode === 'anticipate' ? (
            <div className="ct-cycle__confirm">
              <p className="ct-cycle__status">{tCycle(record.unlimited ? 'anticipateConfirmTextUnlimited' : 'anticipateConfirmText')}</p>
              <div className="ct-cycle__actions">
                <Button variant="primary" disabled={busy} onClick={() => void write(saving(record, anticipateDeload(record, today(), CONFIG)))}>
                  {tCycle('anticipateConfirm')}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setMode('view')}>
                  {tCycle('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="ct-cycle__actions">
              {state.canAnticipate && (
                <Button variant="secondary" disabled={busy} onClick={() => setMode('anticipate')}>
                  {tCycle('anticipate')}
                </Button>
              )}
              <Button variant="secondary" disabled={busy} onClick={() => void write(saving(record, pauseProgram(record, today())))}>
                {tCycle('pause')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setMode('review')}>
                {tCycle('finish')}
              </Button>
            </div>
          )}
        </>
      );
    }
  }

  return (
    <section className="ct-cycle" aria-labelledby="ct-cycle-title">
      <h3 id="ct-cycle-title" className="ct-training__heading">
        {tCycle('title')}
      </h3>
      {current !== null && current.activeCount > 1 && (
        <p role="status" className="ct-cycle__warning">
          {tCycle('duplicates')}
        </p>
      )}
      {body}
      {errorLine}
    </section>
  );
}
