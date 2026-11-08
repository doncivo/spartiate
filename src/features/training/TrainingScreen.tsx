import { lazy, Suspense } from 'react';
import { tTraining } from '../../i18n/trainingText';
import { Button, SegmentedControl, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore, type TrainingScreenId } from '../app/navigation';
import { EquipmentView } from './EquipmentView';
import { LibraryView } from './LibraryView';
import { RoutinesView } from './RoutinesView';
import { SessionScreen, type SessionPlatform } from './session/SessionScreen';
import { TodaySessionCard } from './session/TodaySessionCard';
import { useTrainingData } from './trainingState';
import './TrainingScreen.css';

/** Journal des séances (I1-03) : bloc à la demande, chargé à l'ouverture de la section. */
const HistoryView = lazy(() => import('./history/HistoryView').then((m) => ({ default: m.HistoryView })));
/** Cycle d'entraînement (I3-02) : bloc à la demande, chargé à l'ouverture de la section, avec son catalogue de textes. */
const CycleView = lazy(() => import('./cycle/CycleView').then((m) => ({ default: m.CycleView })));

/**
 * Onglet Entraînement (I1-01) : accueil à trois sections, Routines (par défaut), Bibliothèque et Matériel, comme la barre de sections des
 * maquettes iPhone-Routine et PC-Materiel. Chargé à la demande avec ses textes et le contenu embarqué. I1-02 : carte « Séance » en tête
 * (commencer, ou reprendre la séance ouverte) et écran de séance active (`screen: 'session'`). I1-03 : section « Journal » (séances closes,
 * détail, correction, suppression), chargée à la demande. I3-02 : section « Cycle » (mésocycle, pause, bilan), chargée à la demande.
 */
export function TrainingScreen({ session }: { readonly session?: SessionPlatform } = {}) {
  const container = useAppContainer();
  const layout = useLayout();
  const route = useNavigationStore((s) => s.route);
  const navigate = useNavigationStore((s) => s.navigate);
  const current: TrainingScreenId = route.tab === 'training' ? (route.screen ?? 'routines') : 'routines';
  const { state, reload } = useTrainingData(container.data);

  if (current === 'session') {
    return (
      <div className="ct-training-shell" data-layout={layout}>
        <section className="ct-training ct-training--session" aria-labelledby="ct-training-title">
          <h1 id="ct-training-title" className="ct-training__eyebrow">
            {tTraining('sessionEyebrow')}
          </h1>
          {state.status === 'ready' ? (
            <SessionScreen data={state.data} {...(session ? { platform: session } : {})} onExit={() => navigate({ tab: 'training' })} />
          ) : state.status === 'error' ? (
            <div role="alert" className="ct-training__error-block">
              <p>{tTraining('loadError')}</p>
              <Button variant="secondary" onClick={() => void reload()}>
                {tTraining('retry')}
              </Button>
            </div>
          ) : (
            <p className="ct-training__muted" role="status">
              {tTraining('loading')}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="ct-training-shell" data-layout={layout}>
      <section className="ct-training" aria-labelledby="ct-training-title">
        <h1 id="ct-training-title" className="ct-training__title">
          {tTraining('title')}
        </h1>
        <TodaySessionCard />
        <SegmentedControl
          label={tTraining('sectionsLabel')}
          value={current}
          onChange={(screen) => navigate({ tab: 'training', screen })}
          options={[
            { value: 'routines', label: tTraining('sectionRoutines') },
            { value: 'library', label: tTraining('sectionLibrary') },
            { value: 'equipment', label: tTraining('sectionEquipment') },
            { value: 'history', label: tTraining('sectionHistory') },
            { value: 'cycle', label: tTraining('sectionCycle') },
          ]}
        />
        {state.status === 'loading' ? (
          <p className="ct-training__muted" role="status">
            {tTraining('loading')}
          </p>
        ) : state.status === 'error' ? (
          <div role="alert" className="ct-training__error-block">
            <p>{tTraining('loadError')}</p>
            <Button variant="secondary" onClick={() => void reload()}>
              {tTraining('retry')}
            </Button>
          </div>
        ) : current === 'library' ? (
          <LibraryView data={state.data} access={container.data} ids={container.ids} reload={reload} />
        ) : current === 'history' ? (
          <Suspense
            fallback={
              <p className="ct-training__muted" role="status">
                {tTraining('loading')}
              </p>
            }
          >
            <HistoryView data={state.data} access={container.data} />
          </Suspense>
        ) : current === 'cycle' ? (
          <Suspense
            fallback={
              <p className="ct-training__muted" role="status">
                {tTraining('loading')}
              </p>
            }
          >
            <CycleView access={container.data} />
          </Suspense>
        ) : current === 'equipment' ? (
          <EquipmentView data={state.data} access={container.data} ids={container.ids} reload={reload} />
        ) : (
          <RoutinesView data={state.data} access={container.data} ids={container.ids} reload={reload} />
        )}
      </section>
    </div>
  );
}
