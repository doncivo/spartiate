import type { PersonalRecord, WorkoutSummary as Summary } from '../../../domain/training';
import { formatClock, formatNumber, formatVolume, tTraining } from '../../../i18n/trainingText';
import './Summary.css';

/** Chiffres du résumé d'une séance close (§ 13.5), communs au résumé de fin et au détail du journal (I1-03). */

export function SummaryFigures({ summary }: { readonly summary: Summary }) {
  return (
    <>
      <dl className="ct-summary__kpis">
        <div className="ct-summary__kpi">
          <dt>{tTraining('summaryDuration')}</dt>
          <dd className="ct-session__num">{summary.durationSec === null ? '—' : formatClock(summary.durationSec * 1000)}</dd>
        </div>
        <div className="ct-summary__kpi">
          <dt>{tTraining('summarySets')}</dt>
          <dd className="ct-session__num">{summary.validatedWorkSets}</dd>
        </div>
        <div className="ct-summary__kpi">
          <dt>{tTraining('summaryVolume')}</dt>
          <dd className="ct-session__num ct-summary__volume">{formatVolume(summary.tonnageKg)}</dd>
        </div>
      </dl>
      <p className="ct-session__hint">
        {tTraining('summarySetsHint')} {tTraining('summaryVolumeHint')}
      </p>
    </>
  );
}

export function recordText(record: PersonalRecord): string {
  const params = { value: formatNumber(record.value), previous: formatNumber(record.previous) };
  return tTraining(record.kind === 'load' ? 'recordLoad' : 'recordSetVolume', params);
}

