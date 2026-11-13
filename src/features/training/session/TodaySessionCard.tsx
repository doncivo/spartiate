import { useEffect, useState } from 'react';
import { summarizeSets, type RoutineDay, type WorkoutWithSets } from '../../../domain/training';
import { nextProgramDay } from '../../../domain/training/programDay';
import { tTraining } from '../../../i18n/trainingText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { loadCurrentCycle, localDayOf } from '../cycle/currentCycle';
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
 */
interface ProgramDay {
  readonly routineId: string;
  readonly day: RoutineDay;
}
type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly open: WorkoutWithSets | null; readonly program: ProgramDay | null };

export function TodaySessionCard() {
  const { data, clock } = useAppContainer();
  const navigate = useNavigationStore((s) => s.navigate);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const open = await (await data.repos.workouts()).getOpen();
        const program = open === null ? await programDayOf() : null;
        if (live) setLoad({ status: 'ready', open, program });
      } catch {
        if (live) setLoad({ status: 'failed' });
      }
    })();
    /** Jour désigné par le cycle actif ; null sans cycle actif, routine illisible ou sans jour garni (carte d'avant). */
    async function programDayOf(): Promise<ProgramDay | null> {
      const cycle = await loadCurrentCycle(data, localDayOf(clock.nowMs()));
      if (cycle === null || cycle.state.phase !== 'active') return null;
      const [routine, closed] = await Promise.all([(await data.repos.trainingRoutines()).get(cycle.record.routineId), (await data.repos.workouts()).listClosed(50)]);
      if (routine === null) return null;
      const dayId = nextProgramDay(routine.days, closed, routine.id);
      const day = routine.days.find((d) => d.id === dayId);
      return day === undefined ? null : { routineId: routine.id, day };
    }
    return () => {
      live = false;
    };
  }, [data, clock]);

  if (load.status !== 'ready') return null;
  const { open, program } = load;

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

  if (open === null && program !== null) {
    const { day } = program;
    const n = day.exercises.length;
    return (
      <section className="ct-today__card ct-session-card" aria-labelledby="ct-session-card-title">
        <h2 id="ct-session-card-title" className="ct-today__eyebrow ct-section-title">
          {tTraining('sessionTodayEyebrow')}
        </h2>
        <div className="ct-session-card__body">
          <p className="ct-session-card__name">{day.name}</p>
          <p className="ct-today__muted">{n === 1 ? tTraining('sessionTodayMetaOne') : tTraining('sessionTodayMeta', { n })}</p>
          <ul className="ct-session-card__list" aria-label={tTraining('sessionTodayExercises')}>
            {[...day.exercises]
              .sort((a, b) => a.position - b.position)
              .map((line) => (
                <li key={line.id}>{line.exerciseName}</li>
              ))}
          </ul>
        </div>
        {failed ? (
          <p className="ct-training__error" role="alert">
            {tTraining('sessionStartError')}
          </p>
        ) : null}
        <Button fullWidth disabled={busy} onClick={() => void launch(program)}>
          {tTraining('sessionLaunch')}
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
