import type { PersonalRecord, WorkoutSummary as Summary } from '../../../domain/training';
import { formatClock, formatExerciseLoad, formatNumber, formatVolume, tTraining } from '../../../i18n/trainingText';
import type { Held } from '../loadDisplay';
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

/** ERGO-02 (D-261) : record de charge de deux haltères en « 2 × 26 kg » ; le record de série (kg soulevés) reste un volume, inchangé. */
export function recordText(record: PersonalRecord, held: Held = null): string {
  if (record.kind === 'load') return tTraining('recordLoad', { value: formatExerciseLoad(record.value, held), previous: formatExerciseLoad(record.previous, held) });
  return tTraining('recordSetVolume', { value: formatNumber(record.value), previous: formatNumber(record.previous) });
}

