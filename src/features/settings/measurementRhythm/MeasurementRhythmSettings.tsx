import { useEffect, useRef, useState } from 'react';
import { DEFAULT_MEASUREMENT_RHYTHM_DAYS, MEASUREMENT_RHYTHMS_DAYS, measurementSchedule, parseMeasurementRhythm, type MeasurementRhythmDays } from '../../../domain/bodyProgress/measurementSchedule';
import { todayLocal } from '../../../domain/clock';
import type { LocalDate } from '../../../domain/types';
import { tMeasurementRhythm } from '../../../i18n/measurementRhythmText';
import { tPlural } from '../../../i18n/plural';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { Switch } from '../../../ui/Switch';
import { useAppContainer } from '../../app/AppContainerContext';
import { measurementNotificationsFor } from '../../notifications';
import type { MeasurementNotificationResult, MeasurementPrefs } from '../../notifications/measurementNotifications';

export interface MeasurementRhythmProps {
  /** Lignes de `measurement` déjà lues par l'écran Mesures (genre et jour) : relues à chaque saisie, sans seconde lecture ici. */
  readonly samples: readonly { readonly kind: string; readonly day: LocalDate }[];
}

const RHYTHM_TEXT = { 7: 'rhythm_7', 14: 'rhythm_14', 28: 'rhythm_28' } as const satisfies Record<MeasurementRhythmDays, string>;

function lastText(daysSince: number): string {
  if (daysSince <= 0) return tMeasurementRhythm('lastToday');
  return tPlural(tMeasurementRhythm, daysSince, 'lastOne', 'lastMany');
}

function nextText(daysUntil: number): string {
  if (daysUntil <= 0) return tMeasurementRhythm('nextToday');
  return tPlural(tMeasurementRhythm, daysUntil, 'nextOne', 'nextMany');
}

/** État du rappel dit en texte (PC, autorisation, échec, fuseau illisible) ; rien quand il est posé ou coupé. */
function reminderNote(result: MeasurementNotificationResult | null): string | null {
  if (result === null) return null;
  if (result.status === 'unsupported') return tMeasurementRhythm('reminderPc');
  if (result.saveFailed === true) return null;
  if (result.status === 'permission') return tMeasurementRhythm('reminderPermission');
  if (result.status === 'failed' || result.status === 'no-zone') return tMeasurementRhythm('reminderFailed');
  return null;
}

/** Service du conteneur, importé avec ce bloc (déjà à la demande) : aucun second chargement avant d'afficher l'état du rappel. */
const loadService = (container: ReturnType<typeof useAppContainer>) => Promise.resolve().then(() => measurementNotificationsFor(container));

/**
 * Corps › Mesures, rythme des mesures (CORPS-0301d, BL-180 ; D-713, D-714, D-760 à D-764) : rythme local (7, 14 ou 28 jours), « dernière séance
 * de mesures il y a N jours », « prochaine conseillée dans N jours » (calcul pur `measurementSchedule`), interrupteur du rappel de l'iPhone. Le PC
 * montre le rythme et les phrases et dit que le rappel est émis sur l'iPhone (planificateur vide : rien n'est envoyé). Bloc à la demande avec son
 * catalogue ; une écriture impossible est dite à l'écran.
 */
export function MeasurementRhythmSettings({ samples }: MeasurementRhythmProps) {
  const container = useAppContainer();
  const today = todayLocal(container.clock);
  const [prefs, setPrefs] = useState<MeasurementPrefs>({ rhythm: DEFAULT_MEASUREMENT_RHYTHM_DAYS, reminder: true });
  const [result, setResult] = useState<MeasurementNotificationResult | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Relecture (point 4) : une lecture des réglages arrivée après un choix de l'utilisateur ne l'écrase pas.
  const touched = useRef(false);
  const schedule = measurementSchedule(
    samples.map((s) => ({ kind: s.kind, date: s.day })),
    prefs.rhythm,
    today,
  );
  // Une nouvelle séance saisie (ou supprimée) déplace l'échéance : le rappel est replanifié.
  const lastKey = schedule.status === 'scheduled' ? schedule.last : 'none';

  useEffect(() => {
    let live = true;
    void loadService(container)
      .then(async (service) => {
        const read = await service.readPrefs();
        if (live && !touched.current) setPrefs(read);
        const replanned = await service.replan();
        if (live) setResult(replanned);
      })
      // Service introuvable (bloc non chargé) : l'échec est dit à l'écran, jamais avalé.
      .catch(() => {
        if (live) setResult({ status: 'failed', planned: 0, reason: 'unknown' });
      });
    return () => {
      live = false;
    };
  }, [container, lastKey]);

  const save = async (next: MeasurementPrefs, askPermission: boolean): Promise<void> => {
    const previous = prefs;
    touched.current = true;
    setPrefs(next);
    const done = await loadService(container).then(
      (service) => service.savePrefs(next, { askPermission }),
      (): MeasurementNotificationResult => ({ status: 'failed', planned: 0, reason: 'unknown', saveFailed: true }),
    );
    if (done.saveFailed === true) {
      setPrefs(previous);
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    setResult(done);
  };

  const note = reminderNote(result);
  // Relecture (point 1) : l'interrupteur se décide dès l'affichage, d'après la plateforme ; le PC dit que le rappel est émis sur l'iPhone.
  const pc = container.platform.os !== 'ios' || result?.status === 'unsupported';
  return (
    <section className="ct-flat" aria-labelledby="ct-measurement-rhythm">
      <h3 id="ct-measurement-rhythm" className="ct-section-title">
        {tMeasurementRhythm('title')}
      </h3>
      {schedule.status === 'none' ? (
        <p className="ct-today__text">{tMeasurementRhythm('none')}</p>
      ) : (
        <>
          <p className="ct-today__text">{lastText(schedule.daysSince)}</p>
          <p className="ct-today__text">{nextText(schedule.daysUntil)}</p>
        </>
      )}
      <SegmentedControl
        label={tMeasurementRhythm('title')}
        options={MEASUREMENT_RHYTHMS_DAYS.map((days) => ({ value: String(days), label: tMeasurementRhythm(RHYTHM_TEXT[days]) }))}
        value={String(prefs.rhythm)}
        onChange={(value) => void save({ ...prefs, rhythm: parseMeasurementRhythm(value) }, false)}
      />
      {!pc ? (
        <>
          <Switch checked={prefs.reminder} label={tMeasurementRhythm('reminderLabel')} onChange={(reminder) => void save({ ...prefs, reminder }, reminder)} />
          <p className="ct-today__muted">{tMeasurementRhythm('reminderHint')}</p>
        </>
      ) : null}
      {note !== null ? (
        <p role="status" className="ct-today__muted">
          {note}
        </p>
      ) : null}
      {saveFailed ? (
        <p role="alert" className="ct-today__text">
          {tMeasurementRhythm('saveFailed')}
        </p>
      ) : null}
    </section>
  );
}
