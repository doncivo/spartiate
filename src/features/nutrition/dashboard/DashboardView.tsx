import { tPlural } from '../../../i18n/plural';
import { useMemo } from 'react';
import { remainingForDay, type TdeeConfidence } from '../../../domain/nutrition';
import { adjustForSteps, type StepsAdjustmentReason } from '../../../domain/nutrition/stepsAdjustment';
import { formatDayShort, formatInt, formatKgDelta, formatSigned, formatTenth, orDash, tNutrition, weekdayNames, type NutritionTextKey } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { useNavigationStore } from '../../app/navigation';
import { KcalHero } from '../shared';
import type { NutritionSnapshot } from '../useCases';
import { BarsChart, TrendChart } from './Charts';
import { dashboardModel } from './model';

const CONFIDENCE_KEY: Readonly<Record<TdeeConfidence, NutritionTextKey>> = {
  none: 'confidenceNone',
  low: 'confidenceLow',
  medium: 'confidenceMedium',
  high: 'confidenceHigh',
};

const STEPS_REASON_KEY: Readonly<Record<StepsAdjustmentReason, NutritionTextKey>> = {
  'no-steps': 'stepsAdjNoSteps',
  unreadable: 'stepsAdjUnreadable',
  'day-unknown': 'stepsAdjDayUnknown',
  'baseline-short': 'stepsAdjBaselineShort',
  'no-estimate': 'stepsAdjNoEstimate',
  'measured-only': 'stepsAdjMeasuredOnly',
};

const daysText = (n: number): string => (n === 0 ? tNutrition('daysCompleteNone') : tPlural(tNutrition, n, 'daysCompleteOne', 'daysComplete'));
const weighInsText = (n: number): string => (n === 0 ? tNutrition('weighInsNone') : tPlural(tNutrition, n, 'weighInsOne', 'weighInsCount'));

/**
 * Dashboard (I4-03, § 15.1–15.2, critère 5 ; maquettes iPhone-Dashboard / PC-Dashboard) : aujourd'hui, balance 7 jours, tendance de poids
 * sur 28 jours, dépense estimée avec sa confiance, couverture. Aucun jour absent n'est inventé : exclu des moyennes, vide dans les graphiques.
 * Toute valeur impossible à calculer s'écrit « — » avec sa cause, jamais 0.
 */
export function DashboardView({ snapshot }: { readonly snapshot: NutritionSnapshot }) {
  const navigate = useNavigationStore((s) => s.navigate);
  const model = useMemo(() => dashboardModel(snapshot), [snapshot]);
  const { tdee } = snapshot;
  // FIX-PLANCHER (C-088) : cible du type du jour (D-270), comme le Journal et Aujourd'hui.
  const target = model.todayTarget;
  const today = snapshot.days.find((d) => d.date === snapshot.today);
  const remainingToday = today ? remainingForDay(target, today) : null;
  // NUTRI-b (§ 15.1) : jours estimés dits en texte, avec l'incertitude ; jamais une mesure.
  const imputed = model.imputedKcal.days;
  const imputedMean = imputed.length === 0 ? 0 : Math.round(imputed.reduce((sum, i) => sum + i.kcal, 0) / imputed.length);
  const imputedLine =
    imputed.length > 0 ? (
      <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('imputedKcalLine', { n: imputed.length, kcal: formatInt(imputedMean), spread: formatInt(imputed[0]?.spread ?? 0) })}</p>
    ) : model.imputedKcal.reason !== null && model.bars.some((b) => b.state !== 'complete') ? (
      <p className="ct-nutrition__muted">{tNutrition('imputedKcalNone')}</p>
    ) : null;
  const measuredTerms = (tdee.basis === 'blend' || tdee.basis === 'measured') && tdee.measuredRaw !== null && tdee.meanKcal !== null && tdee.deltaKg !== null;

  // REPAS-029b : dépense du jour de référence ajustée aux pas, affichage seul (jamais utilisée par le check-in ni la dépense mesurée).
  const steps = adjustForSteps({ date: snapshot.reference, steps: snapshot.stepsDays === undefined ? [] : snapshot.stepsDays, estimate: { value: tdee.value, weightMeasured: tdee.weightMeasured } });
  const stepsLine = (
    <div className="ct-nutrition__steps" aria-label={tNutrition('stepsAdjTitle')}>
      {steps.status === 'adjusted' ? (
        <>
          <p className="ct-nutrition__muted ct-nutrition__num">
            {tNutrition('stepsAdjLine', { day: formatDayShort(steps.date), steps: formatInt(steps.steps), base: formatInt(steps.baseline), days: steps.baselineDays, sign: steps.appliedKcal < 0 ? '−' : '+', kcal: formatInt(Math.abs(steps.appliedKcal)), share: formatInt(steps.formulaShare * 100), value: formatInt(steps.adjusted) })}
          </p>
          {steps.capped ? <p className="ct-nutrition__muted">{tNutrition('stepsAdjCapped')}</p> : null}
        </>
      ) : (
        <p className="ct-nutrition__muted">{tNutrition(STEPS_REASON_KEY[steps.reason])}</p>
      )}
      <p className="ct-nutrition__muted">{tNutrition('stepsAdjSource')}</p>
    </div>
  );

  return (
    <div className="ct-nutrition__dashboard">
      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-today">
        <h2 id="ct-nutrition-today" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('todayCard')}
        </h2>
        {remainingToday === null || remainingToday.kcal === null ? (
          <p>{target === null ? tNutrition('noTarget') : tNutrition('unknown')}</p>
        ) : (
          <KcalHero kcal={remainingToday.kcal} />
        )}
        {today && today.entryCount === 0 ? <p className="ct-nutrition__muted">{tNutrition('emptyToday')}</p> : null}
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-balance">
        <h2 id="ct-nutrition-balance" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('balanceTitle')}
        </h2>
        {model.balance.averageKcal === null ? (
          <p>{tNutrition('balanceEmpty')}</p>
        ) : (
          <>
            <p className="ct-nutrition__big ct-nutrition__num" data-testid="balance-value">
              {model.balance.deltaKcal === null ? tNutrition('balanceAverage', { n: formatInt(model.balance.averageKcal) }) : tNutrition('balanceValue', { n: formatSigned(model.balance.deltaKcal) })}
            </p>
            <p className="ct-nutrition__muted ct-nutrition__num">
              {model.compareKcal === null ? tNutrition('balanceNoTarget') : tNutrition('balanceVsTarget', { n: formatInt(model.compareKcal) })}
            </p>
          </>
        )}
        <p className="ct-nutrition__num">{tNutrition('coverageLine', { days: daysText(model.balance.completeDays), weighIns: weighInsText(model.balance.weighInDays) })}</p>
        <BarsChart bars={model.bars} imputed={model.imputedKcal.days} />
        <p className="ct-nutrition__muted">{tNutrition('barsLegend')} {imputed.length > 0 ? tNutrition('barsLegendImputed') : ''}</p>
        <p className="ct-nutrition__muted">{tNutrition('balanceExcluded')}</p>
        {imputedLine}
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-trend">
        <h2 id="ct-nutrition-trend" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('trendTitle')}
        </h2>
        {model.trendNow === null ? (
          <p>{tNutrition('trendEmpty')}</p>
        ) : (
          <>
            {model.learning && model.lastWeighIn ? (
              <>
                <p className="ct-nutrition__big ct-nutrition__num">{tNutrition('trendValue', { n: formatTenth(model.lastWeighIn.kg) })}</p>
                <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('trendLearning', { count: tPlural(tNutrition, model.weighInCount, 'trendLearningCountOne', 'trendLearningCount') })}</p>
              </>
            ) : (
              <>
                <p className="ct-nutrition__big ct-nutrition__num">{tNutrition('trendValue', { n: formatTenth(model.trendNow) })}</p>
                <p className="ct-nutrition__muted ct-nutrition__num">{model.slope === null ? tNutrition('trendNoSlope') : tNutrition('trendSlope', { n: formatKgDelta(model.slope) })}</p>
              </>
            )}
            <TrendChart points={model.trendPoints} endDate={snapshot.today} />
            {model.lastWeighIn ? <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('trendLast', { kg: formatTenth(model.lastWeighIn.kg), date: formatDayShort(model.lastWeighIn.date) })}</p> : null}
            {model.imputedWeightToday === null || model.learning ? null : (
              <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('imputedWeightLine', { kg: formatTenth(model.imputedWeightToday.kg), spread: formatTenth(model.imputedWeightToday.spread) })}</p>
            )}
            {model.trendPoints.some((p) => p.outlier) ? <p className="ct-nutrition__muted">{tNutrition('trendOutlier')}</p> : null}
          </>
        )}
        <Button variant="secondary" onClick={() => navigate({ tab: 'more', screen: 'body' })}>
          {tNutrition('addWeight')}
        </Button>
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-tdee">
        <h2 id="ct-nutrition-tdee" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('tdeeTitle')}
        </h2>
        {tdee.value === null ? (
          <p>{tNutrition('tdeeNone')}</p>
        ) : (
          <>
            <p className="ct-nutrition__big ct-nutrition__num">{tNutrition('tdeeValue', { n: formatInt(tdee.value) })}</p>
            <p className="ct-nutrition__muted">
              {tdee.basis === 'formula'
                ? tNutrition('tdeeBasisFormula')
                : tdee.basis === 'blend'
                  ? tNutrition('tdeeBasisBlend', { pct: formatInt(tdee.weightMeasured * 100) })
                  : tNutrition('tdeeBasisMeasured')}
            </p>
            {measuredTerms ? (
              <p className="ct-nutrition__muted ct-nutrition__num">
                {tNutrition('tdeeMeasuredTerms', { kcal: orDash(tdee.meanKcal, formatInt), days: tdee.completeDaysInWindow, delta: orDash(tdee.deltaKg, formatKgDelta) })}
              </p>
            ) : null}
            {tdee.formula !== null && tdee.basis !== 'formula' ? <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('tdeeFormula', { n: formatInt(tdee.formula) })}</p> : null}
          </>
        )}
        {tdee.reasons.includes('no-recent-weigh-in-at-start') || tdee.reasons.includes('no-recent-weigh-in-at-end') ? <p className="ct-nutrition__muted">{tNutrition('tdeeWeighInNeeded')}</p> : null}
        {stepsLine}
        <p className="ct-nutrition__confidence">{tNutrition(CONFIDENCE_KEY[model.confidence])}</p>
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-coverage">
        <h2 id="ct-nutrition-coverage" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('coverageTitle')}
        </h2>
        <p>{tNutrition(tdee.coverage.sufficient ? 'coverageSufficient' : 'coverageInsufficient')}</p>
        <p className="ct-nutrition__muted">{tNutrition('checkInNext', { day: weekdayNames()[snapshot.prefs.checkInWeekday - 1] ?? '' })}</p>
        <Button variant="secondary" onClick={() => navigate({ tab: 'nutrition', screen: 'checkin' })}>
          {tNutrition('openCheckIn')}
        </Button>
      </section>
    </div>
  );
}
