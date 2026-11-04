import { t, type PlainMessageKey } from '../../i18n';
import './lazyScreens.css';

/**
 * Section sans écran dans cette version (Aujourd'hui, Entraînement, Nutrition, Progrès en 0.1.x) : une phrase explicite à la place de
 * la zone blanche, que l'on prenait pour un démarrage bloqué.
 */
export function SectionPending({ labelKey }: { readonly labelKey: PlainMessageKey }) {
  return (
    <div className="ct-app__pending">
      <p role="status">{t('app.sectionPending', { name: t(labelKey) })}</p>
    </div>
  );
}
