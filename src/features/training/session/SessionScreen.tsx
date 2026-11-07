import { ArrowLeft } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { parseRestSetting, type WorkoutWithSets } from '../../../domain/training';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { ClosedWorkout } from '../../../db/repositories/workoutRepository';
import { tTraining } from '../../../i18n/trainingText';
import { liveActivity as platformLiveActivity, type LiveActivity } from '../../../platform/liveActivity';
import { systemNotificationClock } from '../../../platform/notifications/notificationClock';
import { openTimerNotifier, type TimerNotifier } from '../../../platform/notifications/timerNotification';
import { Button, Icon } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import type { TrainingData } from '../trainingState';
import { ActiveSession } from './ActiveSession';
import { createRestTimer } from './restTimer';
import { StartSession } from './StartSession';
import './Session.css';

/** Résumé de fin (I1-03) : bloc à la demande, chargé à la clôture seulement. */
const WorkoutSummary = lazy(() => import('./WorkoutSummary').then((m) => ({ default: m.WorkoutSummary })));

/** Surcharges de test de la plateforme du minuteur ; par défaut les adaptateurs réels (iPhone) ou vides (PC, navigateur). */
export interface SessionPlatform {
  readonly os?: 'ios' | 'other';
  readonly notifier?: TimerNotifier;
  readonly liveActivity?: LiveActivity;
}

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly workout: WorkoutWithSets | null; readonly restSetting: number | null; readonly closed?: ClosedWorkout | null };

async function read(access: DataAccess): Promise<{ workout: WorkoutWithSets | null; restSetting: number | null }> {
  const [workouts, raw] = await Promise.all([access.repos.workouts(), access.repos.settings.get('training.restSeconds')]);
  return { workout: await workouts.getOpen(), restSetting: parseRestSetting(raw) };
}

/**
 * Séance (I1-02) : la séance ouverte si elle existe (reprise exacte après fermeture forcée ou redémarrage : tout est relu de SQLite), sinon
 * les options de départ. Le minuteur de repos est construit ici avec les adaptateurs de la plateforme. I1-03 : après la clôture, le résumé
 * de fin (chargé à la demande) ; « Fermer le résumé » revient aux options de départ, où la séance close peut être copiée.
 */
export function SessionScreen({ data, platform, onExit }: { readonly data: TrainingData; readonly platform?: SessionPlatform; readonly onExit: () => void }) {
  const container = useAppContainer();
  const access = container.data;
  const os = platform?.os ?? (container.platform.os === 'ios' ? 'ios' : 'other');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigationStore((s) => s.navigate);

  const timer = useMemo(
    () =>
      createRestTimer({
        clock: container.clock,
        store: () => access.repos.workouts(),
        liveActivity: platform?.liveActivity ?? platformLiveActivity,
        notifier: platform?.notifier ?? openTimerNotifier(container.platform.runtime, container.platform.os, systemNotificationClock, 'rest'),
        os,
        texts: {
          label: tTraining('restLiveLabel'),
          finishedLabel: tTraining('restLiveFinished'),
          notificationTitle: tTraining('restNotificationTitle'),
          notificationBody: tTraining('restNotificationBody'),
        },
      }),
    [container, access, platform, os],
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const next = await read(access);
        if (live) setLoad({ status: 'ready', ...next });
      } catch {
        if (live) setLoad({ status: 'error' });
      }
    })();
    return () => {
      live = false;
    };
  }, [access, attempt]);

  const setRestSetting = (seconds: number | null): void => {
    setLoad((now) => (now.status === 'ready' ? { ...now, restSetting: seconds } : now));
    // Échec d'écriture du réglage : la valeur affichée revient à celle qui est réellement enregistrée (jamais un état faux).
    void access.repos.settings.set('training.restSeconds', seconds).catch(async () => {
      const stored = parseRestSetting(await access.repos.settings.get('training.restSeconds').catch(() => null));
      setLoad((now) => (now.status === 'ready' ? { ...now, restSetting: stored } : now));
    });
  };

  return (
    <div className="ct-session">
      <button type="button" className="ct-training__back" onClick={onExit}>
        <Icon icon={ArrowLeft} size={20} />
        <span>{tTraining('sessionBack')}</span>
      </button>
      {load.status === 'loading' ? (
        <p className="ct-training__muted" role="status">
          {tTraining('loading')}
        </p>
      ) : load.status === 'error' ? (
        <div role="alert" className="ct-training__error-block">
          <p>{tTraining('loadError')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {tTraining('retry')}
          </Button>
        </div>
      ) : load.closed ? (
        <Suspense
          fallback={
            <p className="ct-training__muted" role="status">
              {tTraining('loading')}
            </p>
          }
        >
          <WorkoutSummary
            access={access}
            closed={load.closed}
            onClose={() => setLoad((now) => (now.status === 'ready' ? { ...now, workout: null, closed: null } : now))}
            onJournal={() => navigate({ tab: 'training', screen: 'history' })}
          />
        </Suspense>
      ) : load.workout === null ? (
        <StartSession access={access} onStarted={(workout) => setLoad((now) => (now.status === 'ready' ? { ...now, workout } : now))} />
      ) : (
        <ActiveSession
          key={load.workout.id}
          data={data}
          access={access}
          workout={load.workout}
          restSetting={load.restSetting}
          os={os}
          timer={timer}
          clock={container.clock}
          haptics={container.haptics}
          onWorkout={(workout) => setLoad((now) => (now.status === 'ready' ? { ...now, workout } : now))}
          onRestSetting={setRestSetting}
          onClosed={(closed) => setLoad((now) => (now.status === 'ready' ? { ...now, workout: null, closed } : now))}
        />
      )}
    </div>
  );
}
