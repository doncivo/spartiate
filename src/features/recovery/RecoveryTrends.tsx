import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { addDays } from '../../domain/localDate';
import { recoveryTrends, TREND_DAYS, TREND_METRICS, type RecoveryTrends, type TrendMetric, type TrendSeries } from '../../domain/recovery/trends';
import { tPlural } from '../../i18n/plural';
import { tRecoveryFactors, type RecoveryFactorsTextKey } from '../../i18n/recoveryFactorsText';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { formatDuration } from './display';
import './RecoveryToday.css';

/**
 * Progrès › Récupération : tendances sur 30 jours (PROGRES-c, § 17.1), lues depuis `recovery_day` (repository), calcul dans le domaine
 * (`recoveryTrends`). Une courbe SVG par mesure (Recharts non importé, C-167 : quatre courbes simples), `role="img"` et étiquette textuelle
 * (moyennes, min, max) ; jours mesurés écrits. Aucune donnée ne quitte l'appareil. Lecture impossible : rien (la carte des facteurs le dit).
 */

const NAME: Readonly<Record<TrendMetric, RecoveryFactorsTextKey>> = { recovery: 'trend_recovery', hrv: 'trend_hrv', restingHr: 'trend_restingHr', sleep: 'trend_sleep' };

function formatValue(metric: TrendMetric, v: number | null): string {
  if (v === null) return tRecoveryFactors('trendMissing');
  if (metric === 'hrv') return tRecoveryFactors('unitMs', { v });
  if (metric === 'restingHr') return tRecoveryFactors('unitBpm', { v });
  if (metric === 'sleep') return formatDuration(v);
  return String(v);
}

function Sparkline({ series, label }: { readonly series: TrendSeries; readonly label: string }) {
  const width = 120;
  const height = 32;
  const values = series.points.filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const x = (i: number): number => (series.points.length <= 1 ? width / 2 : (i * width) / (series.points.length - 1));
  const y = (v: number): number => (span === 0 ? height / 2 : height - 3 - ((v - min) * (height - 6)) / span);
  // Segments continus seulement : un jour sans mesure coupe la courbe (jamais une valeur inventée).
  const runs: string[][] = [];
  let run: string[] = [];
  series.points.forEach((v, i) => {
    if (v === null) {
      if (run.length > 0) runs.push(run);
      run = [];
    } else run.push(`${String(x(i))},${String(y(v))}`);
  });
  if (run.length > 0) runs.push(run);
  return (
    <svg className="ct-recovery-trend__chart" viewBox={`0 0 ${String(width)} ${String(height)}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {runs.map((r, i) => (r.length === 1 ? <circle key={i} className="ct-recovery-trend__dot" cx={r[0]?.split(',')[0]} cy={r[0]?.split(',')[1]} r={1.5} /> : <polyline key={i} className="ct-recovery-trend__line" points={r.join(' ')} />))}
    </svg>
  );
}

export function RecoveryTrendsCard() {
  const container = useAppContainer();
  const synced = useSyncedData(['recovery_day']);
  const today = todayLocal(container.clock);
  const [trends, setTrends] = useState<RecoveryTrends | null | 'failed'>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const days = await (await container.data.repos.recovery()).listDays(addDays(today, -(TREND_DAYS - 1)), today);
      return recoveryTrends(
        days.map((d) => d.summary),
        today,
      );
    })().then(
      (t) => {
        if (live) setTrends(t);
      },
      () => {
        if (live) setTrends('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced]);

  if (trends === null || trends === 'failed') return null;
  const empty = TREND_METRICS.every((m) => trends.series[m].measured === 0);
  return (
    <section className="ct-today__card ct-recovery ct-flat" aria-labelledby="ct-recovery-trends-title">
      <h2 id="ct-recovery-trends-title" className="ct-today__eyebrow ct-section-title">
        {tRecoveryFactors('trendsTitle')}
      </h2>
      {empty ? (
        <p className="ct-today__text">{tRecoveryFactors('trendsEmpty')}</p>
      ) : (
        <>
          <p className="ct-today__muted">{tRecoveryFactors('trendsLead')}</p>
          <ul className="ct-recovery-trend__list">
            {TREND_METRICS.map((metric) => {
              const s = trends.series[metric];
              const name = tRecoveryFactors(NAME[metric]);
              const line = s.measured === 0 ? tRecoveryFactors('trendNone', { metric: name }) : tRecoveryFactors('trendLine', { metric: name, mean30: formatValue(metric, s.mean30), mean7: formatValue(metric, s.mean7), min: formatValue(metric, s.min), max: formatValue(metric, s.max) });
              return (
                <li key={metric} className="ct-recovery-trend__row">
                  <span className="ct-recovery-trend__name">{name}</span>
                  {s.measured === 0 ? <span className="ct-today__muted">{line}</span> : <Sparkline series={s} label={line} />}
                  {s.measured === 0 ? null : (
                    <span className="ct-today__muted ct-recovery-trend__value" aria-hidden="true">
                      {line}
                    </span>
                  )}
                  {s.measured === 0 ? null : (
                    <span className="ct-today__muted ct-recovery-trend__value">
                      {tPlural(tRecoveryFactors, s.measured, 'trendMeasuredOne', 'trendMeasured')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
