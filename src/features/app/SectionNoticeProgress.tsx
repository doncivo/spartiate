import type { FirstWeekday } from '../../domain/week';
import { getFirstWeekday } from '../../i18n/formatPrefs';
import { tProgressTabs, type ProgressTabsTextKey } from '../../i18n/progressTabsText';
import { Tabs, type TabItem } from '../../ui/Tabs';
import { BodyProgress, CardioProgress, lazyScreen, RecoveryProgress } from './lazyScreens';
import { BODY_TAB_IDS, PROGRESS_TAB_IDS, useNavigationStore, type BodyTabId, type ProgressTabId } from './navigation';

/**
 * STR-01 : Progrès › Strength Score, bloc à part chargé avec son catalogue de textes et ses normes. Déclaré ici (bloc à la demande de Progrès)
 * plutôt que dans lazyScreens.tsx : rien n'entre dans le départ.
 */
const StrengthScore = lazyScreen<object>(() => import('../strength/StrengthScore').then((m) => ({ default: m.StrengthScore })), undefined, { onDemand: true });
/** PROGRES (§ 17.1) : Progrès › Entraînement (volume, constance, adhérence), bloc à part chargé avec son catalogue de textes ; rien dans le départ. */
const TrainingProgress = lazyScreen<{ readonly firstWeekday?: FirstWeekday }>(() => import('../progress/TrainingProgress').then((m) => ({ default: m.TrainingProgress })), undefined, { onDemand: true });
/** BILAN-029 (§ 17.3) : Progrès › Bilan de la semaine, bloc à part chargé avec son catalogue de textes et sa règle ; rien dans le départ. */
const WeeklyReview = lazyScreen<{ readonly firstWeekday?: FirstWeekday }>(() => import('../progress/WeeklyReview').then((m) => ({ default: m.WeeklyReview })), undefined, { onDemand: true });
/** SUIVIS-029 : Progrès › Suivis (objectifs, pas par semaine, zone 2, notes sur 10), bloc à part chargé avec son catalogue de textes ; rien dans le départ. */
const TrackingProgress = lazyScreen<object>(() => import('../tracking/TrackingProgress').then((m) => ({ default: m.TrackingProgress })), undefined, { onDemand: true });

const TAB_TEXT: Record<ProgressTabId, ProgressTabsTextKey> = {
  recovery: 'tab_recovery',
  sessions: 'tab_sessions',
  review: 'tab_review',
  strength: 'tab_strength',
  body: 'tab_body',
  activity: 'tab_activity',
};

const BODY_TEXT: Record<BodyTabId, ProgressTabsTextKey> = {
  measures: 'body_measures',
  health: 'body_health',
  visbody: 'body_visbody',
  photos: 'body_photos',
};

/**
 * PROG-0301a (BL-177, D-700, D-701, D-712, D-719) : Progrès en 6 onglets, sur l'iPhone et sur le PC. Chaque onglet ne rend (et donc n'importe)
 * que ses blocs, à son ouverture ; cet hôte est lui-même un bloc à la demande. Aucun bloc ne disparaît (liste figée P-01 à P-38,
 * `SectionNoticeProgress.inventory.test.tsx`) ; chaque bloc garde sa frontière d'erreur (« Impossible d'afficher cet écran. », P-37) et ses états.
 * Onglet et sous-onglet de Corps : `progressView` du store de navigation (mémoire seulement).
 */
export function SectionNoticeProgress() {
  const view = useNavigationStore((s) => s.progressView);
  const setView = useNavigationStore((s) => s.setProgressView);
  const tabs: readonly TabItem<ProgressTabId>[] = PROGRESS_TAB_IDS.map((id) => ({ id, label: tProgressTabs(TAB_TEXT[id]) }));
  const bodyTabs: readonly TabItem<BodyTabId>[] = BODY_TAB_IDS.map((id) => ({ id, label: tProgressTabs(BODY_TEXT[id]) }));
  return (
    <Tabs className="ct-progress-tabs" label={tProgressTabs('tabsLabel')} idBase="ct-progress" items={tabs} value={view.tab} onChange={(tab) => setView({ tab })}>
      {view.tab === 'recovery' ? <RecoveryProgress /> : null}
      {view.tab === 'sessions' ? <TrainingProgress firstWeekday={getFirstWeekday()} /> : null}
      {view.tab === 'review' ? <WeeklyReview firstWeekday={getFirstWeekday()} /> : null}
      {view.tab === 'strength' ? <StrengthScore /> : null}
      {view.tab === 'body' ? (
        <Tabs label={tProgressTabs('bodyTabsLabel')} idBase="ct-progress-body" items={bodyTabs} value={view.body} onChange={(body) => setView({ body })}>
          <BodyProgress key={view.body} part={view.body} />
        </Tabs>
      ) : null}
      {view.tab === 'activity' ? (
        <>
          {/* I6-06 : séances cardio des quatre dernières semaines. */}
          <CardioProgress />
          {/* SUIVIS-029 : Objectifs, Pas par semaine, Cardio en zone 2, puis Notes du matin (D-712). */}
          <TrackingProgress />
        </>
      ) : null}
    </Tabs>
  );
}
