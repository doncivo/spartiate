import { useMemo } from 'react';
import { remainingForDay, type TdeeConfidence } from '../../../domain/nutrition';
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

const daysText = (n: number): string => (n === 0 ? tNutrition('daysCompleteNone') : n === 1 ? tNutrition('daysCompleteOne') : tNutrition('daysComplete', { n }));
const weighInsText = (n: number): string => (n === 0 ? tNutrition('weighInsNone') : n === 1 ? tNutrition('weighInsOne') : tNutrition('weighInsCount', { n }));

/**
 * Dashboard (I4-03, § 15.1–15.2, critère 5 ; maquettes iPhone-Dashboard / PC-Dashboard) : aujourd'hui, balance 7 jours, tendance de poids
 * sur 28 jours, dépense estimée avec sa confiance, couverture. Aucun jour absent n'est inventé : exclu des moyennes, vide dans les graphiques.
 * Toute valeur impossible à calculer s'écrit « — » avec sa cause, jamais 0.
 */
export function DashboardView({ snapshot }: { readonly snapshot: NutritionSnapshot }) {
  const navigate = useNavigationStore((s) => s.navigate);
  const model = useMemo(() => dashboardModel(snapshot), [snapshot]);
  const { tdee } = snapshot;
  const target = snapshot.target?.target ?? null;
  const today = snapshot.days.find((d) => d.date === snapshot.today);
  const remainingToday = today ? remainingForDay(target, today) : null;
  const measuredTerms = (tdee.basis === 'blend' || tdee.basis === 'measured') && tdee.measuredRaw !== null && tdee.meanKcal !== null && tdee.deltaKg !== null;

  return (
    <div className="ct-nutrition__dashboard">
      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-today">
        <h2 id="ct-nutrition-today" className="ct-nutrition__eyebrow">
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
        <h2 id="ct-nutrition-balance" className="ct-nutrition__eyebrow">
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
              {target === null ? tNutrition('balanceNoTarget') : tNutrition('balanceVsTarget', { n: formatInt(target.kcal) })}
            </p>
          </>
        )}
        <p className="ct-nutrition__num">{tNutrition('coverageLine', { days: daysText(model.balance.completeDays), weighIns: weighInsText(model.balance.weighInDays) })}</p>
        <BarsChart bars={model.bars} targetKcal={target?.kcal ?? null} />
        <p className="ct-nutrition__muted">{tNutrition('barsLegend')}</p>
        <p className="ct-nutrition__muted">{tNutrition('balanceExcluded')}</p>
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-trend">
        <h2 id="ct-nutrition-trend" className="ct-nutrition__eyebrow">
          {tNutrition('trendTitle')}
        </h2>
        {model.trendNow === null ? (
          <p>{tNutrition('trendEmpty')}</p>
        ) : (
          <>
            {model.learning && model.lastWeighIn ? (
              <>
                <p className="ct-nutrition__big ct-nutrition__num">{tNutrition('trendValue', { n: formatTenth(model.lastWeighIn.kg) })}</p>
                <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('trendLearning', { count: model.weighInCount === 1 ? tNutrition('trendLearningCountOne') : tNutrition('trendLearningCount', { n: model.weighInCount }) })}</p>
              </>
            ) : (
              <>
                <p className="ct-nutrition__big ct-nutrition__num">{tNutrition('trendValue', { n: formatTenth(model.trendNow) })}</p>
                <p className="ct-nutrition__muted ct-nutrition__num">{model.slope === null ? tNutrition('trendNoSlope') : tNutrition('trendSlope', { n: formatKgDelta(model.slope) })}</p>
              </>
            )}
            <TrendChart points={model.trendPoints} endDate={snapshot.today} />
            {model.lastWeighIn ? <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('trendLast', { kg: formatTenth(model.lastWeighIn.kg), date: formatDayShort(model.lastWeighIn.date) })}</p> : null}
            {model.trendPoints.some((p) => p.outlier) ? <p className="ct-nutrition__muted">{tNutrition('trendOutlier')}</p> : null}
          </>
        )}
        <Button variant="secondary" onClick={() => navigate({ tab: 'more', screen: 'body' })}>
          {tNutrition('addWeight')}
        </Button>
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-tdee">
        <h2 id="ct-nutrition-tdee" className="ct-nutrition__eyebrow">
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
        <p className="ct-nutrition__confidence">{tNutrition(CONFIDENCE_KEY[model.confidence])}</p>
      </section>

      <section className="ct-nutrition__card" aria-labelledby="ct-nutrition-coverage">
        <h2 id="ct-nutrition-coverage" className="ct-nutrition__eyebrow">
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
