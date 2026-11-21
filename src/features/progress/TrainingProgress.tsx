import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { DEFAULT_PROGRESS_CONFIG } from '../../domain/training/config';
import { adherence, constancy, monthCalendar, trailingWeeks, weeklyMuscleVolume, type Adherence, type Constancy, type MonthCalendar, type WeeklyVolume } from '../../domain/training/progressStats';
import type { MuscleWeight } from '../../domain/training/types';
import type { IsoDateTime, LocalDate } from '../../domain/types';
import type { FirstWeekday } from '../../domain/week';
import { tPlural } from '../../i18n/plural';
import { formatDayMonth, formatTenth, tTrainingProgress } from '../../i18n/trainingProgressText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { CONSTANCY_TABLES, localDayOf, readConstancy, type ConstancyData } from './constancyData';
import { StreakLines } from './TodayStreak';
import './TrainingProgress.css';

/**
 * Progrès › Entraînement (PROGRES, § 17.1) : volume par muscle et par semaine. Lecture seule des séances closes (repository), calcul dans le
 * domaine (`progressStats`). Valeurs écrites ; barres en SVG décoratif doublées d'une étiquette textuelle (Recharts non importé, C-167 :
 * aucune dépendance de plus pour huit barres). Bloc chargé à la demande avec son catalogue de textes (jamais dans le départ).
 */

const READ_TABLES = [...new Set(['workout', 'workout_set', 'exercise', ...CONSTANCY_TABLES])];

interface Loaded {
  readonly volume: WeeklyVolume;
  readonly muscleName: (id: string) => string;
  readonly constancy: ConstancyData;
  readonly streak: Constancy;
  readonly adherence: Adherence | null;
  readonly calendar: MonthCalendar;
  readonly firstWeekday: FirstWeekday;
}
type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | ({ readonly status: 'ready' } & Loaded);

/** Instant (ISO) du début local du jour `day`. */
const localMidnightIso = (day: LocalDate): IsoDateTime => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toISOString() as IsoDateTime;
};

async function load(access: ReturnType<typeof useAppContainer>['data'], today: LocalDate, first: FirstWeekday): Promise<Loaded> {
  const weeks = trailingWeeks(today, DEFAULT_PROGRESS_CONFIG.volumeWeeks, first);
  // Catalogue embarqué lu directement (comme le Strength Score) : passer par l'état de l'Entraînement partageait des blocs avec la carte Séance
  // et allongeait la liste de préchargement du départ (mesure du bundle). Personnalisés supprimés compris : un exercice supprimé reste compté (P-09).
  const [exercisesModule, musclesModule, customsRepo, workoutsRepo, constancyData] = await Promise.all([
    import('../../../content/exercises/exercises.json'),
    import('../../../content/exercises/muscles.json'),
    access.repos.exercises(),
    access.repos.workouts(),
    readConstancy(access),
  ]);
  const [customs, workouts] = await Promise.all([customsRepo.list({ includeDeleted: true }), workoutsRepo.closedSince(localMidnightIso(weeks[0] ?? today))]);
  const catalog = exercisesModule.default.exercises as readonly { readonly id: string; readonly muscles: readonly MuscleWeight[] }[];
  const muscles = new Map<string, readonly MuscleWeight[]>();
  for (const x of [...catalog, ...customs]) muscles.set(x.id, x.muscles.map((m) => ({ id: m.id, weight: m.weight })));
  const names = new Map((musclesModule.default as { readonly muscles: readonly { readonly id: string; readonly nameFr: string }[] }).muscles.map((m) => [m.id, m.nameFr]));
  const volume = weeklyMuscleVolume({
    workouts: workouts.map((w) => ({ day: localDayOf(Date.parse(w.startedAt)), sets: w.sets })),
    musclesOf: (id) => muscles.get(id) ?? null,
    today,
    firstWeekday: first,
  });
  return {
    volume,
    muscleName: (id) => names.get(id) ?? id,
    constancy: constancyData,
    streak: constancy({ ...constancyData, today, firstWeekday: first }),
    adherence: adherence({ ...constancyData, today, firstWeekday: first }),
    calendar: monthCalendar({ today, days: constancyData.days, pauses: constancyData.pauses, firstWeekday: first }),
    firstWeekday: first,
  };
}

function VolumeBars({ perWeek, label }: { readonly perWeek: readonly number[]; readonly label: string }) {
  const max = Math.max(...perWeek, 1);
  const width = 8 * perWeek.length;
  return (
    <svg className="ct-tprogress__bars" viewBox={`0 0 ${String(width)} 20`} preserveAspectRatio="none" role="img" aria-label={label}>
      {perWeek.map((n, i) => {
        const h = n === 0 ? 0.5 : Math.max(1.5, (n / max) * 20);
        return <rect key={i} className={i === perWeek.length - 1 ? 'ct-tprogress__bar ct-tprogress__bar--current' : 'ct-tprogress__bar'} x={i * 8 + 1} y={20 - h} width={6} height={h} />;
      })}
    </svg>
  );
}

/*
 * Dates écrites ici avec Intl plutôt qu'avec i18n/format.ts : ses fonctions inutilisées au départ (calendrier) y entreraient (mesure du bundle).
 */
const DAY_LONG = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAY_NARROW = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow', timeZone: 'UTC' });
const FIRST_ISO: Readonly<Record<FirstWeekday, number>> = { monday: 1, saturday: 6, sunday: 7 };
const utcOf = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
/** Initiales des jours dans l'ordre de la semaine réglée (1er janvier 2024 : lundi). */
const weekdayInitials = (first: FirstWeekday): string[] => Array.from({ length: 7 }, (_, i) => WEEKDAY_NARROW.format(new Date(Date.UTC(2024, 0, ((FIRST_ISO[first] - 1 + i) % 7) + 1))));
const dayAria = (day: string): string => DAY_LONG.format(utcOf(day)).replace(/^1 /, '1er ');
const monthTitle = (month: string): string => {
  const text = MONTH.format(utcOf(`${month}-01`));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function dayLabel(cell: NonNullable<MonthCalendar['cells'][number]>): string {
  const date = dayAria(cell.date);
  const base =
    cell.sessions > 0
      ? tPlural(tTrainingProgress, cell.sessions, 'calendarDayOne', 'calendarDay', { date })
      : cell.paused
        ? tTrainingProgress('calendarDayPaused', { date })
        : tTrainingProgress('calendarDayNone', { date });
  return cell.today ? `${base} ${tTrainingProgress('calendarToday')}` : base;
}

function ConstancyCard({ constancy: data, streak, calendar, firstWeekday }: Loaded) {
  const month = monthTitle(calendar.month);
  return (
    <section className="ct-today__card ct-tprogress ct-flat" aria-labelledby="ct-tprogress-constancy">
      <h2 id="ct-tprogress-constancy" className="ct-today__eyebrow ct-section-title">
        {tTrainingProgress('constancyTitle')}
      </h2>
      <StreakLines result={streak} sessions={data.days.length} />
      <p className="ct-today__muted ct-tprogress__lead">{data.target === null ? tTrainingProgress('streakRuleDefault') : tTrainingProgress('streakRuleProgram', { target: data.target.perWeek })}</p>
      <h3 className="ct-today__muted ct-tprogress__lead">{tTrainingProgress('calendarTitle', { month })}</h3>
      <div className="ct-tprogress__calendar" aria-hidden="true">
        {weekdayInitials(firstWeekday).map((w, i) => (
          <span key={i} className="ct-tprogress__weekday">
            {w}
          </span>
        ))}
      </div>
      <ul className="ct-tprogress__calendar">
        {calendar.cells.map((cell, i) =>
          cell === null ? (
            <li key={`blank-${String(i)}`} aria-hidden="true" />
          ) : (
            <li
              key={cell.date}
              aria-label={dayLabel(cell)}
              className={['ct-tprogress__day', cell.sessions > 0 ? 'ct-tprogress__day--done' : '', cell.paused ? 'ct-tprogress__day--paused' : '', cell.today ? 'ct-tprogress__day--today' : ''].filter(Boolean).join(' ')}
            >
              <span aria-hidden="true">{String(Number(cell.date.slice(8)))}</span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function AdherenceCard({ adherence: a, constancy: data }: Pick<Loaded, 'adherence' | 'constancy'>) {
  return (
    <section className="ct-today__card ct-tprogress ct-flat" aria-labelledby="ct-tprogress-adherence">
      <h2 id="ct-tprogress-adherence" className="ct-today__eyebrow ct-section-title">
        {tTrainingProgress('adherenceTitle')}
      </h2>
      {a !== null ? (
        <>
          <p className="ct-tprogress__hero">
            <span className="ct-tprogress__hero-value">{tTrainingProgress('adherenceValue', { percent: a.percent })}</span>
          </p>
          <p className="ct-today__text">{tTrainingProgress('adherenceDetail', { done: a.done, planned: a.planned, weeks: a.weeks })}</p>
          <p className="ct-today__muted ct-tprogress__lead">{tTrainingProgress('adherenceRule')}</p>
        </>
      ) : (
        <p className="ct-today__text">{tTrainingProgress(data.target === null ? 'adherenceNone' : 'adherenceWait')}</p>
      )}
    </section>
  );
}

function Volume({ volume, muscleName }: Pick<Loaded, 'volume' | 'muscleName'>) {
  const weeks = volume.weekStarts.length;
  return (
    <section className="ct-today__card ct-tprogress ct-flat" aria-labelledby="ct-tprogress-volume">
      <h2 id="ct-tprogress-volume" className="ct-today__eyebrow ct-section-title">
        {tTrainingProgress('volumeTitle')}
      </h2>
      <p className="ct-today__muted ct-tprogress__lead">{tTrainingProgress('volumeSubtitle', { weeks })}</p>
      {volume.muscles.length === 0 ? (
        <p className="ct-today__text">{tTrainingProgress('volumeEmpty')}</p>
      ) : (
        <ul className="ct-tprogress__list">
          {volume.muscles.map((m) => {
            const name = muscleName(m.muscleId);
            const id = `ct-tprogress-muscle-${m.muscleId}`;
            const values = m.perWeek.map((n, i) => tTrainingProgress('volumeWeek', { date: formatDayMonth(volume.weekStarts[i] ?? ''), n: formatTenth(n) })).join(' ; ');
            return (
              <li key={m.muscleId} className="ct-tprogress__row" aria-labelledby={id}>
                <span id={id} className="ct-tprogress__name">
                  {name}
                </span>
                <VolumeBars perWeek={m.perWeek} label={tTrainingProgress('volumeChart', { muscle: name, values })} />
                <span className="ct-tprogress__value">{tTrainingProgress('volumeLine', { n: formatTenth(m.perWeek.at(-1) ?? 0), mean: formatTenth(m.total / weeks), weeks })}</span>
              </li>
            );
          })}
        </ul>
      )}
      {volume.unknownSets > 0 ? <p className="ct-today__muted">{tPlural(tTrainingProgress, volume.unknownSets, 'volumeUnknownOne', 'volumeUnknown')}</p> : null}
      <p className="ct-today__muted ct-tprogress__foot">{tTrainingProgress('volumeNoRange')}</p>
    </section>
  );
}

/** PROGRES-b : la carte d'Aujourd'hui est servie par ce bloc (un seul bloc à la demande : en ajouter un scindait des blocs du départ). */
export { TodayStreak } from './TodayStreak';

/** `firstWeekday` : réglage « Début de semaine », lu par l'hôte (SectionNotice) : le lire ici scinderait un bloc du départ (mesure du bundle). */
export function TrainingProgress({ firstWeekday = 'monday' }: { readonly firstWeekday?: FirstWeekday }) {
  const container = useAppContainer();
  const synced = useSyncedData(READ_TABLES);
  const today = todayLocal(container.clock);
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load(container.data, today, firstWeekday).then(
      (data) => {
        if (live) setState({ status: 'ready', ...data });
      },
      () => {
        if (live) setState({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced, attempt, firstWeekday]);

  if (state.status === 'loading') {
    return (
      <p className="ct-today__muted" role="status">
        {tTrainingProgress('loading')}
      </p>
    );
  }
  if (state.status === 'failed') {
    return (
      <section className="ct-today__card ct-tprogress ct-flat" role="alert">
        <p className="ct-today__text">{tTrainingProgress('loadFailed')}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {tTrainingProgress('retry')}
        </Button>
      </section>
    );
  }
  return (
    <>
      <ConstancyCard {...state} />
      <AdherenceCard adherence={state.adherence} constancy={state.constancy} />
      <Volume volume={state.volume} muscleName={state.muscleName} />
    </>
  );
}
