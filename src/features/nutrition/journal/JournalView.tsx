import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays } from '../../../domain/localDate';
import { aggregateDay, effectiveTarget, remainingForDay, toMealEntryInput, type DayTotals } from '../../../domain/nutrition';
import type { MealEntryRecord } from '../../../db/repositories/mealEntryRepository';
import { formatTime } from '../../../i18n/format';
import { formatDayLong, formatInt, formatTenth, orDash, tNutrition } from '../../../i18n/nutritionText';
import { Button, ConfirmDialog } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { QuickAddForm } from '../quickAdd/QuickAddForm';
import { FoodSearchPanel } from '../search/FoodSearchPanel';
import { MacroLine, nowTime, ProvenanceBadge } from '../shared';
import type { NutritionSnapshot } from '../useCases';
import { EntryEditor } from './EntryEditor';

type Mode = { readonly kind: 'idle' } | { readonly kind: 'search' } | { readonly kind: 'quick' } | { readonly kind: 'edit'; readonly entry: MealEntryRecord };

export interface JournalViewProps {
  readonly snapshot: NutritionSnapshot;
  readonly onChanged: () => Promise<void>;
}

function CoverageNote({ day, isToday }: { readonly day: DayTotals; readonly isToday: boolean }) {
  if (day.entryCount === 0) {
    return (
      <div className="ct-nutrition__coverage" role="status">
        <p className="ct-nutrition__coverage-title">{tNutrition(isToday ? 'emptyToday' : 'emptyOtherDay')}</p>
        <p className="ct-nutrition__muted">{tNutrition('emptyHint')}</p>
      </div>
    );
  }
  const unknownValues = day.reasons.includes('unknown-values');
  return (
    <div className="ct-nutrition__coverage" role="status">
      <p className="ct-nutrition__coverage-title">{tNutrition(day.state === 'complete' ? 'dayCompleteInferred' : 'dayPartial')}</p>
      <p className="ct-nutrition__muted">
        {day.state === 'complete'
          ? tNutrition('dayCompleteDetail')
          : day.entryCount === 1
            ? tNutrition('dayPartialOne')
            : tNutrition('dayPartialDetail', { count: day.entryCount, hours: formatTenth(day.spanHours ?? 0) })}
      </p>
      {unknownValues ? <p className="ct-nutrition__muted">{tNutrition('dayUnknownValues')}</p> : null}
    </div>
  );
}

/**
 * Journal du jour (I4-03, § 15.3, critère 1 ; maquettes iPhone-Journal / PC-Journal) : cibles restantes, couverture de la journée sans faux
 * zéro (une journée sans entrée reste « rien de saisi », une journée partielle n'est pas présentée comme complète), entrées avec provenance,
 * ajout (recherche locale, Ajout rapide), correction et suppression avec confirmation. Le scan et la photo ne sont pas offerts : l'écran le dit.
 */
export function JournalView({ snapshot, onChanged }: JournalViewProps) {
  const container = useAppContainer();
  const { data } = container;
  const navigate = useNavigationStore((s) => s.navigate);
  const [date, setDate] = useState(snapshot.today);
  const [entries, setEntries] = useState<readonly MealEntryRecord[] | null>(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [toDelete, setToDelete] = useState<MealEntryRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isToday = date === snapshot.today;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await (await data.repos.mealEntries()).listByDate(date);
        if (live) setEntries(list);
      } catch {
        if (live) setError(tNutrition('loadError'));
      }
    })();
    return () => {
      live = false;
    };
  }, [data, date, version, snapshot]);

  const afterWrite = useCallback(async (): Promise<void> => {
    setMode({ kind: 'idle' });
    setError(null);
    setVersion((v) => v + 1);
    await onChanged();
  }, [onChanged]);

  const day = useMemo(() => aggregateDay(date, (entries ?? []).map(toMealEntryInput)), [date, entries]);
  const target = effectiveTarget(snapshot.targets, date)?.target ?? null;
  const remaining = remainingForDay(target, day);
  const defaultTime = isToday ? nowTime(container.clock.nowMs()) : '12:00';

  async function confirmDelete(): Promise<void> {
    const entry = toDelete;
    setToDelete(null);
    if (entry === null) return;
    try {
      await (await data.repos.mealEntries()).softDelete(entry.id);
      await afterWrite();
    } catch {
      setError(tNutrition('writeError'));
    }
  }

  const macros: readonly (readonly [string, number | null, number | undefined])[] = [
    [tNutrition('protein'), remaining?.proteinG ?? null, target?.proteinG],
    [tNutrition('carbs'), remaining?.carbG ?? null, target?.carbG],
    [tNutrition('fat'), remaining?.fatG ?? null, target?.fatG],
  ];

  return (
    <div className="ct-nutrition__journal" data-testid="journal">
      <div className="ct-nutrition__daynav" role="group" aria-label={tNutrition('journalDayLabel')}>
        <Button variant="secondary" ariaLabel={tNutrition('previousDay')} onClick={() => setDate(addDays(date, -1))}>
          ‹
        </Button>
        <p className="ct-nutrition__day">{formatDayLong(date)}</p>
        <Button variant="secondary" ariaLabel={tNutrition('nextDay')} disabled={isToday} onClick={() => setDate(addDays(date, 1))}>
          ›
        </Button>
        {isToday ? null : (
          <Button variant="secondary" onClick={() => setDate(snapshot.today)}>
            {tNutrition('backToToday')}
          </Button>
        )}
      </div>

      <section className="ct-nutrition__card" aria-label={tNutrition('currentTarget')}>
        {target === null || remaining === null ? (
          <>
            <p className="ct-nutrition__big">{tNutrition('noTarget')}</p>
            <p className="ct-nutrition__muted">{tNutrition('noTargetHint')}</p>
            {entries !== null && day.entryCount > 0 && day.kcal !== null ? <p className="ct-nutrition__num">{tNutrition('loggedKcal', { n: formatInt(day.kcal) })}</p> : null}
            <Button variant="secondary" onClick={() => navigate({ tab: 'nutrition', screen: 'strategy' })}>
              {tNutrition('setTarget')}
            </Button>
          </>
        ) : (
          <>
            <p className="ct-nutrition__big ct-nutrition__num">
              {remaining.kcal !== null && remaining.kcal < 0
                ? tNutrition('overKcal', { n: formatInt(-remaining.kcal) })
                : tNutrition('remainingKcal', { n: orDash(remaining.kcal, formatInt) })}
            </p>
            <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('targetOfKcal', { n: formatInt(target.kcal) })}</p>
            <dl className="ct-nutrition__macros">
              {macros.map(([label, left, goal]) => (
                <div key={label} className="ct-nutrition__macro">
                  <dt>{label}</dt>
                  <dd className="ct-nutrition__num">{tNutrition('macroRemaining', { left: orDash(left), target: goal === undefined ? tNutrition('unknown') : formatInt(goal) })}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      {entries === null ? (
        error ? null : (
          <p className="ct-nutrition__muted" role="status">
            {tNutrition('loading')}
          </p>
        )
      ) : (
        <CoverageNote day={day} isToday={isToday} />
      )}

      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}

      {mode.kind === 'search' ? (
        <FoodSearchPanel date={date} defaultTime={defaultTime} onSaved={() => void afterWrite()} onClose={() => setMode({ kind: 'idle' })} />
      ) : mode.kind === 'quick' ? (
        <QuickAddForm date={date} defaultTime={defaultTime} onSaved={() => void afterWrite()} onClose={() => setMode({ kind: 'idle' })} />
      ) : mode.kind === 'edit' ? (
        <EntryEditor entry={mode.entry} onSaved={() => void afterWrite()} onClose={() => setMode({ kind: 'idle' })} />
      ) : (
        <div className="ct-nutrition__add">
          <div className="ct-nutrition__actions">
            <Button onClick={() => setMode({ kind: 'search' })}>{tNutrition('addSearch')}</Button>
            <Button variant="secondary" onClick={() => setMode({ kind: 'quick' })}>
              {tNutrition('addQuick')}
            </Button>
          </div>
          <p className="ct-nutrition__muted">{tNutrition('scanLater')}</p>
          <p className="ct-nutrition__muted">{tNutrition('scanLaterHint')}</p>
        </div>
      )}

      {entries !== null && entries.length > 0 ? (
        <ul className="ct-nutrition__entries" aria-label={tNutrition('entriesLabel')}>
          {entries.map((entry) => (
            <li key={entry.id} className="ct-nutrition__entry">
              <span className="ct-nutrition__time ct-nutrition__num">{formatTime(entry.time)}</span>
              <div className="ct-nutrition__entry-main">
                <p className="ct-nutrition__entry-name">
                  <span>{entry.foodName}</span> <ProvenanceBadge source={entry.source} />
                </p>
                <p className="ct-nutrition__muted ct-nutrition__num">
                  {entry.grams === null ? null : <span>{tNutrition('gramsValue', { n: formatTenth(entry.grams) })} · </span>}
                  <MacroLine p={orDash(entry.proteinG)} c={orDash(entry.carbG)} f={orDash(entry.fatG)} />
                </p>
              </div>
              <p className="ct-nutrition__entry-kcal ct-nutrition__num">{entry.kcal === null ? tNutrition('unknown') : tNutrition('kcalValue', { n: formatInt(entry.kcal) })}</p>
              <div className="ct-nutrition__entry-actions">
                <Button variant="secondary" ariaLabel={tNutrition('editEntry', { name: entry.foodName })} onClick={() => setMode({ kind: 'edit', entry })}>
                  {tNutrition('edit')}
                </Button>
                <Button variant="secondary" ariaLabel={tNutrition('deleteEntry', { name: entry.foodName })} onClick={() => setToDelete(entry)}>
                  {tNutrition('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title={tNutrition('deleteTitle', { name: toDelete.foodName })}
          description={tNutrition('deleteDescription')}
          confirmLabel={tNutrition('delete')}
          cancelLabel={tNutrition('cancel')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </div>
  );
}
