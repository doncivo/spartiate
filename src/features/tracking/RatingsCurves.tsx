import { useId } from 'react';
import { RATING_KINDS, RATING_MAX, RATING_MIN, ratingSeries, type RatingKind, type RatingPoint } from '../../domain/tracking/ratings';
import { tTracking } from '../../i18n/trackingText';
import { Sparkline } from './Sparkline';

/** SUIVIS-029c : Progrès › Suivis, courbes des notes du matin sur 30 jours (moyenne, jours notés) ; jour sans note : courbe coupée, jamais 0. */
export function RatingsCurves({ ratings, today }: { readonly ratings: Readonly<Record<RatingKind, readonly RatingPoint[]>> | null; readonly today: string }) {
  const id = useId();
  return (
    <section className="ct-tracking__block" aria-labelledby={`${id}-ratings`}>
      <h3 id={`${id}-ratings`} className="ct-tracking__title">
        {tTracking('ratingsProgressTitle')}
      </h3>
      {ratings === null ? (
        <p className="ct-today__muted">{tTracking('ratingsReadFailed')}</p>
      ) : (
        RATING_KINDS.map((kind) => {
          const label = tTracking(`rating_${kind}`);
          const series = ratingSeries(ratings[kind], today);
          if (series.average === null) {
            return (
              <p key={kind} className="ct-today__muted">
                {tTracking('ratingsNone', { label })}
              </p>
            );
          }
          const summary = tTracking('ratingsSummary', { label, avg: series.average.toLocaleString('fr-FR'), n: series.days });
          return (
            <div key={kind} className="ct-tracking__block">
              <p className="ct-tracking__value">{summary}</p>
              <Sparkline points={series.points} label={summary} min={RATING_MIN} max={RATING_MAX} />
            </div>
          );
        })
      )}
    </section>
  );
}
