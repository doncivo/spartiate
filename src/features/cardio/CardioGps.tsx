import { useEffect, useRef, useState } from 'react';
import { addTrackPoint, emptyTrack, paceSecPerKm, type TrackState } from '../../domain/cardio';
import type { Clock } from '../../domain/clock';
import { formatChrono, formatDuration, formatKm, formatPace, kmValue, tCardio, type CardioTextKey } from '../../i18n/cardioText';
import type { GeoEvent, GeolocationLoader } from '../../platform/geolocation';
import { Button, HeroFigure } from '../../ui';
import type { GpsReport } from './CardioView';
import { lastKmSecPerKm, trackPath } from './gpsFigures';

/**
 * Suivi GPS d'une séance cardio sur l'iPhone (I6-06, D-222), AU PREMIER PLAN SEULEMENT : l'autorisation demandée est « pendant l'utilisation de
 * l'app », aucun mode d'arrière-plan. Au premier usage, la permission est demandée ; refusée ou indisponible, l'écran le dit et la saisie manuelle
 * reste là. « Arrêter et reporter » remplit le formulaire (début, durée, distance) et garde le tracé pour l'enregistrement (table locale). Aucune
 * coordonnée n'est affichée, journalisée ni envoyée. ERGO-02 (aperçu Cardio-apres, validé par Ali) : distance en chiffre héros, durée, allure, dernier
 * km et tracé SCHÉMATIQUE dessiné sur l'iPhone qui l'enregistre (aucune coordonnée en texte, rien de publié).
 */
type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'blocked'; readonly reason: 'gpsDenied' | 'gpsUnavailable' }
  | { readonly kind: 'running'; readonly startMs: number; readonly track: TrackState; readonly lost: boolean; readonly paused: boolean };

const TICK_MS = 1_000;
/** Boîte du tracé schématique (unités du viewBox). */
const TRACK_W = 392;
const TRACK_H = 260;

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
  const live = state.kind === 'running' ? state : null;
  const elapsedSec = live === null ? 0 : (clock.nowMs() - live.startMs) / 1000;
  const distanceM = live === null ? 0 : live.track.distanceM;
  const pace = paceSecPerKm(elapsedSec, distanceM > 0 ? distanceM : null);
  const lastKm = live === null ? null : lastKmSecPerKm(live.track.points);
  const signal: CardioTextKey =
    live === null ? 'gpsSignalWaiting' : live.paused ? 'gpsSignalPaused' : live.lost ? 'gpsSignalLost' : live.track.points.length === 0 ? 'gpsSignalWaiting' : 'gpsSignalGood';
  const path = live === null ? '' : trackPath(live.track.points, TRACK_W, TRACK_H, 16);
  return (
    <section className="ct-today__card ct-cardio__card ct-cardio__gps ct-flat" aria-labelledby="ct-cardio-gps">
      <div className="ct-cardio__gps-head">
        <h2 id="ct-cardio-gps" className="ct-cardio__heading ct-section-title">
          {tCardio('gpsTitle')}
        </h2>
        {live ? (
          <span className="ct-cardio__gps-signal" data-signal={signal === 'gpsSignalGood' ? 'good' : 'other'}>
            <span className="ct-cardio__gps-dot" aria-hidden="true" />
            {tCardio(signal)}
          </span>
        ) : null}
      </div>
      {live ? (
        <>
          {/* ERGO-02 (aperçu Cardio-apres) : distance en chiffre héros, puis durée, allure et dernier km ; « — » et sa raison si absent. */}
          <HeroFigure className="ct-cardio__gps-hero" value={kmValue(distanceM)} unit={tCardio('kmUnit')} />
          <ul className="ct-cardio__gps-stats" aria-label={tCardio('gpsStats')}>
            <li className="ct-cardio__gps-stat">
              <span className="ct-cardio__gps-stat-value">{formatChrono(elapsedSec)}</span>
              <span className="ct-cardio__gps-stat-label">{tCardio('gpsStatDuration')}</span>
            </li>
            <li className="ct-cardio__gps-stat">
              <span className="ct-cardio__gps-stat-value">{pace === null ? '—' : formatPace(pace)}</span>
              <span className="ct-cardio__gps-stat-label">{tCardio(pace === null ? 'gpsPaceNone' : 'gpsStatPace')}</span>
            </li>
            <li className="ct-cardio__gps-stat">
              <span className="ct-cardio__gps-stat-value">{lastKm === null ? '—' : formatPace(lastKm)}</span>
              <span className="ct-cardio__gps-stat-label">{tCardio(lastKm === null ? 'gpsLastKmPending' : 'gpsStatLastKm')}</span>
            </li>
          </ul>
          {path === '' ? null : (
            <figure className="ct-cardio__gps-map">
              <svg className="ct-cardio__gps-track" viewBox={`0 0 ${String(TRACK_W)} ${String(TRACK_H)}`} role="img" aria-label={tCardio('gpsTrack')}>
                <path d={path} />
              </svg>
              <figcaption className="ct-today__muted">{tCardio('gpsTrackNote')}</figcaption>
            </figure>
          )}
          <p className="ct-visually-hidden" role="status">
            {live.track.points.length === 0 ? line('gpsWaiting') : tCardio('gpsRunning', { duration: formatDuration(elapsedSec), distance: formatKm(distanceM) })}
          </p>
          {live.paused ? <p className="ct-cardio__message">{line('gpsPaused')}</p> : live.lost ? <p className="ct-cardio__message">{line('gpsLost')}</p> : null}
          <div className="ct-cardio__gps-actions">
            <Button variant="secondary" onClick={() => void finish(false)}>
              {tCardio('gpsCancel')}
            </Button>
            <Button onClick={() => void finish(true)}>{tCardio('gpsStop')}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="ct-today__muted">{tCardio('gpsHint')}</p>
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
