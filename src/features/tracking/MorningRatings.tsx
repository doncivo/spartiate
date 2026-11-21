import { useEffect, useId, useRef, useState } from 'react';
import { RATING_KINDS, RATING_MAX, RATING_MIN, type RatingKind } from '../../domain/bodyProgress/measurements';
import type { LocalDate } from '../../domain/types';
import { tTracking } from '../../i18n/trackingText';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';

/**
 * SUIVIS-029c : notes du matin sur Aujourd'hui (fatigue, qualité du sommeil), de 1 à 10 en un geste. Facultatif, jamais bloquant, une note par jour et
 * par genre (`measurement`, identifiant naturel par date), modifiable le jour même ; « Effacer » la retire. Les valeurs ne sont ni journalisées ni
 * envoyées ; elles n'entrent pas dans la récupération.
 */
type Values = Readonly<Record<RatingKind, number | null>>;
const NONE: Values = { note_fatigue: null, note_sleep: null };
const SCALE = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

async function readValues(container: ReturnType<typeof useAppContainer>, today: LocalDate): Promise<Values> {
  const repo = await container.data.repos.measurements();
  const [fatigue, sleep] = await Promise.all(RATING_KINDS.map((k) => repo.find(today, k)));
  const live = (r: typeof fatigue): number | null => (r === null || r === undefined || r.deletedAt !== null ? null : r.value);
  return { note_fatigue: live(fatigue), note_sleep: live(sleep) };
}

export function MorningRatings({ today }: { readonly today: LocalDate }) {
  const container = useAppContainer();
  const id = useId();
  const synced = useSyncedData(['measurement']);
  const [values, setValues] = useState<Values>(NONE);
  const [failed, setFailed] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** Gestes en cours : une lecture commencée avant un geste ne remplace jamais la valeur touchée (relue une fois la file vidée). */
  const pending = useRef(0);

  useEffect(() => {
    let live = true;
    readValues(container, today).then(
      (v) => {
        if (live && pending.current === 0) {
          setValues(v);
          setReadFailed(false);
        }
      },
      () => {
        if (live) setReadFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced, epoch]);

  /** Écritures enchaînées dans l'ordre des gestes ; un échec le dit et l'écran relit l'état enregistré. */
  const write = (kind: RatingKind, value: number | null): void => {
    setValues((v) => ({ ...v, [kind]: value }));
    setFailed(false);
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        const repo = await container.data.repos.measurements();
        if (value === null) await repo.remove(today, kind);
        else await repo.save(today, kind, value);
      } catch {
        setFailed(true);
      }
      pending.current -= 1;
      if (pending.current === 0) setEpoch((n) => n + 1);
    });
  };

  return (
    <div className="ct-tracking__block">
      <h3 className="ct-today__eyebrow ct-section-title">{tTracking('ratingsTitle')}</h3>
      <p className="ct-today__muted">{tTracking('ratingsHint')}</p>
      {RATING_KINDS.map((kind) => {
        const label = tTracking(`rating_${kind}`);
        const current = values[kind];
        return (
          <div key={kind} className="ct-tracking__block">
            <div role="group" aria-labelledby={`${id}-${kind}`} aria-describedby={`${id}-${kind}-scale`} className="ct-tracking__block">
              <p id={`${id}-${kind}`} className="ct-tracking__value">
                {label}
              </p>
              <p id={`${id}-${kind}-scale`} className="ct-today__muted">
                {tTracking(`rating_${kind}_scale`)}
              </p>
              <div className="ct-tracking__scale">
                {SCALE.map((n) => (
                  <button key={n} type="button" className="ct-tracking__score" aria-pressed={current === n} aria-label={tTracking('ratingButton', { label, n })} onClick={() => write(kind, n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="ct-today__muted">
              {current === null ? tTracking('ratingUnset') : tTracking('ratingCurrent', { n: current })}
              {current === null ? null : (
                <>
                  {' '}
                  <button type="button" className="ct-tracking__score ct-tracking__clear" aria-label={tTracking('ratingClearLabel', { label })} onClick={() => write(kind, null)}>
                    {tTracking('ratingClear')}
                  </button>
                </>
              )}
            </p>
          </div>
        );
      })}
      {readFailed ? (
        <p className="ct-today__muted" role="status">
          {tTracking('ratingsReadFailed')}
        </p>
      ) : null}
      {failed ? (
        <p className="ct-tracking__issue" role="alert">
          {tTracking('ratingSaveFailed')}
        </p>
      ) : null}
    </div>
  );
}
