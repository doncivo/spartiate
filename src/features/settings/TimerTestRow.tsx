import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimerRemaining, timerRemainingMs, type SyntheticTimerState } from '../../domain/syntheticTimer';
import { tTimer } from '../../i18n/timerText';
import { liveActivity as platformLiveActivity, type LiveActivity } from '../../platform/liveActivity';
import { openTimerNotifier, type TimerNotifier } from '../../platform/notifications/timerNotification';
import { systemNotificationClock } from '../../platform/notifications/notificationClock';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { createSyntheticTimer, type TimerStartReport } from './syntheticTimer';

interface Props {
  /** Surcharges de test ; par défaut les adaptateurs de la plateforme (iPhone : réels, ailleurs : vides). */
  readonly os?: 'ios' | 'other';
  readonly notifier?: TimerNotifier;
  readonly liveActivity?: LiveActivity;
}

/**
 * Ligne « Tester le minuteur (60 s) » de Plus › À propos et diagnostic (SPA-007). Affichage seul : la logique (date persistée, notification,
 * Live Activity, arrêt, reprise) est dans `syntheticTimer.ts`. Le temps restant est recalculé depuis la date de fin à chaque tour de
 * l'horloge d'affichage (une seconde) et à chaque retour au premier plan ; aucun compteur n'est tenu en JavaScript.
 */
export function TimerTestRow({ os, notifier, liveActivity }: Props) {
  const container = useAppContainer();
  const platformOs = os ?? (container.platform.os === 'ios' ? 'ios' : 'other');
  const timer = useMemo(
    () =>
      createSyntheticTimer({
        clock: container.clock,
        store: {
          read: () => container.data.repos.settings.get('timer.synthetic'),
          write: (value) => container.data.repos.settings.set('timer.synthetic', value),
        },
        liveActivity: liveActivity ?? platformLiveActivity,
        notifier: notifier ?? openTimerNotifier(container.platform.runtime, container.platform.os, systemNotificationClock),
        os: platformOs,
        label: tTimer('label'),
        notification: { title: tTimer('notificationTitle'), body: tTimer('notificationBody') },
      }),
    [container, liveActivity, notifier, platformOs],
  );

  const [state, setState] = useState<SyntheticTimerState | null>(null);
  const [report, setReport] = useState<TimerStartReport | null>(null);
  const [finished, setFinished] = useState(false);
  const [stopFailed, setStopFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => container.clock.nowMs());
  const live = useRef(true);

  const resume = useCallback(async () => {
    let result;
    try {
      result = await timer.resume();
    } catch {
      // Réglage illisible : dit, jamais une erreur non gérée.
      if (live.current) setFailed(true);
      return;
    }
    if (!live.current) return;
    setFailed(false);
    setNow(container.clock.nowMs());
    setState(result.state);
    if (result.phase === 'finished') {
      setFinished(true);
      setReport(null);
    }
  }, [timer, container.clock]);

  useEffect(() => {
    live.current = true;
    const first = setTimeout(() => void resume(), 0);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live.current = false;
      clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [resume]);

  // Horloge d'AFFICHAGE : elle ne fait que redessiner ; la valeur affichée est toujours fin - maintenant.
  useEffect(() => {
    if (state === null) return undefined;
    const id = setInterval(() => {
      const current = container.clock.nowMs();
      setNow(current);
      if (timerRemainingMs(state, current) === 0) void resume();
    }, 1000);
    return () => clearInterval(id);
  }, [state, container.clock, resume]);

  async function start(): Promise<void> {
    setFinished(false);
    setStopFailed(false);
    let result;
    try {
      result = await timer.start();
    } catch {
      if (live.current) setFailed(true);
      return;
    }
    if (!live.current) return;
    setFailed(false);
    setNow(container.clock.nowMs());
    setState(result.state);
    setReport(result);
  }

  async function stop(): Promise<void> {
    let result;
    try {
      result = await timer.stop();
    } catch {
      if (live.current) setFailed(true);
      return;
    }
    if (!live.current) return;
    setFailed(false);
    setState(null);
    setReport(null);
    setFinished(false);
    setStopFailed(!result.liveEnded);
  }

  const running = state !== null;
  return (
    <div className="ct-settings__row">
      <span className="ct-settings__stack">
        <span>{tTimer('row')}</span>
        {!running && !finished && <span className="ct-settings__hint">{tTimer('rowHint')}</span>}
        {running && (
          <span className="ct-settings__hint" role="timer" aria-live="off">
            {formatTimerRemaining(timerRemainingMs(state, now))}
          </span>
        )}
        {finished && (
          <span className="ct-settings__hint" role="status">
            {tTimer('finished')}
          </span>
        )}
        {running && report && <Explanation report={report} os={platformOs} />}
        {failed && (
          <span className="ct-settings__hint ct-settings__hint--danger" role="alert">
            {tTimer('failed')}
          </span>
        )}
        {stopFailed && (
          <span className="ct-settings__hint ct-settings__hint--danger" role="alert">
            {tTimer('stopFailed')}
          </span>
        )}
      </span>
      <span className="ct-settings__actions">
        {running ? (
          <Button variant="secondary" className="ct-settings__link" onClick={() => void stop()}>
            {tTimer('stop')}
          </Button>
        ) : (
          <Button variant="secondary" className="ct-settings__link" onClick={() => void start()}>
            {tTimer('start')}
          </Button>
        )}
      </span>
    </div>
  );
}

/** Dit ce qui est vraiment en place : notification (ou son refus), Live Activity (ou le repli et pourquoi). Rien n'est promis au-delà. */
function Explanation({ report, os }: { readonly report: TimerStartReport; readonly os: 'ios' | 'other' }) {
  const lines: { readonly text: string; readonly alert: boolean }[] = [];
  if (os !== 'ios') {
    lines.push({ text: tTimer('pcOnly'), alert: false });
  } else {
    if (report.notification === 'scheduled') lines.push({ text: tTimer('notificationScheduled'), alert: false });
    else if (report.notification === 'denied') lines.push({ text: tTimer('notificationDenied'), alert: true });
    else lines.push({ text: tTimer('notificationFailed'), alert: true });
    if (report.live === 'started') {
      lines.push({ text: tTimer('liveStarted'), alert: false });
    } else {
      lines.push({ text: report.live === 'failed' ? tTimer('liveFailed') : tTimer('liveUnavailable'), alert: false });
      if (report.live === 'unavailable') lines.push({ text: report.liveReason === 'disabled' ? tTimer('liveReasonDisabled') : tTimer('liveReasonUnknown'), alert: false });
      if (report.liveError) lines.push({ text: tTimer('nativeError', { domain: report.liveError.domain, code: report.liveError.code, description: report.liveError.description }), alert: false });
    }
  }
  return (
    <>
      {lines.map((line) => (
        <span key={line.text} className={line.alert ? 'ct-settings__hint ct-settings__hint--danger' : 'ct-settings__hint'} role={line.alert ? 'alert' : 'status'}>
          {line.text}
        </span>
      ))}
    </>
  );
}
