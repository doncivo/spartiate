import { todayLocal } from '../../domain/clock';
import { tNutrition } from '../../i18n/nutritionText';
import { Button, SegmentedControl, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore, type NutritionScreenId } from '../app/navigation';
import { CheckInView } from './checkIn/CheckInView';
import { DashboardView } from './dashboard/DashboardView';
import { JournalView } from './journal/JournalView';
import { StrategyView } from './strategy/StrategyView';
import { useNutritionData } from './useNutritionData';
import './NutritionScreen.css';

/**
 * Onglet Nutrition (I4-03, § 15.2–15.5, § 18.1–18.6) : Journal (par défaut), Dashboard, Stratégie et Check-in, comme la barre de sections
 * des maquettes iPhone-Journal / iPhone-Dashboard / iPhone-CheckIn et PC-Journal. Bloc à la demande, avec son catalogue de textes.
 *
 * Périmètre : recherche locale (fiches personnelles, Ciqual, cache), Quick Add, corrections ; Open Food Facts (« Chercher en ligne », code-barres saisi ou scanné sur iPhone, I4-05) sur geste d'Ali seulement ; la photo
 * IA reste hors périmètre. Le moteur d'I4-01 propose, Ali décide : aucune cible ne change sans son geste.
 */
export function NutritionScreen() {
  const container = useAppContainer();
  const layout = useLayout();
  const route = useNavigationStore((s) => s.route);
  const navigate = useNavigationStore((s) => s.navigate);
  const current: NutritionScreenId = route.tab === 'nutrition' ? (route.screen ?? 'journal') : 'journal';
  const today = todayLocal(container.clock);
  const { state, reload } = useNutritionData(container.data, today);

  return (
    <div className="ct-nutrition-shell" data-layout={layout}>
      <section className="ct-nutrition" aria-labelledby="ct-nutrition-title">
        <h1 id="ct-nutrition-title" className="ct-nutrition__title">
          {tNutrition('title')}
        </h1>
        <SegmentedControl
          scrollable
          label={tNutrition('sectionsLabel')}
          value={current}
          onChange={(screen) => navigate({ tab: 'nutrition', screen })}
          options={[
            { value: 'journal', label: tNutrition('sectionJournal') },
            { value: 'dashboard', label: tNutrition('sectionDashboard') },
            { value: 'strategy', label: tNutrition('sectionStrategy') },
            { value: 'checkin', label: tNutrition('sectionCheckIn') },
          ]}
        />
        {state.status === 'loading' ? (
          <p className="ct-nutrition__muted" role="status">
            {tNutrition('loading')}
          </p>
        ) : state.status === 'error' ? (
          <div role="alert" className="ct-nutrition__error">
            <p>{tNutrition('loadError')}</p>
            <Button variant="secondary" onClick={() => void reload()}>
              {tNutrition('retry')}
            </Button>
          </div>
        ) : current === 'dashboard' ? (
          <DashboardView snapshot={state.snapshot} />
        ) : current === 'strategy' ? (
          <StrategyView snapshot={state.snapshot} onChanged={reload} />
        ) : current === 'checkin' ? (
          <CheckInView snapshot={state.snapshot} onChanged={reload} />
        ) : (
          <JournalView snapshot={state.snapshot} onChanged={reload} />
        )}
      </section>
    </div>
  );
}
