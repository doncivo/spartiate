import { useEffect, useMemo, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { addDays } from '../../domain/localDate';
import { weeklyReview } from '../../domain/review/weeklyReview';
import type { FirstWeekday } from '../../domain/week';
import { reviewFileName, reviewLine, reviewMarkdown, reviewWeekLabel, tWeeklyReview } from '../../i18n/weeklyReviewText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { shareReviewText, type ReviewShareOutcome } from './reviewExport';
import { loadWeeklyReview, REVIEW_TABLES, type ReviewLoaded } from './weeklyReviewData';
import './WeeklyReview.css';

/**
 * BILAN-029 : Progrès › Bilan de la semaine (§ 17.3, modèle de secours ; D-294, D-410). Bilan de la dernière semaine complète (réglage
 * « Début de semaine »), semaines précédentes recalculées à la demande, chaque phrase avec sa source ; export Markdown local. Bloc chargé à
 * la demande avec son catalogue de textes et sa règle (jamais dans le départ).
 */

type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | ({ readonly status: 'ready' } & ReviewLoaded);
type ExportStatus = ReviewShareOutcome | 'failed' | null;

const EXPORT_TEXT: Readonly<Record<Exclude<ExportStatus, null>, Parameters<typeof tWeeklyReview>[0]>> = {
  shared: 'exportShared',
  cancelled: 'exportCancelled',
  downloaded: 'exportDownloaded',
  failed: 'exportFailed',
};

export interface WeeklyReviewProps {
  /** Réglage « Début de semaine », lu par l'hôte (SectionNotice). */
  readonly firstWeekday?: FirstWeekday;
  /** Export ; défaut : feuille de partage du système, sinon téléchargement. */
  readonly share?: (text: string, fileName: string) => Promise<ReviewShareOutcome>;
}

export function WeeklyReview({ firstWeekday = 'monday', share = shareReviewText }: WeeklyReviewProps) {
  const container = useAppContainer();
  const synced = useSyncedData(REVIEW_TABLES);
  const today = todayLocal(container.clock);
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(0);
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);

  useEffect(() => {
    let live = true;
    loadWeeklyReview(container.data, today, firstWeekday).then(
      (loaded) => {
        if (live) setState({ status: 'ready', ...loaded });
      },
      () => {
        if (live) setState({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced, attempt, firstWeekday]);

  const review = useMemo(() => {
    if (state.status !== 'ready') return null;
    const start = state.weeks[selected] ?? state.weeks[0];
    return start === undefined ? null : weeklyReview(state.data, start);
  }, [state, selected]);

  const onExport = async (): Promise<void> => {
    if (review === null || state.status !== 'ready') return;
    try {
      setExportStatus(await share(reviewMarkdown(review, state.muscleName), reviewFileName(review.weekStart)));
    } catch {
      setExportStatus('failed');
    }
  };

  return (
    <section className="ct-today__card ct-review ct-flat" aria-labelledby="ct-review-title">
      <h2 id="ct-review-title" className="ct-today__eyebrow ct-section-title">
        {tWeeklyReview('title')}
      </h2>
      {state.status === 'loading' ? (
        <p className="ct-today__muted" role="status">
          {tWeeklyReview('loading')}
        </p>
      ) : state.status === 'failed' ? (
        <div role="alert">
          <p className="ct-today__text">{tWeeklyReview('loadFailed')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            {tWeeklyReview('retry')}
          </Button>
        </div>
      ) : review === null ? null : (
        <>
          <p className="ct-today__muted ct-review__lead">{tWeeklyReview('lead')}</p>
          <h3 className="ct-review__week-title">{reviewWeekLabel(review.weekStart, review.weekEnd)}</h3>
          <ul className="ct-review__list">
            {review.sentences.map((s) => (
              <li key={s.theme} className={s.kind === 'insufficient' ? 'ct-review__line ct-review__line--missing' : 'ct-review__line'}>
                {reviewLine(s, state.muscleName)}
              </li>
            ))}
          </ul>
          <div className="ct-review__actions">
            <Button variant="secondary" onClick={() => void onExport()}>
              {tWeeklyReview('export')}
            </Button>
            {selected === 0 ? null : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(0);
                  setExportStatus(null);
                }}
              >
                {tWeeklyReview('backToLatest')}
              </Button>
            )}
            {exportStatus === null ? null : (
              <p className="ct-today__muted ct-review__status" role="status">
                {tWeeklyReview(EXPORT_TEXT[exportStatus])}
              </p>
            )}
          </div>
          <h3 id="ct-review-previous" className="ct-today__muted ct-review__lead">
            {tWeeklyReview('previousTitle')}
          </h3>
          <ul className="ct-review__weeks" aria-labelledby="ct-review-previous">
            {state.weeks.slice(1).map((start, i) => (
              <li key={start}>
                <button
                  type="button"
                  className="ct-review__week"
                  aria-pressed={selected === i + 1}
                  onClick={() => {
                    setSelected(i + 1);
                    setExportStatus(null);
                  }}
                >
                  {reviewWeekLabel(start, addDays(start, 6))}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
