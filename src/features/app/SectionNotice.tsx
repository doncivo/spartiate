import { tSections, type SectionsTextKey } from '../../i18n/sectionsText';
import './SectionNotice.css';
import { TodayScreen } from './TodayScreen';

export type NoticeTab = 'today' | 'training' | 'nutrition' | 'progress';

const TITLE: Record<Exclude<NoticeTab, 'today'>, SectionsTextKey> = {
  training: 'trainingTitle',
  nutrition: 'nutritionTitle',
  progress: 'progressTitle',
};

/**
 * Contenu des sections I0 (SPA-009 critères 1 et 4). Entraînement, Nutrition et Progrès expliquent qu'elles arrivent plus tard (aucun faux
 * zéro, aucun bouton mort) ; Aujourd'hui rend l'écran des planches I0 (`TodayScreen`), chargé avec cette section à la demande.
 */
export function SectionNotice({ tab }: { readonly tab: NoticeTab }) {
  if (tab === 'today') return <TodayScreen />;
  return (
    <section className="ct-section-notice" aria-labelledby="ct-section-notice-title">
      <h1 id="ct-section-notice-title" className="ct-section-notice__title">
        {tSections(TITLE[tab])}
      </h1>
      <p className="ct-section-notice__lead">{tSections('unavailable')}</p>
      <p className="ct-section-notice__hint">{tSections('unavailableHint')}</p>
    </section>
  );
}
