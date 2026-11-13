import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { todayLocal } from '../../domain/clock';
import type { PersonalRecord } from '../../domain/training/closure';
import { dumbbellsHeld } from '../../domain/training/dumbbellPair';
import { loadGrid } from '../../domain/training/loadGrid';
import type { LocalDate } from '../../domain/types';
import { formatInt, tNutrition } from '../../i18n/nutritionText';
import { formatStamp } from '../../i18n/format';
import { tToday } from '../../i18n/todayText';
import { tTodayPc } from '../../i18n/todayPcText';
import { formatExerciseLoad } from '../../i18n/trainingText';
import { MissingValue } from '../../ui/MissingValue';
import { useSyncedData } from '../sync/remoteChanges';
import { loadNutritionSnapshot, type NutritionSnapshot } from '../nutrition/useCases';
import { localDayOf } from '../training/cycle/currentCycle';
import { readTrainingData } from '../training/trainingState';
import { useAppContainer } from './AppContainerContext';
import './TodayScreen.css';

/**
 * Colonne de droite d'Aujourd'hui sur PC (ERGO-02, PC-Aujourdhui-apres.dc.html) : macros du jour sous la carte Nutrition, la carte Poids de
 * l'écran (`weight`), la dépense, la semaine (jours de séance) et les derniers records. Lectures déjà employées ailleurs (instantané de
 * Nutrition, séances closes, records de la clôture) ; aucune règle neuve. Module à part, chargé à la demande par son hôte
 * (`lazyScreens.TodayPcSide`) : l'écran du départ ne l'importe jamais. Donnée manquante : « — » et sa raison, jamais un zéro.
 */
const DAY_MS = 86_400_000;
const WEEK = 7;
const RECENT = 10;
const RECORD_WORKOUTS = 3;
const RECORDS_SHOWN = 3;

interface RecordRow {
  readonly exerciseId: string;
  readonly name: string;
  readonly text: string;
}
interface Ready {
  readonly status: 'ready';
  readonly snapshot: NutritionSnapshot;
  /** Jours locaux des séances closes de la semaine. */
  readonly doneDays: ReadonlySet<string>;
  readonly records: readonly RecordRow[];
}
type Load = { readonly status: 'loading' | 'failed' } | Ready;

/** Les sept jours (lundi au dimanche) de la semaine de `today`, avec leur nom (« mardi ») et son abrégé (« mar »). */
function weekOf(today: LocalDate): readonly { readonly day: string; readonly name: string; readonly short: string }[] {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const base = Date.UTC(y, m - 1, d);
  const monday = base - ((new Date(base).getUTCDay() + 6) % WEEK) * DAY_MS;
  const names = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });
  return Array.from({ length: WEEK }, (_, i) => {
    const at = new Date(monday + i * DAY_MS);
    const name = names.format(at);
    return { day: at.toISOString().slice(0, 10), name, short: name.slice(0, 3) };
  });
}

/**
 * Records de charge des `RECORD_WORKOUTS` dernières séances closes : exactement ceux du résumé de séance (`summary`, même règle que la
 * clôture, comparée à tout l'historique de l'exercice). Le catalogue n'est lu que s'il y a un record à nommer.
 */
async function readRecords(container: ReturnType<typeof useAppContainer>, closedIds: readonly string[]): Promise<readonly RecordRow[]> {
  const workouts = await container.data.repos.workouts();
  const found: PersonalRecord[] = [];
  for (const id of closedIds.slice(0, RECORD_WORKOUTS)) {
    for (const record of (await workouts.summary(id)).records) {
      if (record.kind === 'load' && !found.some((f) => f.exerciseId === record.exerciseId)) found.push(record);
    }
  }
  if (found.length === 0) return [];
  const data = await readTrainingData(container.data);
  const exerciseOf = (id: string) => data.content.catalog.get(id) ?? data.allCustoms.find((c) => c.id === id);
  return found.slice(0, RECORDS_SHOWN).map((record) => {
    const exercise = exerciseOf(record.exerciseId);
    const held = exercise === undefined ? null : dumbbellsHeld(exercise, loadGrid(exercise.equipment, data.active)?.source);
    return { exerciseId: record.exerciseId, name: record.exerciseName, text: formatExerciseLoad(record.value, held) };
  });
}

export interface TodayPcSideProps {
  /** Carte Poids, rendue par Aujourd'hui (départ) et placée ici dans l'ordre de l'aperçu. */
  readonly weight: ReactNode;
  /** Carte « État » (petite, en dernier) : ligne de synchro déjà formulée, dernière sauvegarde (undefined : indisponible ici ; null : jamais). */
  readonly state: { readonly sync: string; readonly backupMs: number | null | undefined; readonly nowMs: number };
}

/** ERGO-02 (D-262) : carte « État » (synchro, signature, Apple Santé, sauvegarde, dernier export) ; une donnée absente dit sa raison. */
function StateCard({ sync, backupMs, nowMs }: TodayPcSideProps['state']) {
  const backup = backupMs === undefined ? <MissingValue reason={tTodayPc('backupUnknown')} /> : backupMs === null ? tToday('never') : formatStamp(new Date(backupMs).toISOString(), nowMs);
  const rows: readonly (readonly [string, ReactNode])[] = [
    [tToday('sync'), sync],
    [tToday('signature'), <MissingValue key="signature" reason={tTodayPc('signatureMissing')} />],
    [tToday('healthKit'), <MissingValue key="healthKit" reason={tTodayPc('healthKitMissing')} />],
    [tToday('backup'), backup],
    [tToday('lastExport'), <MissingValue key="lastExport" reason={tTodayPc('lastExportMissing')} />],
  ];
  return (
    <section className="ct-today__card ct-today__kv ct-today__state" aria-labelledby="ct-today-state">
      <h2 id="ct-today-state" className="ct-today__eyebrow ct-section-title">
        {tToday('stateEyebrow')}
      </h2>
      <dl className="ct-today__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="ct-today__row ct-today__row--kv">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function TodayPcSide({ weight, state }: TodayPcSideProps) {
  const container = useAppContainer();
  const { data, clock } = container;
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const synced = useSyncedData(['meal_entry', 'nutrition_target', 'day_completeness', 'workout', 'workout_set']);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const today = todayLocal(clock);
        const snapshot = await loadNutritionSnapshot(data, today);
        const workouts = await data.repos.workouts();
        const closed = await workouts.listClosed(RECENT);
        const week = new Set(weekOf(today).map((d) => d.day));
        const doneDays = new Set(closed.flatMap((w) => (w.endedAt === null ? [] : [localDayOf(Date.parse(w.endedAt))])).filter((d) => week.has(d)));
        let records: readonly RecordRow[] = [];
        try {
          records = await readRecords(container, closed.map((w) => w.id));
        } catch {
          records = [];
        }
        if (live) setLoad({ status: 'ready', snapshot, doneDays, records });
      } catch {
        if (live) setLoad({ status: 'failed' });
      }
    })();
    return () => {
      live = false;
    };
  }, [data, clock, container, synced]);

  // La carte Poids garde sa clé d'un état à l'autre : elle n'est pas démontée quand la colonne finit de se lire (aucun clignotement).
  const stateCard = <StateCard key="state" {...state} />;
  if (load.status !== 'ready')
    return (
      <>
        <Fragment key="weight">{weight}</Fragment>
        {stateCard}
      </>
    );
  const { snapshot, doneDays, records } = load;
  const today = snapshot.today;
  const day = snapshot.days.find((d) => d.date === today);
  const target = snapshot.target?.target ?? null;
  const tdee = snapshot.tdee;
  const macros = [
    { key: 'macroProtein', done: day?.proteinG ?? null, goal: target?.proteinG ?? null },
    { key: 'macroCarb', done: day?.carbG ?? null, goal: target?.carbG ?? null },
    { key: 'macroFat', done: day?.fatG ?? null, goal: target?.fatG ?? null },
  ] as const;
  const week = weekOf(today);
  const count = week.filter((d) => doneDays.has(d.day)).length;

  return (
    <>
      {target === null ? null : (
        <ul className="ct-today__macros" aria-label={tTodayPc('macrosLabel')}>
          {macros.map((m) => {
            const goal = m.goal ?? 0;
            const pct = m.done === null || goal <= 0 ? 0 : Math.max(0, Math.min(100, (m.done / goal) * 100));
            return (
              <li key={m.key} className="ct-today__macro">
                <span className="ct-today__macro-bar" aria-hidden="true">
                  <span className="ct-today__macro-fill" style={{ width: `${String(pct)}%` }} />
                </span>
                <span className="ct-today__macro-text">
                  <span className="ct-today__muted">{tTodayPc(m.key)}</span>{' '}
                  {m.done === null ? <MissingValue reason={tTodayPc('macroUnknown')} /> : tTodayPc('macroOf', { done: formatInt(m.done), target: formatInt(m.goal ?? 0) })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Fragment key="weight">{weight}</Fragment>
      <section className="ct-today__card ct-today__card--flat" aria-labelledby="ct-today-spend">
        <h2 id="ct-today-spend" className="ct-today__eyebrow ct-section-title">
          {tTodayPc('spendEyebrow')}
        </h2>
        {tdee.value === null ? (
          <p className="ct-today__text">
            <MissingValue reason={tTodayPc('spendMissing')} />
          </p>
        ) : (
          <>
            <p className="ct-today__text">
              <b className="ct-today__figure">{formatInt(tdee.value)}</b> <span className="ct-today__muted">{tTodayPc('spendUnit')}</span>
            </p>
            <p className="ct-today__muted">{tdee.basis === 'formula' ? tNutrition('tdeeBasisFormula') : tdee.basis === 'blend' ? tNutrition('tdeeBasisBlend', { pct: formatInt(tdee.weightMeasured * 100) }) : tNutrition('tdeeBasisMeasured')}</p>
          </>
        )}
      </section>
      <section className="ct-today__card ct-today__card--flat" aria-label={tTodayPc('weekEyebrow')}>
        <h2 className="ct-today__eyebrow ct-section-title">
          {tTodayPc('weekEyebrow')}
          {count === 0 ? '' : ` · ${count === 1 ? tTodayPc('weekCountOne') : tTodayPc('weekCount', { n: count })}`}
        </h2>
        <ul className="ct-today__week">
          {week.map((d) => {
            const done = doneDays.has(d.day);
            return (
              <li key={d.day} className={['ct-today__week-day', done ? 'ct-today__week-day--done' : '', d.day === today ? 'ct-today__week-day--today' : ''].filter(Boolean).join(' ')} aria-label={`${d.name} : ${tTodayPc(done ? 'weekDone' : 'weekNone')}`}>
                <span className="ct-today__week-mark" aria-hidden="true" />
                <span className="ct-today__muted" aria-hidden="true">
                  {d.short}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="ct-today__card ct-today__card--flat" aria-labelledby="ct-today-records">
        <h2 id="ct-today-records" className="ct-today__eyebrow ct-section-title">
          {tTodayPc('recordsEyebrow')}
        </h2>
        {records.length === 0 ? (
          <p className="ct-today__text">
            <MissingValue reason={tTodayPc('recordsMissing')} />
          </p>
        ) : (
          <ul className="ct-today__records">
            {records.map((r) => (
              <li key={r.exerciseId} className="ct-today__record">
                <span>{r.name}</span>
                <b className="ct-today__record-value">{r.text}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
      {stateCard}
    </>
  );
}
