import { useEffect, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { aggregateDay, remainingForDay, toMealEntryInput, type DayTotals, type DayType, type Remaining, type Target } from '../../domain/nutrition';
import { tNutrition } from '../../i18n/nutritionText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';
import { useSyncedData } from '../sync/remoteChanges';
import { loadDayTarget } from './dayType';
import { KcalHero } from './shared';

type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly day: DayTotals; readonly target: Target | null; readonly remaining: Remaining | null; readonly dayType: DayType | null };

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
        const [entries, completeness] = await Promise.all([data.repos.mealEntries(), data.repos.dayCompleteness()]);
        // PROG-01 (D-270) : cible du type de jour (entraînement ou repos) ; sans cible de repos, la cible unique.
        const [list, effective, declared] = await Promise.all([entries.listByDate(today), loadDayTarget(data, today), completeness.get(today)]);
        // La déclaration d'Ali prime sur la déduction (D-81) : même état que le Journal.
        const day = aggregateDay(today, list.map(toMealEntryInput), declared?.state);
        const target = effective?.target ?? null;
        if (live) setLoad({ status: 'ready', day, target, remaining: remainingForDay(target, day), dayType: effective?.type ?? null });
      } catch {
        if (live) setLoad({ status: 'failed' });
      }
    })();
    return () => {
      live = false;
    };
  }, [data, container, synced]);

  if (load.status !== 'ready') return null;
  const { day, target, remaining, dayType } = load;
  return (
    // ERGO-01 : bloc à plat (Aujourdhui-apres.dc.html), le chiffre héros suffit à le détacher ; marge de carte conservée.
    <section className="ct-today__card ct-today__card--flat ct-nutrition-card" aria-labelledby="ct-nutrition-card-title">
      <h2 id="ct-nutrition-card-title" className="ct-today__eyebrow ct-section-title">
        {tNutrition('cardTitle')}
      </h2>
      {target === null || remaining === null || remaining.kcal === null ? (
        <>
          <p className="ct-today__text">{target === null ? tNutrition('noTarget') : tNutrition('unknown')}</p>
          {day.entryCount === 0 ? <p className="ct-today__muted">{tNutrition('emptyToday')}</p> : null}
        </>
      ) : (
        <>
          <KcalHero kcal={remaining.kcal} />
          {dayType !== null ? <p className="ct-today__muted">{tNutrition(dayType === 'rest' ? 'dayTypeRest' : 'dayTypeTraining')}</p> : null}
          <p className="ct-today__muted">{day.entryCount === 0 ? tNutrition('emptyToday') : tNutrition(day.state === 'complete' ? (day.origin === 'declared' ? 'dayCompleteDeclared' : 'dayCompleteInferred') : 'dayPartial')}</p>
        </>
      )}
      {/* ERGO-01b P2 (D-238) : un écran de moins, le Journal s'ouvre recherche active. Contour : le rouge d'Aujourd'hui reste à la séance. */}
      <Button variant="secondary" fullWidth onClick={() => navigate({ tab: 'nutrition', screen: 'journal', search: true })}>
        {tNutrition('cardAddMeal')}
      </Button>
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
