import { useEffect, useId, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { parseGoalText, stepsWeeks, TRACKING_DEFAULTS, TRACKING_GOAL_BOUNDS, zone2Range, zone2Weeks, type GoalField, type GoalTextIssue, type StepsWeek, type TrackingGoals } from '../../domain/tracking';
import { detectTimeZone } from '../../platform/timeZone';
import { formatDayMonthYear } from '../../i18n/format';
import { formatCount, tTracking } from '../../i18n/trackingText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import type { RatingKind, RatingPoint } from '../../domain/bodyProgress/measurements';
import { useSyncedData } from '../sync/remoteChanges';
import { RatingsCurves } from './RatingsCurves';
import { isPhone, loadGoals, readRatings, readStepsDays, readZone2, saveGoals, type StepsRead, type Zone2Read } from './trackingData';
import './Tracking.css';

/**
 * SUIVIS-029 : Progrès › Suivis — objectifs (réglage local), pas par semaine et cardio en zone 2 (4 semaines), notes du matin (30 jours). Bloc chargé à la demande avec son catalogue de textes
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

function Zone2({ read, goal, today }: { readonly read: Zone2Read; readonly goal: number; readonly today: string }) {
  const id = useId();
  const { hrMax, sessions } = read;
  const range = hrMax === null ? null : zone2Range(hrMax.value);
  const weeks = range === null || sessions === null ? [] : zone2Weeks(sessions, range, today, detectTimeZone() ?? 'Europe/Paris', WEEKS);
  return (
    <section className="ct-tracking__block" aria-labelledby={`${id}-zone2`}>
      <h3 id={`${id}-zone2`} className="ct-tracking__title">
        {tTracking('zone2Title')}
      </h3>
      {hrMax === null || range === null ? (
        <>
          <p className="ct-tracking__value">{tTracking('missing')}</p>
          <p className="ct-today__muted">{tTracking('zone2NoHrMax')}</p>
        </>
      ) : (
        <>
          <p className="ct-tracking__value">{hrMax.source === 'entered' ? tTracking('zone2HrMaxEntered', { hr: hrMax.value }) : tTracking('zone2HrMaxAge', { hr: hrMax.value, age: hrMax.age ?? '' })}</p>
          <p className="ct-tracking__value">{tTracking('zone2Range', { low: range.low, high: range.high })}</p>
          <p className="ct-today__muted">{tTracking('zone2Rule')}</p>
          {sessions === null ? (
            <p className="ct-today__muted">{tTracking('zone2ReadFailed')}</p>
          ) : (
            <ul className="ct-tracking__list">
              {weeks.map((w) => (
                <li key={w.weekStart} className="ct-tracking__item">
                  <span>{tTracking('weekOf', { date: formatDayMonthYear(w.weekStart) })}</span>
                  <span className="ct-tracking__value">
                    {tTracking('zone2WeekLine', { min: w.minutes, goal })}
                    {w.minutes >= goal ? ` · ${tTracking('zone2Reached')}` : ''}
                  </span>
                  {w.sessionsWithoutHr > 0 ? <span className="ct-today__muted">{tTracking('zone2WithoutHr', { n: w.sessionsWithoutHr })}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="ct-today__muted">{tTracking('zone2Disclaimer')}</p>
    </section>
  );
}

type Load = { readonly status: 'loading' } | { readonly status: 'ready'; readonly goals: TrackingGoals; readonly steps: StepsRead; readonly phone: boolean; readonly zone2: Zone2Read; readonly ratings: Readonly<Record<RatingKind, readonly RatingPoint[]>> | null };

export function TrackingProgress() {
  const container = useAppContainer();
  const today = todayLocal(container.clock);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [epoch, setEpoch] = useState(0);
  const synced = useSyncedData(['measurement', 'cardio_session', 'profile']);

  useEffect(() => {
    let live = true;
    void (async () => {
      const goals = await loadGoals(container).catch(() => TRACKING_DEFAULTS);
      const phone = isPhone(container);
      const steps: StepsRead = phone ? await readStepsDays(container, today, WEEKS * 7) : { days: [], everRead: false };
      const zone2 = await readZone2(container, goals, today);
      const ratings = await readRatings(container);
      return { goals, steps, phone, zone2, ratings };
    })().then((r) => {
      if (live) setLoad({ status: 'ready', ...r });
    });
    return () => {
      live = false;
    };
  }, [container, today, epoch, synced]);

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
          <Zone2 read={load.zone2} goal={load.goals.zone2WeeklyMin} today={today} />
          <RatingsCurves ratings={load.ratings} today={today} />
        </>
      )}
    </section>
  );
}
