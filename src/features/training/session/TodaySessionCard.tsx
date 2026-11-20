import { tPlural } from '../../../i18n/plural';
import { useEffect, useState } from 'react';
import { summarizeSets, type RoutineDay, type WorkoutWithSets } from '../../../domain/training';
import { cycleWeekMarker, type CycleWeekMarker } from '../../../domain/training/cycleWeek';
import { programDayFor } from '../../../domain/training/programDay';
import { formatExerciseLoad, tTraining } from '../../../i18n/trainingText';
import { Button, useLayout } from '../../../ui';
import { MissingValue } from '../../../ui/MissingValue';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { useSyncedData } from '../../sync/remoteChanges';
import { loadCurrentCycle, localDayOf } from '../cycle/currentCycle';
import type { TodaySessionPreview } from './todaySessionPreview';
import '../../app/TodayScreen.css';
import './Session.css';

/**
 * Carte « Séance » (I1-02, § 13.1) d'Aujourd'hui et de l'accueil de l'Entraînement : une séance ouverte (locale) est proposée par
 * « Reprendre la séance » après une fermeture forcée ou un redémarrage ; sinon « Commencer une séance ». Chargée à la demande depuis
 * Aujourd'hui (bloc à part) : rien de l'écran de séance n'est tiré ici. Lecture impossible : rien n'est affiché (l'onglet le dit).
 *
 * ERGO-01b P1 (D-238, D-243) : avec un programme suivi (cycle actif), la carte devient « Séance du jour » : le jour désigné (`nextProgramDay`),
 * ses exercices, « Lancer la séance » en un tap (même départ que « Démarrer « jour » » de l'écran de séance) et « Autre séance… » vers les
 * options. P5 : le bouton « Journal des séances » (doublon de la section « Journal » d'Entraînement) est retiré.
 *
 * FIX-0223 (D-260, aperçu validé du 12/11) : durée estimée et nombre d'exercices, les trois premiers exercices (ordre `position`) avec la
 * charge que la séance proposera, en bronze, puis « + n exercices ». L'aperçu (moteur de prescription) est un module à part, importé à la
 * demande : rien du moteur dans le départ. Charge inconnue : aucun chiffre ; aperçu illisible : nombre d'exercices seul, sans charge.
 */
const SHOWN = 3;
/** FIX-0243 (constat 7) : tables lues par la carte (séance, séries, cycle, routine, moteur) ; un lot reçu qui en touche une la relit. */
const READ_TABLES = ['workout', 'workout_set', 'mesocycle', 'routine', 'routine_day', 'routine_exercise', 'recommendation_decision', 'progression_profile', 'exercise', 'equipment_profile', 'body_weight'] as const;

interface ProgramDay {
  readonly routineId: string;
  readonly day: RoutineDay;
  /** Durée et charges ; null si l'aperçu est illisible. */
  readonly preview: TodaySessionPreview | null;
}
/** PROG-04 (D-316) : jour sans séance prévue (jours rattachés à un jour de la semaine) ; le prochain jour prévu est annoncé. */
interface RestDay {
  readonly rest: true;
  /** FIX-PROGRAMME (C-063) : la séance du jour est déjà faite aujourd'hui (sinon : jour sans séance prévue). */
  readonly done: boolean;
  readonly nextName: string;
  readonly nextWeekday: number;
}
type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly open: WorkoutWithSets | null; readonly program: ProgramDay | RestDay | null; readonly marker: CycleWeekMarker | null };

const byPosition = (day: RoutineDay) => [...day.exercises].sort((a, b) => a.position - b.position);

/** ERGO-03 (D-297) : « Semaine 1 sur 4 » et, en semaine de décharge, le badge bronze « Décharge » ; rien sans cycle en cours. */
function CycleMarker({ marker }: { readonly marker: CycleWeekMarker | null }) {
  if (marker === null) return null;
  return (
    <p className="ct-session-card__cycle">
      <span>{tTraining('cycleWeekMarker', { week: marker.week, total: marker.total })}</span>
      {marker.deload ? <span className="ct-session-card__deload">{tTraining('cycleDeloadBadge')}</span> : null}
    </p>
  );
}

export function TodaySessionCard() {
  const { data, clock } = useAppContainer();
  const navigate = useNavigationStore((s) => s.navigate);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pc = useLayout() === 'pc';
  const synced = useSyncedData(READ_TABLES);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const open = await (await data.repos.workouts()).getOpen();
        const cycle = await loadCurrentCycle(data, localDayOf(clock.nowMs()));
        const program = open === null ? await programDayOf(cycle) : null;
        if (live) setLoad({ status: 'ready', open, program, marker: cycle === null ? null : cycleWeekMarker(cycle.state) });
      } catch {
        if (live) setLoad({ status: 'failed' });
      }
    })();
    /** Jour désigné par le cycle actif ; null sans cycle actif, routine illisible ou sans jour garni (carte d'avant). */
    async function programDayOf(cycle: Awaited<ReturnType<typeof loadCurrentCycle>>): Promise<ProgramDay | RestDay | null> {
      if (cycle === null || cycle.state.phase !== 'active') return null;
      const [routine, closed] = await Promise.all([(await data.repos.trainingRoutines()).get(cycle.record.routineId), (await data.repos.workouts()).listClosed(50)]);
      if (routine === null) return null;
      // PROG-04 (D-316) : jour de la semaine s'il est donné ; sinon rotation d'avant (D-243).
      // FIX-PROGRAMME (C-063) : date locale du début de chaque séance close, pour ne pas reproposer la séance du jour déjà faite.
      const dated = closed.map((w) => ({ routineId: w.routineId, routineDayId: w.routineDayId, day: localDayOf(Date.parse(w.startedAt)) }));
      const choice = programDayFor(routine.days, dated, routine.id, localDayOf(clock.nowMs()));
      if (choice === null) return null;
      if (choice.kind === 'rest' || choice.kind === 'done') {
        const next = routine.days.find((d) => d.id === choice.nextDayId);
        return next === undefined ? null : { rest: true, done: choice.kind === 'done', nextName: next.name, nextWeekday: choice.nextWeekday };
      }
      const day = routine.days.find((d) => d.id === choice.dayId);
      if (day === undefined) return null;
      // ERGO-02 : sur PC le tableau montre tous les exercices ; l'iPhone en garde trois.
      const shown = byPosition(day)
        .slice(0, pc ? day.exercises.length : SHOWN)
        .map((l) => l.id);
      // Semaine de deload du cycle : la séance lancée depuis la routine du cycle propose le deload par défaut (I3-02), l'aperçu aussi.
      const preview = await import('./todaySessionPreview').then((m) => m.loadTodaySessionPreview(data, day, shown, { nowMs: clock.nowMs(), plan: cycle.state.plan })).catch(() => null);
      return { routineId: routine.id, day, preview };
    }
    return () => {
      live = false;
    };
  }, [data, clock, pc, synced]);

  if (load.status !== 'ready') return null;
  const { open, program, marker } = load;

  if (open === null && program !== null && 'rest' in program) {
    const weekday = tTraining('weekdayNames').split('|')[program.nextWeekday - 1] ?? '';
    return (
      <section className="ct-today__card ct-session-card" aria-labelledby="ct-session-card-title">
        <h2 id="ct-session-card-title" className="ct-today__eyebrow ct-section-title">
          {tTraining('sessionTodayEyebrow')}
        </h2>
        <CycleMarker marker={marker} />
        <div className="ct-session-card__body">
          <p className="ct-session-card__name">{tTraining(program.done ? 'sessionDoneTitle' : 'sessionRestTitle')}</p>
          <p className="ct-today__muted ct-session-card__meta">{tTraining(program.done ? 'sessionDoneToday' : 'sessionRestToday', { weekday, name: program.nextName })}</p>
        </div>
        <Button fullWidth variant="secondary" onClick={() => navigate({ tab: 'training', screen: 'session' })}>
          {tTraining('sessionOther')}
        </Button>
      </section>
    );
  }

  async function launch(target: ProgramDay): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      await data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: target.routineId, dayId: target.day.id }));
      navigate({ tab: 'training', screen: 'session' });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  if (open === null && program !== null && !('rest' in program)) {
    const { day, preview } = program;
    const n = day.exercises.length;
    const more = n - SHOWN;
    const loadOf = (id: string, kg: number | null): string | null => (kg === null ? null : formatExerciseLoad(kg, preview?.held.get(id) ?? null));
    const targetOf = (l: RoutineDay['exercises'][number]): string => tTraining(l.repMin === l.repMax ? 'sessionTargetSame' : 'sessionTarget', { sets: l.sets, min: l.repMin, max: l.repMax });
    const meta =
      preview === null
        ? tPlural(tTraining, n, 'sessionTodayMetaOne', 'sessionTodayMeta')
        : tPlural(tTraining, n, 'sessionTodayMetaTimedOne', 'sessionTodayMetaTimed', { min: preview.minutes });
    return (
      <section className="ct-today__card ct-session-card" aria-labelledby="ct-session-card-title">
        <h2 id="ct-session-card-title" className="ct-today__eyebrow ct-section-title">
          {tTraining('sessionTodayEyebrow')}
        </h2>
        <CycleMarker marker={marker} />
        <div className="ct-session-card__body">
          <div className="ct-session-card__head">
            <p className="ct-session-card__name">{day.name}</p>
            <p className="ct-today__muted ct-session-card__meta">{meta}</p>
          </div>
          {pc ? (
            <table className="ct-session-card__table" aria-label={tTraining('sessionTodayExercises')}>
              <thead>
                <tr>
                  <th scope="col">{tTraining('sessionTableRank')}</th>
                  <th scope="col">{tTraining('sessionTableExercise')}</th>
                  <th scope="col">{tTraining('sessionTableTarget')}</th>
                  <th scope="col" className="ct-session-card__num">{tTraining('sessionTableLoad')}</th>
                </tr>
              </thead>
              <tbody>
                {byPosition(day).map((line, index) => (
                  <tr key={line.id}>
                    <td className="ct-session-card__rank">{index + 1}</td>
                    <td>{line.exerciseName}</td>
                    <td className="ct-session-card__rank">{targetOf(line)}</td>
                    <td className="ct-session-card__num ct-session-card__load">{loadOf(line.id, preview?.loads.get(line.id) ?? null) ?? <MissingValue reason={tTraining(preview === null || preview.unreadable.has(line.id) ? 'loadUnreadable' : 'loadToEnter')} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <ul className="ct-session-card__list" aria-label={tTraining('sessionTodayExercises')}>
            {byPosition(day)
              .slice(0, SHOWN)
              .map((line) => {
                const loadKg = preview?.loads.get(line.id) ?? null;
                return (
                  <li key={line.id} className="ct-session-card__row">
                    <span className="ct-session-card__exercise">{line.exerciseName}</span>
                    {loadKg === null ? null : <b className="ct-session-card__load">{loadOf(line.id, loadKg)}</b>}
                  </li>
                );
              })}
          </ul>
          )}
          {!pc && more > 0 ? <p className="ct-today__muted ct-session-card__more">{tPlural(tTraining, more, 'sessionTodayMoreOne', 'sessionTodayMore')}</p> : null}
        </div>
        {failed ? (
          <p className="ct-training__error" role="alert">
            {tTraining('sessionStartError')}
          </p>
        ) : null}
        <Button fullWidth disabled={busy} onClick={() => void launch(program)}>
          {pc ? tTraining('sessionEnterHere') : tTraining('sessionLaunch')}
        </Button>
        <Button fullWidth variant="secondary" disabled={busy} onClick={() => navigate({ tab: 'training', screen: 'session' })}>
          {tTraining('sessionOther')}
        </Button>
      </section>
    );
  }

  const summary = open ? summarizeSets(open.sets) : null;
  return (
    <section className="ct-today__card ct-session-card" aria-labelledby="ct-session-card-title">
      <h2 id="ct-session-card-title" className="ct-today__eyebrow ct-section-title">
        {tTraining(open ? 'sessionOpenEyebrow' : 'sessionEyebrow')}
      </h2>
      <CycleMarker marker={marker} />
      {open && summary ? (
        <div className="ct-session-card__body">
          <p className="ct-session-card__name">{open.name === '' ? tTraining('sessionFree') : open.name}</p>
          {/* ERGO-01 : séries faites sur prévues en chiffre héros, l'unité à part. */}
          <p className="ct-hero">
            <span className="ct-hero__num">{tTraining('sessionSetsHero', { done: summary.validated, planned: summary.planned })}</span>{' '}
            <span className="ct-hero__unit">{tTraining('sessionSetsUnit')}</span>
          </p>
        </div>
      ) : null}
      <Button fullWidth variant={open ? 'primary' : 'secondary'} onClick={() => navigate({ tab: 'training', screen: 'session' })}>
        {tTraining(open ? 'sessionResume' : 'sessionStart')}
      </Button>
    </section>
  );
}
