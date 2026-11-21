import type { ImputedKcalDay, TrendPoint } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';
import { formatDayShort, formatInt, tNutrition } from '../../../i18n/nutritionText';
import type { DayBar } from './model';
import { trendScale } from './model';

/**
 * Graphiques du dashboard (I4-03, critère 5) : SVG sans dépendance, calculés en O(n) sur 7 et 28 jours (budget < 300 ms). Les jours sans
 * donnée restent VIDES (aucune barre, aucun point interpolé, jamais une barre à zéro) ; un jour partiel est dessiné en clair, jamais comme
 * un jour complet. Couleurs : jetons de la charte (bronze), via les classes.
 */

const W = 300;
const H = 120;
const PAD = 12;

const stateText = (state: DayBar['state']): string => tNutrition(state === 'complete' ? 'barComplete' : state === 'partial' ? 'barPartial' : 'barUnknown');

export function BarsChart({ bars, imputed = [] }: { readonly bars: readonly DayBar[]; readonly imputed?: readonly ImputedKcalDay[] }) {
  const estimate = new Map(imputed.map((i) => [i.date, i]));
  const values = bars.map((b) => b.kcal ?? 0);
  const max = Math.max(1, ...bars.map((b) => b.targetKcal ?? 0), ...values, ...imputed.map((i) => i.kcal + i.spread)) * 1.1;
  const slot = (W - 2 * PAD) / Math.max(1, bars.length);
  const y = (kcal: number): number => H - PAD - (kcal / max) * (H - 2 * PAD);
  return (
    <>
      <svg className="ct-nutrition__chart" viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={tNutrition('barsLabel')}>
        <line className="ct-nutrition__chart-base" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
        {/* FIX-PLANCHER (C-088) : un trait de cible par jour, selon son type (entraînement ou repos). */}
        {bars.map((bar, i) =>
          bar.targetKcal === null ? null : <line key={`t-${bar.date}`} className="ct-nutrition__chart-target" x1={PAD + i * slot} x2={PAD + (i + 1) * slot} y1={y(bar.targetKcal)} y2={y(bar.targetKcal)} />,
        )}
        {bars.map((bar, i) => {
          const x = PAD + i * slot + slot * 0.15;
          const width = slot * 0.7;
          const guess = bar.state === 'complete' ? undefined : estimate.get(bar.date);
          // NUTRI-b : jour estimé = contour en tirets (jamais plein), en plus du texte ; le logué éventuel reste dessiné dessous.
          if (guess !== undefined && (bar.kcal === null || bar.state === 'unknown')) return <rect key={bar.date} className="ct-nutrition__bar ct-nutrition__bar--imputed" x={x} y={y(guess.kcal)} width={width} height={H - PAD - y(guess.kcal)} />;
          if (bar.kcal === null || bar.state === 'unknown') return <rect key={bar.date} className="ct-nutrition__bar ct-nutrition__bar--unknown" x={x} y={H - PAD - 3} width={width} height={3} />;
          // Jour partiel : contour pointillé en plus du remplissage clair (le motif porte la différence, pas l'opacité seule).
          return <rect key={bar.date} className={`ct-nutrition__bar ct-nutrition__bar--${bar.state}`} x={x} y={y(bar.kcal)} width={width} height={H - PAD - y(bar.kcal)} {...(bar.state === 'partial' ? { strokeDasharray: '3 2' } : {})} />;
        })}
      </svg>
      <ul className="ct-visually-hidden">
        {bars.map((bar) => {
          const guess = bar.state === 'complete' ? undefined : estimate.get(bar.date);
          if (guess !== undefined && bar.kcal === null) return <li key={bar.date}>{tNutrition('barItemImputed', { day: formatDayShort(bar.date), kcal: formatInt(guess.kcal), spread: formatInt(guess.spread) })}</li>;
          return <li key={bar.date}>{tNutrition('barItem', { day: formatDayShort(bar.date), state: stateText(bar.state), value: bar.kcal === null ? '' : ` · ${formatInt(bar.kcal)} kcal` })}</li>;
        })}
      </ul>
    </>
  );
}

export function TrendChart({ points, endDate }: { readonly points: readonly TrendPoint[]; readonly endDate: LocalDate }) {
  if (points.length === 0) return null;
  const { startDate, spanDays, min, max } = trendScale(points, endDate);
  const dayIndex = (d: LocalDate): number => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  const x = (d: LocalDate): number => PAD + (dayIndex(d) / (spanDays - 1)) * (W - 2 * PAD);
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
