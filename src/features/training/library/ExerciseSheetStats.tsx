import type { Exercise, ExerciseSession } from '../../../domain/training/types';
import type { IsoDateTime } from '../../../domain/types';
import { confidencePercent } from '../../../domain/training/explain';
import { formatExerciseLoad, formatNumber, formatShortDay, tTraining, type TrainingTextKey } from '../../../i18n/trainingText';
import { HeroFigure, SectionTitle } from '../../../ui';
import type { Held } from '../loadDisplay';
import { sheetStats, type SheetOneRm, type SheetSession } from './exerciseSheet';

/**
 * ERGO-02 : blocs chiffrés de la fiche exercice (aperçu Fiche-apres, PC-Fiche-apres), chargés à la demande avec la fiche : 1RM estimé en chiffre
 * héros, record, évolution sur 8 semaines, séances récentes. Une donnée absente s'écrit « — » avec sa raison, jamais un chiffre inventé.
 * Charge de deux haltères en « 2 × 26 kg » (D-261) ; la valeur lue reste celle d'un haltère.
 */

/** Historique de l'exercice tel que la fiche l'a lu : en cours, illisible, ou les séances closes. */
export type SheetHistory = 'loading' | 'error' | readonly ExerciseSession[];

interface StatsProps {
  readonly history: SheetHistory;
  readonly exercise: Exercise;
  readonly held: Held;
  readonly now: IsoDateTime;
}

const REASON_KEY: Readonly<Record<Extract<SheetOneRm, { kind: 'none' }>['reason'], TrainingTextKey>> = {
  noHistory: 'sheetNoHistory',
  noValid: 'sheetNoValid',
  notLoad: 'sheetNotLoad',
  bodyweight: 'sheetBodyweight',
};
const DIFFICULTY_KEY = { easy: 'sheetEasy', ok: 'sheetOk', hard: 'sheetHard' } as const satisfies Readonly<Record<string, TrainingTextKey>>;

function Loading() {
  return (
    <p className="ct-training__muted" role="status">
      {tTraining('loading')}
    </p>
  );
}

/** Tracé du 1RM estimé (8 semaines), décoratif : la valeur et l'écart sont écrits à côté en texte. */
function Trend({ values }: { readonly values: readonly number[] }) {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const W = 400;
  const H = 100;
  const points = values.map((v, i) => `${String(Math.round((i / (values.length - 1)) * W))},${String(Math.round(H - 8 - ((v - min) / span) * (H - 16)))}`);
  const last = points.at(-1)?.split(',') ?? ['0', '0'];
  return (
    <svg className="ct-sheet__chart" viewBox={`0 0 ${String(W)} ${String(H)}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line className="ct-sheet__chart-base" x1="0" y1={H - 1} x2={W} y2={H - 1} />
      <polyline className="ct-sheet__chart-line" points={points.join(' ')} />
      <circle className="ct-sheet__chart-dot" cx={last[0]} cy={last[1]} r="4" />
    </svg>
  );
}

/** 1RM estimé (chiffre héros), record, 8 semaines. */
export function SheetFigures({ history, exercise, held, now }: StatsProps) {
  if (history === 'loading') return <Loading />;
  if (history === 'error')
    return (
      <div className="ct-sheet__figures">
        <div className="ct-sheet__figure">
          <SectionTitle level={3}>{tTraining('sheetOneRm')}</SectionTitle>
          <p className="ct-sheet__none">{tTraining('sheetNone')}</p>
          <p className="ct-training__muted">{tTraining('sheetReadError')}</p>
        </div>
      </div>
    );
  const stats = sheetStats(history, exercise, now);
  const { oneRm, record, trend } = stats;
  const pair = held === 2;
  const deltaText =
    trend === null
      ? null
      : Math.round(trend.deltaKg * 2) === 0
        ? tTraining('sheetTrendFlat')
        : tTraining(trend.deltaKg > 0 ? (pair ? 'sheetTrendUpPair' : 'sheetTrendUp') : pair ? 'sheetTrendDownPair' : 'sheetTrendDown', { n: formatNumber(Math.round(Math.abs(trend.deltaKg) * 2) / 2) });
  return (
    <>
      <div className="ct-sheet__figures">
        <div className="ct-sheet__figure">
          <SectionTitle level={3}>{tTraining('sheetOneRm')}</SectionTitle>
          {oneRm.kind === 'value' ? (
            <>
              <HeroFigure className="ct-sheet__hero" value={pair ? `2 × ${formatNumber(Math.round(oneRm.kg))}` : formatNumber(Math.round(oneRm.kg))} unit="kg" />
              <p className="ct-training__muted">
                {tTraining(oneRm.sessions === 1 ? 'sheetOneRmMetaOne' : 'sheetOneRmMeta', { percent: confidencePercent(oneRm.confidence), n: oneRm.sessions })}
              </p>
            </>
          ) : (
            <>
              <p className="ct-sheet__none">{tTraining('sheetNone')}</p>
              <p className="ct-training__muted">{tTraining(REASON_KEY[oneRm.reason])}</p>
            </>
          )}
        </div>
        <div className="ct-sheet__figure ct-sheet__figure--side">
          <SectionTitle level={3}>{tTraining('sheetRecord')}</SectionTitle>
          {record === null ? (
            <>
              <p className="ct-sheet__none">{tTraining('sheetNone')}</p>
              <p className="ct-training__muted">{tTraining('sheetNoRecord')}</p>
            </>
          ) : (
            <>
              <p className="ct-sheet__record">{tTraining('sheetRecordValue', { load: formatExerciseLoad(record.loadKg, held), reps: record.reps })}</p>
              <p className="ct-training__muted">{formatShortDay(record.endedAt)}</p>
            </>
          )}
        </div>
      </div>
      <div className="ct-sheet__trend">
        <div className="ct-sheet__trend-head">
          <SectionTitle level={3}>{tTraining('sheetTrend')}</SectionTitle>
          {deltaText === null ? null : <span className={trend !== null && trend.deltaKg > 0 ? 'ct-sheet__delta ct-sheet__delta--up' : 'ct-sheet__delta'}>{deltaText}</span>}
        </div>
        {trend === null ? (
          <p className="ct-training__muted">{tTraining('sheetTrendNone')}</p>
        ) : (
          <figure className="ct-sheet__chart-box" aria-label={tTraining('sheetTrendChart')}>
            <Trend values={trend.values} />
          </figure>
        )}
      </div>
    </>
  );
}

function sessionLine(session: SheetSession, held: Held): string {
  return session.groups
    .map((g) => {
      const reps = g.reps.join(tTraining('sheetRepsJoin'));
      return g.loadKg === null ? reps : tTraining('sheetLine', { load: formatExerciseLoad(g.loadKg, held), reps });
    })
    .join(tTraining('sheetGroupJoin'));
}

/** Séances récentes (5, « Dernières séances ») ou toutes (« Historique ») : date, séries, ressenti. */
export function SheetSessions({ history, exercise, held, now, limit, label }: StatsProps & { readonly limit: number | null; readonly label: string }) {
  if (history === 'loading') return <Loading />;
  if (history === 'error') return <p className="ct-training__muted">{tTraining('sheetReadError')}</p>;
  const sessions = sheetStats(history, exercise, now).sessions;
  const shown = limit === null ? sessions : sessions.slice(0, limit);
  if (shown.length === 0)
    return (
      <p className="ct-training__muted">
        {tTraining('sheetNone')} {tTraining('sheetNoHistory')}
      </p>
    );
  return (
    <ul className="ct-sheet__sessions" aria-label={label}>
      {shown.map((s) => (
        <li key={s.workoutId} className="ct-sheet__session">
          <span className="ct-training__muted">{formatShortDay(s.endedAt)}</span>
          <span className="ct-sheet__session-sets">{sessionLine(s, held)}</span>
          <span className="ct-training__muted ct-sheet__session-feel">{s.deload ? tTraining('sheetDeload') : s.difficulty === null ? '' : tTraining(DIFFICULTY_KEY[s.difficulty])}</span>
        </li>
      ))}
    </ul>
  );
}
