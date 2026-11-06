import { useEffect, useState } from 'react';
import { summarizeSets, type WorkoutWithSets } from '../../../domain/training';
import { tTraining } from '../../../i18n/trainingText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import './Session.css';

/**
 * Carte « Séance » (I1-02, § 13.1) d'Aujourd'hui et de l'accueil de l'Entraînement : une séance ouverte (locale) est proposée par
 * « Reprendre la séance » après une fermeture forcée ou un redémarrage ; sinon « Commencer une séance ». Chargée à la demande depuis
 * Aujourd'hui (bloc à part) : rien de l'écran de séance n'est tiré ici. Lecture impossible : rien n'est affiché (l'onglet le dit). I1-03 :
 * lien vers le journal des séances (section de l'Entraînement, chargée à la demande).
 */
type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly open: WorkoutWithSets | null };

export function TodaySessionCard() {
  const { data } = useAppContainer();
  const navigate = useNavigationStore((s) => s.navigate);
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const open = await (await data.repos.workouts()).getOpen();
        if (live) setLoad({ status: 'ready', open });
      } catch {
        if (live) setLoad({ status: 'failed' });
      }
    })();
    return () => {
      live = false;
    };
  }, [data]);

  if (load.status !== 'ready') return null;
  const { open } = load;
  const summary = open ? summarizeSets(open.sets) : null;
  return (
    <section className="ct-today__card ct-session-card" aria-labelledby="ct-session-card-title">
      <h2 id="ct-session-card-title" className="ct-today__eyebrow">
        {tTraining(open ? 'sessionOpenEyebrow' : 'sessionEyebrow')}
      </h2>
      {open && summary ? (
        <div className="ct-session-card__body">
          <p className="ct-session-card__name">{open.name === '' ? tTraining('sessionFree') : open.name}</p>
          <p className="ct-session__muted ct-session__num">{tTraining('sessionSummaryShort', { done: summary.validated, planned: summary.planned })}</p>
        </div>
      ) : null}
      <Button fullWidth variant={open ? 'primary' : 'secondary'} onClick={() => navigate({ tab: 'training', screen: 'session' })}>
        {tTraining(open ? 'sessionResume' : 'sessionStart')}
      </Button>
      <Button fullWidth variant="secondary" onClick={() => navigate({ tab: 'training', screen: 'history' })}>
        {tTraining('todayJournal')}
      </Button>
    </section>
  );
}
