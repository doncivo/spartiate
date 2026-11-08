import { useMemo, useState } from 'react';
import {
  checkInPeriod,
  effectiveTarget,
  proposeCheckIn,
  resolveCheckIn,
  type CheckInAlert,
  type CheckInReason,
  type CheckInResult,
  type CheckInWarning,
  type Clamp,
  type Goal,
  type Proposal,
  type Target,
} from '../../../domain/nutrition';
import { addDays } from '../../../domain/localDate';
import { formatDayLong, formatDayMonth, formatInt, formatSigned, tNutrition, type NutritionTextKey } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { TargetForm, type TargetSaveResult } from '../strategy/TargetForm';
import { firstCheckIn } from './firstCheckIn';
import { recordCheckInDecision, tdeeAt, type NutritionSnapshot } from '../useCases';

const REASON_KEY: Readonly<Record<CheckInReason, NutritionTextKey | null>> = {
  'manual-style': null,
  'no-weight': 'reasonNoWeight',
  'no-tdee': 'reasonNoTdee',
  'insufficient-coverage': 'reasonCoverage',
};
const CLAMP_KEY: Readonly<Record<Clamp, NutritionTextKey>> = { 'max-weekly-delta': 'whyClampDelta', 'max-loss-rate': 'whyClampLoss', floor: 'whyClampFloor' };
const WARNING_KEY: Readonly<Record<CheckInWarning, NutritionTextKey>> = {
  'below-floor': 'warnBelowFloor',
  'protein-out-of-range': 'warnProtein',
  'fat-below-min': 'warnFat',
  'beyond-weekly-delta': 'warnDelta',
};

const daysText = (n: number): string => (n === 0 ? tNutrition('daysCompleteNone') : n === 1 ? tNutrition('daysCompleteOne') : tNutrition('daysComplete', { n }));
const weighInsText = (n: number): string => (n === 0 ? tNutrition('weighInsNone') : n === 1 ? tNutrition('weighInsOne') : tNutrition('weighInsCount', { n }));

function goalText(goal: Goal): string {
  if (goal.kind === 'maintain') return tNutrition('goalMaintainShort');
  return tNutrition(goal.kind === 'loss' ? 'goalLossShort' : 'goalGainShort', { n: String(goal.weeklyRateKg).replace('.', ',') });
}

function alertText(alert: CheckInAlert): string {
  if (alert.kind === 'below-floor') return tNutrition('checkInAlertFloor', { kcal: formatInt(alert.currentKcal) });
  if (alert.kind === 'target-vs-tdee') return tNutrition('checkInAlertRatio', { pct: formatSigned(Math.round(alert.ratio * 100)) });
  return tNutrition('checkInAlertMacros', { min: formatInt(alert.minimumKcal), kcal: formatInt(alert.kcal) });
}

function ProposalLines({ proposal }: { readonly proposal: Proposal }) {
  const previous = proposal.previousTarget;
  const rows: readonly (readonly [string, number, number | undefined, string])[] = [
    [tNutrition('calories'), proposal.target.kcal, previous?.kcal, 'kcal'],
    [tNutrition('protein'), proposal.target.proteinG, previous?.proteinG, 'g'],
    [tNutrition('carbs'), proposal.target.carbG, previous?.carbG, 'g'],
    [tNutrition('fat'), proposal.target.fatG, previous?.fatG, 'g'],
  ];
  return (
    <ul className="ct-nutrition__list">
      {rows.map(([label, to, from, unit]) => (
        <li key={label} className="ct-nutrition__num">
          {from === undefined
            ? tNutrition('proposalNew', { label, to: `${formatInt(to)} ${unit}` })
            : from === to
              ? tNutrition('proposalLineSame', { label, value: `${formatInt(to)} ${unit}` })
              : tNutrition('proposalLine', { label, from: formatInt(from), to: `${formatInt(to)} ${unit}` })}
        </li>
      ))}
    </ul>
  );
}

type Done = { readonly kind: 'saved' } | { readonly kind: 'refused' } | null;

export interface CheckInViewProps {
  readonly snapshot: NutritionSnapshot;
  readonly onChanged: () => Promise<void>;
}

/**
 * Check-in hebdomadaire (I4-03, § 15.2, critère 6 ; maquette iPhone-CheckIn). Le moteur d'I4-01 (`proposeCheckIn`) décide s'il peut proposer :
 * sans couverture suffisante (4 jours complets et 2 pesées par semaine, sur 2 semaines), le check-in est SUSPENDU et aucune cible n'est
 * proposée. Une proposition n'est jamais appliquée seule : Accepter, Personnaliser ou Refuser sont des gestes explicites d'Ali, chacun tracé
 * (`nutrition_target`), et le check-in reste relançable. Le plancher (1 200 kcal, 800 sur confirmation) est appliqué par `resolveCheckIn`.
 */
export function CheckInView({ snapshot, onChanged }: CheckInViewProps) {
  const { data } = useAppContainer();
  const navigate = useNavigationStore((s) => s.navigate);
  const { prefs, targets } = snapshot;
  const period = useMemo(() => checkInPeriod(snapshot.today, prefs.checkInWeekday), [snapshot.today, prefs.checkInWeekday]);
  const [customizing, setCustomizing] = useState(false);
  const [preview, setPreview] = useState<Target | null>(null);
  const [done, setDone] = useState<Done>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const first = useMemo(() => firstCheckIn(snapshot.today, prefs.checkInWeekday, snapshot.days, snapshot.weighIns), [snapshot.today, prefs.checkInWeekday, snapshot.days, snapshot.weighIns]);
  const tdee = useMemo(() => tdeeAt(snapshot, period.weekEnd), [snapshot, period.weekEnd]);
  // Cible en vigueur pendant la semaine analysée : une décision prise pour la semaine suivante ne change pas la proposition relancée.
  const current = effectiveTarget(targets, period.weekEnd)?.target ?? null;
  const result: CheckInResult = useMemo(
    () =>
      proposeCheckIn({
        style: prefs.style,
        weekEnd: period.weekEnd,
        days: snapshot.days,
        weighIns: snapshot.weighIns,
        tdee: tdee.value,
        weightKg: tdee.weightKg,
        goal: prefs.goal,
        currentTarget: current,
        lowFloorConfirmed: false,
      }),
    [prefs, period.weekEnd, snapshot.days, snapshot.weighIns, tdee, current],
  );
  const proposal = result.proposal;
  const existing = targets.find((t) => t.weekStart === period.checkInDate);

  async function decide(decision: Parameters<typeof recordCheckInDecision>[1]['decision'], lowFloorConfirmed = false): Promise<TargetSaveResult> {
    if (proposal === null || tdee.weightKg === null) return 'error';
    setBusy(true);
    setMessage(null);
    try {
      const { outcome, record } = await recordCheckInDecision(data, { proposal, weekStart: period.checkInDate, weightKg: tdee.weightKg, currentTarget: current, decision, lowFloorConfirmed });
      if (record === null) {
        if (outcome.action === 'confirmation-required') {
          setMessage(tNutrition('decisionNeedsConfirm'));
          return 'confirmation-required';
        }
        setMessage(tNutrition('decisionRejected'));
        return 'rejected';
      }
      setCustomizing(false);
      setDone({ kind: record.accepted ? 'saved' : 'refused' });
      await onChanged();
      return 'saved';
    } catch {
      setMessage(tNutrition('writeError'));
      return 'error';
    } finally {
      setBusy(false);
    }
  }

  const customWarnings: readonly CheckInWarning[] =
    proposal !== null && preview !== null && tdee.weightKg !== null
      ? resolveCheckIn({ proposal, currentTarget: current, weightKg: tdee.weightKg, lowFloorConfirmed: true, decision: { action: 'customize', target: preview } }).warnings
      : [];

  const header = (
    <>
      <h2 className="ct-nutrition__subtitle">{tNutrition('checkInTitle')}</h2>
      <p className="ct-nutrition__muted">
        {tNutrition('checkInPeriod', { from: formatDayMonth(addDays(period.weekEnd, -6)), to: formatDayMonth(period.weekEnd), date: formatDayMonth(period.checkInDate) })}
      </p>
    </>
  );

  if (first.first) {
    return (
      <section className="ct-nutrition__card ct-nutrition__checkin" aria-label={tNutrition('checkInTitle')}>
        <h2 className="ct-nutrition__subtitle">{tNutrition('checkInTitle')}</h2>
        <p className="ct-nutrition__big">{tNutrition('checkInFirstTitle', { date: formatDayLong(first.date) })}</p>
        <p>{tNutrition('checkInFirstLead', { from: formatDayMonth(first.weekStart), to: formatDayMonth(first.weekEnd) })}</p>
        <p>{tNutrition('checkInFirstNeed', { days: first.needDays, weighIns: first.needWeighIns })}</p>
        <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('checkInFirstSoFar', { days: daysText(first.coverage.completeDays), weighIns: weighInsText(first.coverage.weighInDays) })}</p>
      </section>
    );
  }

  if (result.status === 'manual') {
    return (
      <section className="ct-nutrition__card ct-nutrition__checkin" aria-label={tNutrition('checkInTitle')}>
        {header}
        <p>{tNutrition('checkInManual')}</p>
        <p className="ct-nutrition__muted">{tNutrition('checkInManualHint')}</p>
        <Button variant="secondary" onClick={() => navigate({ tab: 'nutrition', screen: 'strategy' })}>
          {tNutrition('openStrategy')}
        </Button>
      </section>
    );
  }

  if (result.status === 'suspended') {
    return (
      <section className="ct-nutrition__card ct-nutrition__checkin" aria-label={tNutrition('checkInTitle')}>
        {header}
        <p className="ct-nutrition__big">{tNutrition('checkInSuspended')}</p>
        <p>{tNutrition('checkInLead')}</p>
        <p>{tNutrition('checkInNoTarget')}</p>
        <ul className="ct-nutrition__list">
          {result.reasons.map((reason) => {
            const key = REASON_KEY[reason];
            return key === null ? null : <li key={reason}>{tNutrition(key)}</li>;
          })}
        </ul>
        {result.coverage ? (
          <ul className="ct-nutrition__list ct-nutrition__num">
            {result.coverage.weeks.map((week, index) => (
              <li key={week.endDate}>{tNutrition('weekCoverage', { n: index + 1, days: daysText(week.completeDays), weighIns: weighInsText(week.weighInDays) })}</li>
            ))}
          </ul>
        ) : null}
        <p className="ct-nutrition__muted">{tNutrition('checkInResume')}</p>
      </section>
    );
  }

  if (result.status === 'alert' && result.alert) {
    return (
      <section className="ct-nutrition__card ct-nutrition__checkin" aria-label={tNutrition('checkInTitle')}>
        {header}
        <p role="alert" className="ct-nutrition__warning">
          {alertText(result.alert)}
        </p>
        <p>{tNutrition('checkInNoTarget')}</p>
        <Button variant="secondary" onClick={() => navigate({ tab: 'nutrition', screen: 'strategy' })}>
          {tNutrition('openStrategy')}
        </Button>
      </section>
    );
  }

  if (proposal === null) return null;
  return (
    <section className="ct-nutrition__card ct-nutrition__checkin" aria-label={tNutrition('checkInTitle')}>
      {header}
      {result.coverage ? (
        <ul className="ct-nutrition__list ct-nutrition__num">
          {result.coverage.weeks.map((week, index) => (
            <li key={week.endDate}>{tNutrition('weekCoverage', { n: index + 1, days: daysText(week.completeDays), weighIns: weighInsText(week.weighInDays) })}</li>
          ))}
        </ul>
      ) : null}
      {existing && done === null ? (
        <p className="ct-nutrition__muted">
          {tNutrition('previousDecision', { what: tNutrition(existing.source === 'manual' ? 'previousManual' : existing.accepted ? 'previousAccepted' : 'previousRefused') })}
        </p>
      ) : null}
      <h3 className="ct-nutrition__subtitle">{tNutrition('proposalTitle')}</h3>
      {proposal.initial ? <p className="ct-nutrition__muted">{tNutrition('proposalInitial')}</p> : null}
      <ProposalLines proposal={proposal} />
      {proposal.deltaKcal !== null ? <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('proposalDelta', { n: formatSigned(proposal.deltaKcal) })}</p> : null}

      <h3 className="ct-nutrition__subtitle">{tNutrition('why')}</h3>
      <ul className="ct-nutrition__list ct-nutrition__muted">
        <li>{tNutrition('whyTdee', { n: formatInt(proposal.trace.tdee) })}</li>
        <li>{tNutrition('whyGoal', { goal: goalText(prefs.goal) })}</li>
        <li>{tNutrition('whyDesired', { n: formatInt(proposal.trace.desiredKcal) })}</li>
        {proposal.clampedBy.map((clamp) => (
          <li key={clamp}>{tNutrition(CLAMP_KEY[clamp])}</li>
        ))}
        <li>{tNutrition('whyMacros')}</li>
      </ul>

      {done ? (
        <div className="ct-nutrition__done">
          <p role="status">{tNutrition(done.kind === 'saved' ? 'decisionSaved' : 'decisionRefused')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setDone(null);
              setMessage(null);
            }}
          >
            {tNutrition('relaunch')}
          </Button>
        </div>
      ) : customizing ? (
        <TargetForm
          title={tNutrition('customizeTitle')}
          initial={proposal.target}
          submitLabel={tNutrition('saveMyTarget')}
          onChange={setPreview}
          onCancel={() => setCustomizing(false)}
          onSave={(target, lowFloorConfirmed) => decide({ action: 'customize', target }, lowFloorConfirmed)}
        >
          {customWarnings.length > 0 ? (
            <ul className="ct-nutrition__list ct-nutrition__warning" role="status">
              {customWarnings.map((warning) => (
                <li key={warning}>{tNutrition(WARNING_KEY[warning])}</li>
              ))}
            </ul>
          ) : null}
        </TargetForm>
      ) : (
        <>
          {message ? (
            <p role="alert" className="ct-nutrition__warning">
              {message}
            </p>
          ) : null}
          <div className="ct-nutrition__actions">
            <Button disabled={busy} onClick={() => void decide({ action: 'accept' })}>
              {tNutrition('accept', { kcal: formatInt(proposal.target.kcal) })}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setCustomizing(true)}>
              {tNutrition('customize')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void decide({ action: 'refuse' })}>
              {tNutrition('refuse')}
            </Button>
          </div>
          {proposal.alternatives.map((alternative) => (
            <Button key={alternative.kind} variant="secondary" disabled={busy} onClick={() => void decide({ action: 'refuse' })}>
              {tNutrition('holdOption', { kcal: formatInt(alternative.target.kcal) })}
            </Button>
          ))}
        </>
      )}
      <p className="ct-nutrition__muted">{tNutrition('checkInFooter')}</p>
    </section>
  );
}
