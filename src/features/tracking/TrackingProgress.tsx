import { useEffect, useId, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { parseGoalText, stepsWeeks, TRACKING_DEFAULTS, TRACKING_GOAL_BOUNDS, type GoalField, type GoalTextIssue, type StepsWeek, type TrackingGoals } from '../../domain/tracking';
import { formatDayMonthYear } from '../../i18n/format';
import { formatCount, tTracking } from '../../i18n/trackingText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { isPhone, loadGoals, readStepsDays, saveGoals, type StepsRead } from './trackingData';
import './Tracking.css';

/**
 * SUIVIS-029 : Progrès › Suivis — objectifs (réglage local), pas par semaine (4 semaines). Bloc chargé à la demande avec son catalogue de textes
 * (jamais dans le départ). Aucune valeur inventée : semaine sans donnée « — », pas absents du PC avec leur raison.
 */

const WEEKS = 4;
const FIELDS: readonly { readonly field: GoalField; readonly label: 'goalSteps' | 'goalZone2' | 'goalHrMax' }[] = [
  { field: 'stepsDaily', label: 'goalSteps' },
  { field: 'zone2WeeklyMin', label: 'goalZone2' },
  { field: 'hrMax', label: 'goalHrMax' },
];

const textOf = (goals: TrackingGoals): Record<GoalField, string> => ({
  stepsDaily: String(goals.stepsDaily),
  zone2WeeklyMin: String(goals.zone2WeeklyMin),
  hrMax: goals.hrMax === null ? '' : String(goals.hrMax),
});

function GoalsForm({ goals, onSaved }: { readonly goals: TrackingGoals; readonly onSaved: () => void }) {
  const container = useAppContainer();
  const id = useId();
  const [text, setText] = useState<Record<GoalField, string>>(() => textOf(goals));
  const [issues, setIssues] = useState<Partial<Record<GoalField, GoalTextIssue>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');

  const submit = (): void => {
    const next: Partial<Record<GoalField, number | null>> = {};
    const found: Partial<Record<GoalField, GoalTextIssue>> = {};
    for (const { field } of FIELDS) {
      const r = parseGoalText(field, text[field]);
      if (r.ok) next[field] = r.value;
      else found[field] = r.issue;
    }
    setIssues(found);
    setStatus('idle');
    if (Object.keys(found).length > 0) return;
    const saved: TrackingGoals = {
      stepsDaily: next.stepsDaily ?? TRACKING_DEFAULTS.stepsDaily,
      zone2WeeklyMin: next.zone2WeeklyMin ?? TRACKING_DEFAULTS.zone2WeeklyMin,
      hrMax: next.hrMax ?? null,
    };
    saveGoals(container, saved).then(
      () => {
        setStatus('saved');
        onSaved();
      },
      () => setStatus('failed'),
    );
  };

  return (
    <section className="ct-tracking__block" aria-labelledby={`${id}-goals`}>
      <h3 id={`${id}-goals`} className="ct-tracking__title">
        {tTracking('goalsTitle')}
      </h3>
      <form
        className="ct-tracking__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {FIELDS.map(({ field, label }) => {
          const issue = issues[field];
          const { min, max } = TRACKING_GOAL_BOUNDS[field];
          return (
            <div key={field} className="ct-tracking__field">
              <label htmlFor={`${id}-${field}`}>{tTracking(label)}</label>
              <input
                id={`${id}-${field}`}
                className="ct-tracking__input"
                inputMode="numeric"
                value={text[field]}
                aria-invalid={issue !== undefined}
                aria-describedby={issue === undefined ? undefined : `${id}-${field}-issue`}
                onChange={(e) => {
                  const value = e.target.value;
                  setText((t) => ({ ...t, [field]: value }));
                }}
              />
              {issue === undefined ? null : (
                <p id={`${id}-${field}-issue`} className="ct-tracking__issue">
                  {issue === 'range' ? tTracking('issue_range', { min: formatCount(min), max: formatCount(max) }) : tTracking(`issue_${issue}`)}
                </p>
              )}
            </div>
          );
        })}
        <Button type="submit" variant="secondary">
          {tTracking('goalsSave')}
        </Button>
      </form>
      {status === 'saved' ? (
        <p className="ct-today__muted" role="status">
          {tTracking('goalsSaved')}
        </p>
      ) : status === 'failed' ? (
        <p className="ct-tracking__issue" role="alert">
          {tTracking('goalsSaveFailed')}
        </p>
      ) : null}
    </section>
  );
}

function StepsWeeks({ phone, read, goal, today }: { readonly phone: boolean; readonly read: StepsRead; readonly goal: number; readonly today: string }) {
  const id = useId();
  const weeks: readonly StepsWeek[] = read.days === null ? [] : stepsWeeks(read.days, today, goal, WEEKS);
  return (
    <section className="ct-tracking__block" aria-labelledby={`${id}-steps`}>
      <h3 id={`${id}-steps`} className="ct-tracking__title">
        {tTracking('stepsWeeksTitle')}
      </h3>
      {!phone ? (
        <p className="ct-today__muted">{tTracking('stepsReason_on_pc')}</p>
      ) : read.days === null ? (
        <p className="ct-today__muted">{tTracking('stepsReason_read_failed')}</p>
      ) : !read.everRead ? (
        <p className="ct-today__muted">{tTracking('stepsReason_never_read')}</p>
      ) : (
        <ul className="ct-tracking__list">
          {weeks.map((w) => (
            <li key={w.weekStart} className="ct-tracking__item">
              <span>{tTracking('weekOf', { date: formatDayMonthYear(w.weekStart) })}</span>
              <span className="ct-tracking__value">{w.average === null ? tTracking('missing') : tTracking('stepsWeekLine', { avg: formatCount(w.average), n: w.knownDays, g: w.daysAtGoal })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Load = { readonly status: 'loading' } | { readonly status: 'ready'; readonly goals: TrackingGoals; readonly steps: StepsRead; readonly phone: boolean };

export function TrackingProgress() {
  const container = useAppContainer();
  const today = todayLocal(container.clock);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const goals = await loadGoals(container).catch(() => TRACKING_DEFAULTS);
      const phone = isPhone(container);
      const steps: StepsRead = phone ? await readStepsDays(container, today, WEEKS * 7) : { days: [], everRead: false };
      return { goals, steps, phone };
    })().then((r) => {
      if (live) setLoad({ status: 'ready', ...r });
    });
    return () => {
      live = false;
    };
  }, [container, today, epoch]);

  return (
    <section className="ct-today__card ct-tracking ct-flat" aria-labelledby="ct-tracking-progress-title">
      <h2 id="ct-tracking-progress-title" className="ct-today__eyebrow ct-section-title">
        {tTracking('progressTitle')}
      </h2>
      <p className="ct-today__muted">{tTracking('progressHint')}</p>
      {load.status === 'loading' ? (
        <p className="ct-today__muted" role="status">
          {tTracking('loading')}
        </p>
      ) : (
        <>
          <GoalsForm goals={load.goals} onSaved={() => setEpoch((n) => n + 1)} />
          <StepsWeeks phone={load.phone} read={load.steps} goal={load.goals.stepsDaily} today={today} />
        </>
      )}
    </section>
  );
}
