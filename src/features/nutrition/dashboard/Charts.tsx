import { addDays } from '../../../domain/localDate';
import type { TrendPoint } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';
import { formatDayShort, formatInt, tNutrition } from '../../../i18n/nutritionText';
import type { DayBar } from './model';
import { TREND_WINDOW_DAYS } from './model';

/**
 * Graphiques du dashboard (I4-03, critère 5) : SVG sans dépendance, calculés en O(n) sur 7 et 28 jours (budget < 300 ms). Les jours sans
 * donnée restent VIDES (aucune barre, aucun point interpolé, jamais une barre à zéro) ; un jour partiel est dessiné en clair, jamais comme
 * un jour complet. Couleurs : jetons de la charte (bronze), via les classes.
 */

const W = 300;
const H = 120;
const PAD = 12;

const stateText = (state: DayBar['state']): string => tNutrition(state === 'complete' ? 'barComplete' : state === 'partial' ? 'barPartial' : 'barUnknown');

export function BarsChart({ bars, targetKcal }: { readonly bars: readonly DayBar[]; readonly targetKcal: number | null }) {
  const values = bars.map((b) => b.kcal ?? 0);
  const max = Math.max(1, targetKcal ?? 0, ...values) * 1.1;
  const slot = (W - 2 * PAD) / Math.max(1, bars.length);
  const y = (kcal: number): number => H - PAD - (kcal / max) * (H - 2 * PAD);
  return (
    <>
      <svg className="ct-nutrition__chart" viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={tNutrition('barsLabel')}>
        <line className="ct-nutrition__chart-base" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
        {targetKcal === null ? null : <line className="ct-nutrition__chart-target" x1={PAD} x2={W - PAD} y1={y(targetKcal)} y2={y(targetKcal)} />}
        {bars.map((bar, i) => {
          const x = PAD + i * slot + slot * 0.15;
          const width = slot * 0.7;
          if (bar.kcal === null || bar.state === 'unknown') return <rect key={bar.date} className="ct-nutrition__bar ct-nutrition__bar--unknown" x={x} y={H - PAD - 3} width={width} height={3} />;
          return <rect key={bar.date} className={`ct-nutrition__bar ct-nutrition__bar--${bar.state}`} x={x} y={y(bar.kcal)} width={width} height={H - PAD - y(bar.kcal)} />;
        })}
      </svg>
      <ul className="ct-visually-hidden">
        {bars.map((bar) => (
          <li key={bar.date}>{tNutrition('barItem', { day: formatDayShort(bar.date), state: stateText(bar.state), value: bar.kcal === null ? '' : ` · ${formatInt(bar.kcal)} kcal` })}</li>
        ))}
      </ul>
    </>
  );
}

export function TrendChart({ points, endDate }: { readonly points: readonly TrendPoint[]; readonly endDate: LocalDate }) {
  if (points.length === 0) return null;
  const startDate = addDays(endDate, -(TREND_WINDOW_DAYS - 1));
  const dayIndex = (d: LocalDate): number => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  const kgs = points.flatMap((p) => [p.kg, p.trend]);
  const min = Math.min(...kgs) - 0.3;
  const max = Math.max(...kgs) + 0.3;
  const x = (d: LocalDate): number => PAD + (dayIndex(d) / (TREND_WINDOW_DAYS - 1)) * (W - 2 * PAD);
  const y = (kg: number): number => H - PAD - ((kg - min) / (max - min)) * (H - 2 * PAD);
  const line = points.map((p) => `${String(x(p.date))},${String(y(p.trend))}`).join(' ');
  return (
    <svg className="ct-nutrition__chart" viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={tNutrition('trendChartLabel')}>
      <line className="ct-nutrition__chart-base" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
      {points.map((p) => (
        <circle key={p.date} className={p.outlier ? 'ct-nutrition__dot ct-nutrition__dot--outlier' : 'ct-nutrition__dot'} cx={x(p.date)} cy={y(p.kg)} r={2.5} />
      ))}
      {points.length > 1 ? <polyline className="ct-nutrition__trend-line" points={line} /> : null}
      <circle className="ct-nutrition__trend-end" cx={x(points[points.length - 1]?.date ?? endDate)} cy={y(points[points.length - 1]?.trend ?? min)} r={4} />
    </svg>
  );
}
