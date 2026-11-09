import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { aggregateDay, remainingForDay, toMealEntryInput, type DayTotals, type Remaining, type Target } from '../../domain/nutrition';
import { formatInt, tNutrition } from '../../i18n/nutritionText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';
import { useSyncedData } from '../sync/remoteChanges';

type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly day: DayTotals; readonly target: Target | null; readonly remaining: Remaining | null };

/**
 * Carte « Nutrition » d'Aujourd'hui (I4-03, critère 7) : seulement ce qu'il reste de la cible et l'état de la journée. Sans cible, elle le dit
 * et mène à Stratégie ; journée sans entrée, la cible entière reste à faire (« rien de saisi », jamais un zéro). Bloc chargé à la demande
 * (jamais dans le départ) ; lecture impossible : rien n'est affiché.
 */
export function NutritionRemainingCard() {
  const container = useAppContainer();
  const { data } = container;
  const navigate = useNavigationStore((s) => s.navigate);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const synced = useSyncedData(['meal_entry', 'nutrition_target', 'day_completeness']);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const today = todayLocal(container.clock);
        const [entries, targets, completeness] = await Promise.all([data.repos.mealEntries(), data.repos.nutritionTargets(), data.repos.dayCompleteness()]);
        const [list, effective, declared] = await Promise.all([entries.listByDate(today), targets.effective(today), completeness.get(today)]);
        // La déclaration d'Ali prime sur la déduction (D-81) : même état que le Journal.
        const day = aggregateDay(today, list.map(toMealEntryInput), declared?.state);
        const target = effective?.target ?? null;
        if (live) setLoad({ status: 'ready', day, target, remaining: remainingForDay(target, day) });
      } catch {
        if (live) setLoad({ status: 'failed' });
      }
    })();
    return () => {
      live = false;
    };
  }, [data, container, synced]);

  if (load.status !== 'ready') return null;
  const { day, target, remaining } = load;
  return (
    <section className="ct-today__card ct-nutrition-card" aria-labelledby="ct-nutrition-card-title">
      <h2 id="ct-nutrition-card-title" className="ct-today__eyebrow">
        {tNutrition('cardTitle')}
      </h2>
      {target === null || remaining === null || remaining.kcal === null ? (
        <>
          <p className="ct-today__text">{target === null ? tNutrition('noTarget') : tNutrition('unknown')}</p>
          {day.entryCount === 0 ? <p className="ct-today__muted">{tNutrition('emptyToday')}</p> : null}
        </>
      ) : (
        <>
          <p className="ct-today__text">{remaining.kcal < 0 ? tNutrition('overKcal', { n: formatInt(-remaining.kcal) }) : tNutrition('remainingKcal', { n: formatInt(remaining.kcal) })}</p>
          <p className="ct-today__muted">{day.entryCount === 0 ? tNutrition('emptyToday') : tNutrition(day.state === 'complete' ? (day.origin === 'declared' ? 'dayCompleteDeclared' : 'dayCompleteInferred') : 'dayPartial')}</p>
        </>
      )}
      {target === null ? (
        <Button variant="secondary" fullWidth onClick={() => navigate({ tab: 'nutrition', screen: 'strategy' })}>
          {tNutrition('setTarget')}
        </Button>
      ) : (
        <Button variant="secondary" fullWidth onClick={() => navigate({ tab: 'nutrition', screen: 'journal' })}>
          {tNutrition('cardOpen')}
        </Button>
      )}
    </section>
  );
}
