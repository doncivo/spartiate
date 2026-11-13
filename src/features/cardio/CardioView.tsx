import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  CARDIO_KINDS,
  formatDurationText,
  paceSecPerKm,
  parseAvgHrText,
  parseDistanceKmText,
  parseDurationText,
  validateCardioSession,
  type CardioIssue,
  type CardioKind,
  type CardioSessionInput,
  type CardioSource,
  type TrackPoint,
} from '../../domain/cardio';
import { localToUtcMs, nowTimeIn, todayIn, utcToLocal } from '../../domain/timeZone';
import { isLocalDate, isLocalTime } from '../../domain/types';
import type { CardioSessionRecord } from '../../db/repositories';
import { formatKm, formatDuration, formatPace, tCardio, type CardioTextKey } from '../../i18n/cardioText';
import { formatDayMonthYear, formatTime } from '../../i18n/format';
import { geolocationExpected, resolveGeolocation } from '../../platform/geolocation';
import { detectTimeZone } from '../../platform/timeZone';
import { Button, ConfirmDialog } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { CardioGps } from './CardioGps';
import './Cardio.css';

/**
 * Entraînement › Cardio (I6-06, D-221 à D-224) : saisie d'une séance (type, début, durée, distance et FC facultatives, ressenti, notes), historique
 * (modifier, supprimer avec confirmation). Règles dans `src/domain/cardio`, lecture et écriture par le dépôt `cardio`. Bloc chargé à la demande avec
 * son catalogue de textes. Distances en km, heures en 24 h, aucune couleur seule ; cibles de 44 pt ; saisie au clavier (formulaire, Entrée).
 * `gps` : bloc facultatif rendu au-dessus du formulaire (suivi GPS de l'iPhone, D-222) ; il reporte durée, distance et tracé dans le formulaire.
 */

export const KIND_TEXT = {
  walk: 'kind_walk',
  run: 'kind_run',
  bike: 'kind_bike',
  row: 'kind_row',
  elliptical: 'kind_elliptical',
  skierg: 'kind_skierg',
  other: 'kind_other',
} as const satisfies Record<CardioKind, CardioTextKey>;

const ISSUE_TEXT: Record<Exclude<CardioIssue, 'kind' | 'source'>, CardioTextKey> = {
  start: 'errorStart',
  future: 'errorFuture',
  duration: 'errorDurationRange',
  distance: 'errorDistanceRange',
  avgHr: 'errorAvgHrRange',
  rpe: 'errorRpe',
  notes: 'errorNotes',
};

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Report du suivi GPS dans le formulaire : début, durée, distance et tracé (gardé sur l'appareil). */
export interface GpsReport {
  readonly startedAt: string;
  readonly durationSec: number;
  readonly distanceM: number;
  readonly track: readonly TrackPoint[];
}

export interface CardioViewProps {
  /** Fuseau de l'appareil (tests) ; défaut : celui du système. */
  readonly timeZone?: string;
  /** Bloc GPS (iPhone) ; reçoit `onReport` pour remplir le formulaire. */
  readonly gps?: (onReport: (report: GpsReport) => void) => ReactNode;
}

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly sessions: readonly CardioSessionRecord[];
    };
type Message = { readonly alert: boolean; readonly text: string } | null;

interface Form {
  readonly kind: CardioKind;
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly distance: string;
  readonly avgHr: string;
  readonly rpe: number | null;
  readonly notes: string;
  readonly source: CardioSource;
  readonly track: readonly TrackPoint[] | null;
}

/** Distance en km pour le champ, au mètre près (« 7,5 », « 0,222 ») : relue telle quelle par `parseDistanceKmText`. */
const kmText = (meters: number | null): string => (meters === null ? '' : String(Math.round(meters) / 1000).replace('.', ','));

export function CardioView({ timeZone, gps }: CardioViewProps) {
  const container = useAppContainer();
  const tz = timeZone ?? detectTimeZone() ?? 'Europe/Paris';
  const synced = useSyncedData(['cardio_session']);
  const blank = useCallback(
    (): Form => ({
      kind: 'run',
      date: todayIn(container.clock, tz),
      time: nowTimeIn(container.clock, tz),
      duration: '',
      distance: '',
      avgHr: '',
      rpe: null,
      notes: '',
      source: 'manual',
      track: null,
    }),
    [container, tz],
  );
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirming, setConfirming] = useState<CardioSessionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]): void => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    let live = true;
    void (async () => (await container.data.repos.cardio()).list())().then(
      (sessions) => {
        if (live) setLoad({ status: 'ready', sessions });
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, synced, attempt]);

  const reload = (): void => setAttempt((n) => n + 1);

  /** Champs du formulaire → séance, ou le premier message d'erreur. */
  const read = (): { readonly ok: true; readonly input: CardioSessionInput } | { readonly ok: false; readonly text: string } => {
    const duration = parseDurationText(form.duration);
    if (!duration.ok)
      return {
        ok: false,
        text: tCardio(duration.issue === 'empty' ? 'errorDurationEmpty' : duration.issue === 'format' ? 'errorDurationFormat' : 'errorDurationRange'),
      };
    const distance = parseDistanceKmText(form.distance);
    if (!distance.ok)
      return {
        ok: false,
        text: tCardio(distance.issue === 'format' ? 'errorDistanceFormat' : 'errorDistanceRange'),
      };
    const hr = parseAvgHrText(form.avgHr);
    if (!hr.ok)
      return {
        ok: false,
        text: tCardio(hr.issue === 'format' ? 'errorAvgHrFormat' : 'errorAvgHrRange'),
      };
    if (form.rpe === null) return { ok: false, text: tCardio('errorRpe') };
    const time = form.time.trim();
    if (!isLocalDate(form.date) || !isLocalTime(time)) return { ok: false, text: tCardio('errorStart') };
    const startMs = localToUtcMs(form.date, time, tz);
    const input: CardioSessionInput = {
      kind: form.kind,
      startedAt: new Date(startMs).toISOString(),
      durationSec: duration.value,
      distanceM: distance.value,
      avgHr: hr.value,
      rpe: form.rpe,
      notes: form.notes.trim(),
      source: form.source,
    };
    const issue = validateCardioSession(input, new Date(container.clock.nowMs()).toISOString()).find((i): i is Exclude<CardioIssue, 'kind' | 'source'> => i !== 'kind' && i !== 'source');
    return issue === undefined ? { ok: true, input } : { ok: false, text: tCardio(ISSUE_TEXT[issue]) };
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const result = read();
    if (!result.ok) {
      setMessage({ alert: true, text: result.text });
      return;
    }
    setBusy(true);
    try {
      const repo = await container.data.repos.cardio();
      if (editing === null) await repo.add(result.input, form.track);
      else await repo.update(editing, result.input);
      setMessage({
        alert: false,
        text: tCardio(editing === null ? 'saved' : 'updated'),
      });
      setEditing(null);
      setForm(blank());
      reload();
    } catch {
      setMessage({ alert: true, text: tCardio('saveFailed') });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: CardioSessionRecord): void => {
    const local = utcToLocal(s.startedAt, tz);
    setEditing(s.id);
    setMessage(null);
    setForm({
      kind: s.kind,
      date: local.date,
      time: local.time,
      duration: formatDurationText(s.durationSec),
      distance: kmText(s.distanceM),
      avgHr: s.avgHr === null ? '' : String(s.avgHr),
      rpe: s.rpe,
      notes: s.notes,
      source: s.source,
      track: null,
    });
  };

  const remove = async (s: CardioSessionRecord): Promise<void> => {
    setConfirming(null);
    try {
      await (await container.data.repos.cardio()).remove(s.id);
      if (editing === s.id) {
        setEditing(null);
        setForm(blank());
      }
      setMessage({ alert: false, text: tCardio('deleted') });
    } catch {
      setMessage({ alert: true, text: tCardio('saveFailed') });
    }
    reload();
  };

  const onReport = (report: GpsReport): void => {
    const local = utcToLocal(report.startedAt, tz);
    setEditing(null);
    setForm((f) => ({
      ...f,
      date: local.date,
      time: local.time,
      duration: formatDurationText(report.durationSec),
      distance: report.distanceM > 0 ? kmText(report.distanceM) : '',
      source: 'gps',
      track: report.track,
    }));
    setMessage({ alert: false, text: tCardio('gpsReported') });
  };

  // I6-06 (D-222) : bloc GPS sur l'iPhone installé seulement (le PC n'a pas de GPS : saisie manuelle, aucun bouton).
  const { runtime, os } = container.platform;
  const gpsBlock = gps ?? (geolocationExpected(runtime, os) ? (report: (r: GpsReport) => void) => <CardioGps load={resolveGeolocation(runtime, os)} clock={container.clock} onReport={report} /> : undefined);

  const dateOf = (s: CardioSessionRecord): string => formatDayMonthYear(utcToLocal(s.startedAt, tz).date);

  return (
    <div className="ct-cardio">
      <p className="ct-today__muted">{tCardio('hint')}</p>
      {gpsBlock ? gpsBlock(onReport) : null}

      <section className="ct-today__card ct-cardio__card" aria-labelledby="ct-cardio-form">
        <h2 id="ct-cardio-form" className="ct-cardio__heading">
          {tCardio(editing === null ? 'formTitle' : 'editTitle')}
        </h2>
        <form className="ct-cardio__form" onSubmit={(event) => void submit(event)} noValidate>
          <label className="ct-cardio__field">
            <span className="ct-cardio__label">{tCardio('kindLabel')}</span>
            <select className="ct-cardio__input" value={form.kind} onChange={(e) => set('kind', e.target.value as CardioKind)}>
              {CARDIO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {tCardio(KIND_TEXT[k])}
                </option>
              ))}
            </select>
          </label>
          <label className="ct-cardio__field">
            <span className="ct-cardio__label">{tCardio('dateLabel')}</span>
            <input className="ct-cardio__input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className="ct-cardio__field">
            <span className="ct-cardio__label">{tCardio('timeLabel')}</span>
            <input className="ct-cardio__input" inputMode="numeric" autoComplete="off" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </label>
          <label className="ct-cardio__field">
            <span className="ct-cardio__label">{tCardio('durationLabel')}</span>
            <input className="ct-cardio__input" inputMode="numeric" autoComplete="off" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
          </label>
          <label className="ct-cardio__field">
            <span className="ct-cardio__label">{tCardio('distanceLabel')}</span>
            <input className="ct-cardio__input" inputMode="decimal" autoComplete="off" value={form.distance} onChange={(e) => set('distance', e.target.value)} />
          </label>
          <label className="ct-cardio__field">
            <span className="ct-cardio__label">{tCardio('avgHrLabel')}</span>
            <input className="ct-cardio__input" inputMode="numeric" autoComplete="off" value={form.avgHr} onChange={(e) => set('avgHr', e.target.value)} />
          </label>
          <div className="ct-cardio__field">
            <label className="ct-cardio__field">
              <span className="ct-cardio__label">{tCardio('rpeLabel')}</span>
              <select
                className="ct-cardio__input"
                value={form.rpe === null ? '' : String(form.rpe)}
                aria-describedby="ct-cardio-rpe-hint"
                onChange={(e) => set('rpe', e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">—</option>
                {RPE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <span id="ct-cardio-rpe-hint" className="ct-today__muted">
              {tCardio('rpeHint')}
            </span>
          </div>
          <label className="ct-cardio__field ct-cardio__field--wide">
            <span className="ct-cardio__label">{tCardio('notesLabel')}</span>
            <textarea className="ct-cardio__input ct-cardio__notes" value={form.notes} maxLength={2000} onChange={(e) => set('notes', e.target.value)} />
          </label>
          <Button type="submit" className="ct-cardio__save" disabled={busy}>
            {tCardio(editing === null ? 'save' : 'saveEdit')}
          </Button>
          {editing !== null ? (
            <Button
              variant="secondary"
              className="ct-cardio__save"
              onClick={() => {
                setEditing(null);
                setForm(blank());
                setMessage(null);
              }}
            >
              {tCardio('cancelEdit')}
            </Button>
          ) : null}
        </form>
        {message && (
          <p className="ct-cardio__message" role={message.alert ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
      </section>

      <section className="ct-today__card ct-cardio__card" aria-labelledby="ct-cardio-list">
        <h2 id="ct-cardio-list" className="ct-cardio__heading">
          {tCardio('listTitle')}
        </h2>
        {load.status === 'loading' ? (
          <p className="ct-today__muted" role="status">
            {tCardio('loading')}
          </p>
        ) : load.status === 'failed' ? (
          <div role="alert">
            <p>{tCardio('loadFailed')}</p>
            <Button variant="secondary" onClick={reload}>
              {tCardio('retry')}
            </Button>
          </div>
        ) : load.sessions.length === 0 ? (
          <p className="ct-today__muted">{tCardio('listEmpty')}</p>
        ) : (
          <ul className="ct-cardio__list">
            {load.sessions.map((s) => {
              const pace = paceSecPerKm(s.durationSec, s.distanceM);
              const extra = [
                s.avgHr === null ? null : tCardio('sessionHr', { hr: s.avgHr }),
                pace === null ? null : tCardio('sessionPace', { pace: formatPace(pace) }),
                s.source === 'gps' ? tCardio('sourceGps') : null,
                s.hasTrack ? tCardio('trackHere') : null,
              ].filter((x): x is string => x !== null);
              return (
                <li key={s.id} className="ct-cardio__item">
                  <div className="ct-cardio__item-text">
                    <span className="ct-cardio__item-title">
                      {tCardio('sessionLine', {
                        date: dateOf(s),
                        time: formatTime(utcToLocal(s.startedAt, tz).time),
                        kind: tCardio(KIND_TEXT[s.kind]),
                      })}
                    </span>
                    <span className="ct-cardio__value">
                      {s.distanceM === null
                        ? tCardio('sessionDetailNoDistance', {
                            duration: formatDuration(s.durationSec),
                            rpe: s.rpe,
                          })
                        : tCardio('sessionDetail', {
                            duration: formatDuration(s.durationSec),
                            distance: formatKm(s.distanceM),
                            rpe: s.rpe,
                          })}
                    </span>
                    {extra.length > 0 ? <span className="ct-today__muted">{extra.join(' · ')}</span> : null}
                    {s.notes !== '' ? <span className="ct-cardio__notes-text">{s.notes}</span> : null}
                  </div>
                  <div className="ct-cardio__actions">
                    <Button variant="secondary" ariaLabel={tCardio('editAria', { date: dateOf(s) })} onClick={() => startEdit(s)}>
                      {tCardio('edit')}
                    </Button>
                    <Button variant="secondary" ariaLabel={tCardio('removeAria', { date: dateOf(s) })} onClick={() => setConfirming(s)}>
                      {tCardio('remove')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirming ? (
        <ConfirmDialog
          title={tCardio('confirmTitle')}
          description={tCardio('confirmBody', { date: dateOf(confirming) })}
          confirmLabel={tCardio('confirmYes')}
          cancelLabel={tCardio('confirmNo')}
          onConfirm={() => void remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}
