import { tSections, type SectionsTextKey } from '../../i18n/sectionsText';
import { Button } from '../../ui';
import { useNavigationStore } from './navigation';
import './SectionNotice.css';

export type NoticeTab = 'today' | 'training' | 'nutrition' | 'progress';

const TITLE: Record<NoticeTab, SectionsTextKey> = {
  today: 'todayTitle',
  training: 'trainingTitle',
  nutrition: 'nutritionTitle',
  progress: 'progressTitle',
};

/**
 * Contenu des sections I0 (SPA-009 critères 1 et 4). Entraînement, Nutrition et Progrès expliquent qu'elles arrivent plus tard (aucun faux
 * zéro, aucun bouton mort) ; Aujourd'hui dit qu'il n'y a aucune donnée et propose la seule action utile : renseigner profil et poids.
 */
export function SectionNotice({ tab }: { readonly tab: NoticeTab }) {
  const navigate = useNavigationStore((s) => s.navigate);
  return (
    <section className="ct-section-notice" aria-labelledby="ct-section-notice-title">
      <h1 id="ct-section-notice-title" className="ct-section-notice__title">
        {tSections(TITLE[tab])}
      </h1>
      {tab === 'today' ? (
        <>
          <p className="ct-section-notice__lead">{tSections('todayEmpty')}</p>
          <p className="ct-section-notice__hint">{tSections('todayHint')}</p>
          <Button onClick={() => navigate({ tab: 'more', screen: 'body' })}>{tSections('todayAction')}</Button>
        </>
      ) : (
        <>
          <p className="ct-section-notice__lead">{tSections('unavailable')}</p>
          <p className="ct-section-notice__hint">{tSections('unavailableHint')}</p>
        </>
      )}
    </section>
  );
}
