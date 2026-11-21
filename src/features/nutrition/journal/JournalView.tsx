import { tPlural } from '../../../i18n/plural';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayTargetFor } from '../../../domain/nutrition/restDay';
import { addDays } from '../../../domain/localDate';
import type { LocalDate } from '../../../domain/types';
import { aggregateDay, effectiveTarget, remainingForDay, toMealEntryInput, type DayDeclaration, type DayTotals } from '../../../domain/nutrition';
import type { MealEntryRecord } from '../../../db/repositories/mealEntryRepository';
import { formatTime } from '../../../i18n/format';
import { formatDayLong, formatInt, formatTenth, orDash, tNutrition } from '../../../i18n/nutritionText';
import { Button, ConfirmDialog, SegmentedControl } from '../../../ui';
import { ContextMenuZone } from '../../../ui/ContextMenu';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { QuickAddForm } from '../quickAdd/QuickAddForm';
import { FoodSearchPanel } from '../search/FoodSearchPanel';
import { KcalHero, MacroLine, nowTime, ProvenanceBadge } from '../shared';
import type { NutritionSnapshot } from '../useCases';
import { EntryEditor } from './EntryEditor';

type DeclarationChoice = 'none' | DayDeclaration;

/** Un formulaire ouvert garde le jour de son ouverture (C-097) : ni la navigation ni minuit ne le déplacent. */
type Mode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'search'; readonly date: LocalDate }
  | { readonly kind: 'quick'; readonly date: LocalDate }
  | { readonly kind: 'edit'; readonly entry: MealEntryRecord; readonly date: LocalDate };

export interface JournalViewProps {
  readonly snapshot: NutritionSnapshot;
  readonly onChanged: () => Promise<void>;
  /** ERGO-01b P2 : recherche ouverte d'office (route `search`). */
  readonly openSearch?: boolean;
}

/** Couverture du jour : dit si l'état est DÉCLARÉ par Ali ou DÉDUIT (D-81) ; une journée sans entrée reste inconnue, même déclarée complète. */
function CoverageNote({ day, isToday }: { readonly day: DayTotals; readonly isToday: boolean }) {
  if (day.entryCount === 0) {
    return (
      <div className="ct-nutrition__coverage" role="status">
        <p className="ct-nutrition__coverage-title">{tNutrition(isToday ? 'emptyToday' : 'emptyOtherDay')}</p>
        <p className="ct-nutrition__muted">{tNutrition('emptyHint')}</p>
        {day.reasons.includes('declared-without-entries') ? <p className="ct-nutrition__muted">{tNutrition('dayDeclaredWithoutEntries')}</p> : null}
      </div>
    );
  }
  const unknownValues = day.reasons.includes('unknown-values');
  const declared = day.origin === 'declared';
  const title = declared ? (day.state === 'complete' ? 'dayCompleteDeclared' : 'dayIncompleteDeclared') : day.state === 'complete' ? 'dayCompleteInferred' : 'dayPartial';
  return (
    <div className="ct-nutrition__coverage" role="status">
      <p className="ct-nutrition__coverage-title">{tNutrition(title)}</p>
      <p className="ct-nutrition__muted">
        {declared
          ? tNutrition(day.state === 'complete' ? 'dayCompleteDeclaredDetail' : 'dayIncompleteDeclaredDetail')
          : day.state === 'complete'
            ? tNutrition('dayCompleteDetail')
            : tPlural(tNutrition, day.entryCount, 'dayPartialDetailOne', 'dayPartialDetail', { hours: formatTenth(day.spanHours ?? 0) })}
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
export function JournalView({ snapshot, onChanged, openSearch = false }: JournalViewProps) {
  const container = useAppContainer();
  const { data } = container;
  const navigate = useNavigationStore((s) => s.navigate);
  // Jour choisi par Ali ; `null` = suit « aujourd'hui » (relu à minuit et au retour au premier plan, C-096).
  const [picked, setPicked] = useState<LocalDate | null>(null);
  // Entrées lues AVEC leur date : changer de jour ne montre jamais les entrées (ni leurs actions) d'un autre jour.
  const [loaded, setLoaded] = useState<{ readonly date: LocalDate; readonly list: readonly MealEntryRecord[]; readonly declaration: DayDeclaration | null } | null>(null);
  const [version, setVersion] = useState(0);
  // ERGO-01b P2 : ouvert depuis « Ajouter un repas » d'Aujourd'hui, la recherche est déjà ouverte (champ actif).
  const [mode, setMode] = useState<Mode>(openSearch ? { kind: 'search', date: snapshot.today } : { kind: 'idle' });
  const date = mode.kind === 'idle' ? (picked ?? snapshot.today) : mode.date;
  const formOpen = mode.kind !== 'idle';
  const entries = loaded !== null && loaded.date === date ? loaded.list : null;
  const [toDelete, setToDelete] = useState<MealEntryRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declBusy, setDeclBusy] = useState(false);
  const isToday = date === snapshot.today;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await (await data.repos.mealEntries()).listByDate(date);
        const declaration = (await (await data.repos.dayCompleteness()).get(date))?.state ?? null;
        if (live) {
          setLoaded({ date, list, declaration });
          setError(null);
        }
      } catch {
        if (live) setError(tNutrition('loadError'));
      }
    })();
    return () => {
      live = false;
    };
  }, [data, date, version, snapshot]);

  const afterWrite = useCallback(async (keepForm = false): Promise<void> => {
    if (!keepForm) setMode({ kind: 'idle' });
    setError(null);
    setVersion((v) => v + 1);
    await onChanged();
  }, [onChanged]);

  const declaration = loaded !== null && loaded.date === date ? loaded.declaration : null;
  const day = useMemo(() => aggregateDay(date, (entries ?? []).map(toMealEntryInput), declaration ?? undefined), [date, entries, declaration]);
  // PROG-01 (D-270) : cible du type de jour (entraînement ou repos) ; sans cible de repos, la cible unique.
  const record = effectiveTarget(snapshot.targets, date);
  const dayTarget = record === null ? null : dayTargetFor(record.target, record.restPlan ?? null, date, snapshot.strengthDays ?? new Set());
  const target = dayTarget?.target ?? null;
  // Tant que le journal du jour n'est pas lu (chargement, échec), aucun restant n'est affiché : « — », jamais la cible entière.
  const remaining = entries === null ? (target === null ? null : { kcal: null, proteinG: null, fatG: null, carbG: null }) : remainingForDay(target, day);
  const defaultTime = isToday ? nowTime(container.clock.nowMs()) : '12:00';

  /** Déclare (complète / incomplète) ou efface (« Non déclarée ») la journée affichée ; la relecture du snapshot met à jour dashboard et dépense. */
  async function chooseDeclaration(next: DeclarationChoice): Promise<void> {
    if (declBusy) return;
    setDeclBusy(true);
    try {
      const repo = await data.repos.dayCompleteness();
      if (next === 'none') await repo.clear(date);
      else await repo.declare(date, next);
      setError(null);
      setVersion((v) => v + 1);
      await onChanged();
    } catch {
      setError(tNutrition('dayDeclError'));
    } finally {
      setDeclBusy(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    const entry = toDelete;
    setToDelete(null);
    if (entry === null) return;
    try {
      await (await data.repos.mealEntries()).softDelete(entry.id);
      // C-098 : une écriture étrangère ne ferme pas le formulaire en cours ; supprimer l'entrée en correction le ferme.
      await afterWrite(!(mode.kind === 'edit' && mode.entry.id === entry.id) && mode.kind !== 'idle');
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
        <Button variant="secondary" ariaLabel={tNutrition('previousDay')} disabled={formOpen} onClick={() => setPicked(addDays(date, -1))}>
          ‹
        </Button>
        <p className="ct-nutrition__day">{formatDayLong(date)}</p>
        <Button variant="secondary" ariaLabel={tNutrition('nextDay')} disabled={isToday || formOpen} onClick={() => setPicked(addDays(date, 1))}>
          ›
        </Button>
        {isToday ? null : (
          <Button variant="secondary" disabled={formOpen} onClick={() => setPicked(null)}>
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
            <KcalHero kcal={remaining.kcal} />
            <p className="ct-nutrition__muted ct-nutrition__num">{tNutrition('targetOfKcal', { n: formatInt(target.kcal) })}</p>
            {dayTarget?.type ? <p className="ct-nutrition__muted">{tNutrition(dayTarget.type === 'rest' ? 'dayTypeRest' : 'dayTypeTraining')}</p> : null}
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
        <>
          <CoverageNote day={day} isToday={isToday} />
          <div className="ct-nutrition__declaration">
            <SegmentedControl<DeclarationChoice>
              label={tNutrition('dayDeclLabel')}
              value={declaration ?? 'none'}
              disabled={declBusy}
              onChange={(next) => void chooseDeclaration(next)}
              options={[
                { value: 'none', label: tNutrition('dayDeclNone') },
                { value: 'complete', label: tNutrition('dayDeclComplete') },
                { value: 'incomplete', label: tNutrition('dayDeclIncomplete') },
              ]}
            />
            <p className="ct-nutrition__muted">{tNutrition('dayDeclHint')}</p>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}

      {mode.kind === 'search' ? (
        <FoodSearchPanel date={mode.date} defaultTime={defaultTime} onSaved={() => void afterWrite()} onClose={() => setMode({ kind: 'idle' })} />
      ) : mode.kind === 'quick' ? (
        <QuickAddForm date={mode.date} defaultTime={defaultTime} onSaved={() => void afterWrite()} onClose={() => setMode({ kind: 'idle' })} />
      ) : mode.kind === 'edit' ? (
        <EntryEditor entry={mode.entry} onSaved={() => void afterWrite()} onClose={() => setMode({ kind: 'idle' })} />
      ) : (
        <div className="ct-nutrition__add">
          <div className="ct-nutrition__actions">
            <Button onClick={() => setMode({ kind: 'search', date })}>{tNutrition('addSearch')}</Button>
            <Button variant="secondary" onClick={() => setMode({ kind: 'quick', date })}>
              {tNutrition('addQuick')}
            </Button>
          </div>
        </div>
      )}

      {entries !== null && entries.length > 0 ? (
        <ul className="ct-nutrition__entries" aria-label={tNutrition('entriesLabel')}>
          {entries.map((entry) => (
            <ContextMenuZone
              key={entry.id}
              items={[
                { id: 'edit', label: tNutrition('edit'), onSelect: () => setMode({ kind: 'edit', entry, date }) },
                { id: 'delete', label: tNutrition('delete'), onSelect: () => setToDelete(entry), danger: true },
              ]}
              menuLabel={tNutrition('entryActions', { name: entry.foodName })}
              onActivate={() => setMode({ kind: 'edit', entry, date })}
            >
              {(bind) => (
                <li className="ct-nutrition__entry" {...bind}>
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
                    <Button variant="secondary" ariaLabel={tNutrition('editEntry', { name: entry.foodName })} onClick={() => setMode({ kind: 'edit', entry, date })}>
                      {tNutrition('edit')}
                    </Button>
                    <Button variant="secondary" ariaLabel={tNutrition('deleteEntry', { name: entry.foodName })} onClick={() => setToDelete(entry)}>
                      {tNutrition('delete')}
                    </Button>
                  </div>
                </li>
              )}
            </ContextMenuZone>
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
