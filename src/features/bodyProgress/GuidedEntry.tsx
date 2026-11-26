import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MEASUREMENT_BOUNDS_CM, MEASUREMENT_KINDS, validateMeasurement, type MeasurementIssue, type MeasurementKind } from '../../domain/bodyProgress';
import { isLocalDate, type LocalDate } from '../../domain/types';
import { formatDayMonthYear } from '../../i18n/format';
import { formatCm, tBodyProgress, type BodyProgressPlainKey } from '../../i18n/bodyProgressText';
import { Button } from '../../ui';
import { KIND_TEXT } from './BodyZones';
import type { ZonePoint } from './bodyZone';

/**
 * CORPS-0301c (D-709, D-719 point 4) : saisie guidée des 11 zones à la suite, à une seule date choisie au début (aujourd'hui par défaut,
 * jamais future). « Suivant » valide et enregistre la zone (rien n'est perdu si la saisie s'interrompt) ; « Passer » n'écrit rien ; une mesure
 * déjà saisie à cette date est rappelée et préremplie, puis remplacée (même identifiant naturel). Un résumé termine la séance. Validation et
 * bornes : `validateMeasurement` (domaine pur) ; écriture par le dépôt reçu (`save`).
 */

const TIP_TEXT = {
  neck: 'tip_neck',
  shoulders: 'tip_shoulders',
  chest: 'tip_chest',
  waist: 'tip_waist',
  hips: 'tip_hips',
  arm_left: 'tip_arm_left',
  arm_right: 'tip_arm_right',
  thigh_left: 'tip_thigh_left',
  thigh_right: 'tip_thigh_right',
  calf_left: 'tip_calf_left',
  calf_right: 'tip_calf_right',
} as const satisfies Record<MeasurementKind, BodyProgressPlainKey>;

const ISSUE_TEXT: Record<Exclude<MeasurementIssue, 'range'>, BodyProgressPlainKey> = { empty: 'errorEmpty', format: 'errorFormat', date: 'errorDate', future: 'errorFuture' };

type Stage = { readonly step: 'date' } | { readonly step: 'zone'; readonly index: number } | { readonly step: 'done' };

export interface GuidedEntryProps {
  readonly today: LocalDate;
  /** Mesures saisies de chaque zone (toutes dates), pour rappeler la dernière valeur et celle déjà saisie à la date choisie. */
  readonly pointsOf: (kind: MeasurementKind) => readonly ZonePoint[];
  readonly save: (date: LocalDate, kind: MeasurementKind, value: number) => Promise<void>;
  readonly onClose: () => void;
}

export function GuidedEntry({ today, pointsOf, save, onClose }: GuidedEntryProps) {
  const [stage, setStage] = useState<Stage>({ step: 'date' });
  const [date, setDate] = useState<LocalDate>(today);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const kind = stage.step === 'zone' ? MEASUREMENT_KINDS[stage.index] : undefined;

  // Dernière valeur avant la date de la séance, et valeur déjà saisie à cette date (rappelée, préremplie).
  const points = kind === undefined ? [] : [...pointsOf(kind)].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const existing = points.find((p) => p.date === date) ?? null;
  const previous = points.filter((p) => p.date < date).at(-1) ?? null;

  const index = stage.step === 'zone' ? stage.index : -1;
  useEffect(() => {
    if (index >= 0) input.current?.focus();
  }, [index]);

  /** Ouvre la zone `at` : la valeur déjà saisie à la date de la séance est préremplie (D-719), sinon le champ est vide. */
  const open = (at: number): void => {
    const zone = MEASUREMENT_KINDS[at];
    const there = zone === undefined ? undefined : pointsOf(zone).find((p) => p.date === date);
    setText(there === undefined ? '' : formatCm(there.value));
    setError(null);
    setStage(zone === undefined ? { step: 'done' } : { step: 'zone', index: at });
  };
  const advance = (from: number): void => open(from + 1);

  const begin = (event: FormEvent): void => {
    event.preventDefault();
    if (!isLocalDate(date)) {
      setError(tBodyProgress('errorDate'));
      return;
    }
    if (date > today) {
      setError(tBodyProgress('errorFuture'));
      return;
    }
    open(0);
  };

  const next = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (stage.step !== 'zone' || kind === undefined || busy) return;
    const result = validateMeasurement(kind, text, date, today);
    if (!result.ok) {
      const { min, max } = MEASUREMENT_BOUNDS_CM[kind];
      setError(result.reason === 'range' ? tBodyProgress('errorRange', { min, max }) : tBodyProgress(ISSUE_TEXT[result.reason]));
      return;
    }
    setBusy(true);
    try {
      await save(date, kind, result.value);
      setSaved((n) => n + 1);
      advance(stage.index);
    } catch {
      setError(tBodyProgress('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const skip = (): void => {
    if (stage.step !== 'zone') return;
    setSkipped((n) => n + 1);
    advance(stage.index);
  };

  const errorLine =
    error === null ? null : (
      <p className="ct-bodyprogress__message" role="alert">
        {error}
      </p>
    );

  return (
    <section className="ct-bodyprogress__guided" aria-labelledby="ct-bodyprogress-guided">
      <h4 id="ct-bodyprogress-guided" className="ct-bodyprogress__heading ct-section-title">
        {tBodyProgress('guidedTitle')}
      </h4>
      {stage.step === 'date' ? (
        <form className="ct-bodyprogress__entry" onSubmit={begin} noValidate>
          <p className="ct-today__muted ct-bodyprogress__full">{tBodyProgress('guidedIntro')}</p>
          <label className="ct-bodyprogress__date">
            <span className="ct-bodyprogress__label">{tBodyProgress('guidedDateLabel')}</span>
            <input className="ct-bodyprogress__input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value as LocalDate)} />
          </label>
          <Button type="submit" className="ct-bodyprogress__save">
            {tBodyProgress('guidedBegin')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {tBodyProgress('guidedCancel')}
          </Button>
          {errorLine}
        </form>
      ) : null}
      {stage.step === 'zone' && kind !== undefined ? (
        <form className="ct-bodyprogress__entry" onSubmit={(event) => void next(event)} noValidate>
          <p className="ct-bodyprogress__zonename ct-bodyprogress__full">{tBodyProgress('guidedStep', { n: stage.index + 1, total: MEASUREMENT_KINDS.length, zone: tBodyProgress(KIND_TEXT[kind]) })}</p>
          <p className="ct-today__text ct-bodyprogress__full">{tBodyProgress('guidedTip', { tip: tBodyProgress(TIP_TEXT[kind]) })}</p>
          <p className="ct-today__muted ct-bodyprogress__full">
            {previous === null ? tBodyProgress('guidedLastNone') : tBodyProgress('guidedLast', { value: formatCm(previous.value), date: formatDayMonthYear(previous.date) })}
          </p>
          {existing === null ? null : <p className="ct-today__muted ct-bodyprogress__full">{tBodyProgress('guidedExisting', { value: formatCm(existing.value) })}</p>}
          <label className="ct-bodyprogress__value">
            <input
              ref={input}
              className="ct-bodyprogress__input"
              inputMode="decimal"
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={tBodyProgress('guidedValueLabel', { zone: tBodyProgress(KIND_TEXT[kind]) })}
            />
            <span className="ct-bodyprogress__unit" aria-hidden="true">
              {tBodyProgress('unitCm')}
            </span>
          </label>
          <Button type="submit" className="ct-bodyprogress__save" disabled={busy}>
            {tBodyProgress('guidedNext')}
          </Button>
          <Button variant="secondary" onClick={skip} disabled={busy}>
            {tBodyProgress('guidedSkip')}
          </Button>
          {errorLine}
          <Button variant="secondary" fullWidth onClick={onClose}>
            {tBodyProgress('guidedStop')}
          </Button>
        </form>
      ) : null}
      {stage.step === 'done' ? (
        <div className="ct-bodyprogress__card" role="status">
          <p className="ct-today__text">{tBodyProgress('guidedSummaryTitle', { date: formatDayMonthYear(date) })}</p>
          <p className="ct-today__muted">{tBodyProgress('guidedSummary', { saved, skipped })}</p>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {tBodyProgress('guidedDone')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
