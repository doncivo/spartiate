import { useEffect, useRef, useState } from 'react';
import { addTrackPoint, emptyTrack, type TrackState } from '../../domain/cardio';
import type { Clock } from '../../domain/clock';
import { formatDuration, formatKm, tCardio, type CardioTextKey } from '../../i18n/cardioText';
import type { GeoEvent, GeolocationLoader } from '../../platform/geolocation';
import { Button } from '../../ui';
import type { GpsReport } from './CardioView';

/**
 * Suivi GPS d'une séance cardio sur l'iPhone (I6-06, D-222), AU PREMIER PLAN SEULEMENT : l'autorisation demandée est « pendant l'utilisation de
 * l'app », aucun mode d'arrière-plan. Au premier usage, la permission est demandée ; refusée ou indisponible, l'écran le dit et la saisie manuelle
 * reste là. « Arrêter et reporter » remplit le formulaire (début, durée, distance) et garde le tracé pour l'enregistrement (table locale). Aucune
 * position n'est affichée, journalisée ni envoyée : l'écran montre la durée et la distance seulement.
 */
type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'blocked'; readonly reason: 'gpsDenied' | 'gpsUnavailable' }
  | { readonly kind: 'running'; readonly startMs: number; readonly track: TrackState; readonly lost: boolean; readonly paused: boolean };

const TICK_MS = 1_000;

export function CardioGps({ load, clock, onReport }: { readonly load: GeolocationLoader; readonly clock: Clock; readonly onReport: (report: GpsReport) => void }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [, setTick] = useState(0);
  const stopRef = useRef<(() => Promise<void>) | null>(null);

  const stopWatch = async (): Promise<void> => {
    const stop = stopRef.current;
    stopRef.current = null;
    if (stop) await stop();
  };

  useEffect(
    () => () => {
      void stopWatch();
    },
    [],
  );

  const running = state.kind === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setTick((n) => n + 1), TICK_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') setState((s) => (s.kind === 'running' ? { ...s, paused: true } : s));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running]);

  const onEvent = (event: GeoEvent): void => {
    if (event.kind === 'error') {
      if (event.code === 'denied') {
        void stopWatch();
        setState({ kind: 'blocked', reason: 'gpsDenied' });
      } else setState((s) => (s.kind === 'running' ? { ...s, lost: true } : s));
      return;
    }
    setState((s) => (s.kind === 'running' ? { ...s, track: addTrackPoint(s.track, event.fix), lost: false, paused: false } : s));
  };

  const start = async (): Promise<void> => {
    setState({ kind: 'starting' });
    try {
      const geo = await load();
      let permission = await geo.permission();
      if (permission === 'prompt') permission = await geo.request();
      if (permission !== 'granted') {
        setState({ kind: 'blocked', reason: geo.available ? 'gpsDenied' : 'gpsUnavailable' });
        return;
      }
      setState({ kind: 'running', startMs: clock.nowMs(), track: emptyTrack(), lost: false, paused: false });
      stopRef.current = await geo.watch(onEvent);
    } catch {
      await stopWatch();
      setState({ kind: 'blocked', reason: 'gpsUnavailable' });
    }
  };

  const finish = async (report: boolean): Promise<void> => {
    const current = state;
    await stopWatch();
    setState({ kind: 'idle' });
    if (!report || current.kind !== 'running') return;
    const durationSec = Math.max(1, Math.round((clock.nowMs() - current.startMs) / 1000));
    onReport({ startedAt: new Date(current.startMs).toISOString(), durationSec, distanceM: Math.round(current.track.distanceM), track: current.track.points });
  };

  const line = (key: CardioTextKey): string => tCardio(key);
  return (
    <section className="ct-today__card ct-cardio__card ct-cardio__gps" aria-labelledby="ct-cardio-gps">
      <h2 id="ct-cardio-gps" className="ct-cardio__heading">
        {tCardio('gpsTitle')}
      </h2>
      <p className="ct-today__muted">{tCardio('gpsHint')}</p>
      {state.kind === 'running' ? (
        <>
          <p className="ct-cardio__gps-live" role="status">
            {state.track.points.length === 0 ? line('gpsWaiting') : tCardio('gpsRunning', { duration: formatDuration((clock.nowMs() - state.startMs) / 1000), distance: formatKm(state.track.distanceM) })}
          </p>
          {state.paused ? <p className="ct-cardio__message">{line('gpsPaused')}</p> : state.lost ? <p className="ct-cardio__message">{line('gpsLost')}</p> : null}
          <div className="ct-cardio__gps-actions">
            <Button onClick={() => void finish(true)}>{tCardio('gpsStop')}</Button>
            <Button variant="secondary" onClick={() => void finish(false)}>
              {tCardio('gpsCancel')}
            </Button>
          </div>
        </>
      ) : (
        <>
          {state.kind === 'blocked' ? (
            <p className="ct-cardio__message" role="alert">
              {line(state.reason)}
            </p>
          ) : null}
          <Button onClick={() => void start()} disabled={state.kind === 'starting'}>
            {tCardio('gpsStart')}
          </Button>
        </>
      )}
    </section>
  );
}
