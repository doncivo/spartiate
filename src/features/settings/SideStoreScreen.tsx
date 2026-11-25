import { Undo2 } from 'lucide-react';
import { sideStoreFr } from '../../i18n/fr.sidestore';
import { Icon, useLayout } from '../../ui';
import { useNavigationStore } from '../app/navigation';
import './LicensesScreen.css';

/**
 * Procédure d'actualisation par SideStore (§ 18.3 a) : atteinte par « Voir » du bandeau « la signature expire dans moins de 24 h ».
 * Écran à la demande avec son catalogue ; lecture seule. Même mise en page que « Licences » (feuille de style partagée).
 */
export function SideStoreScreen() {
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  return (
    <div className="ct-licenses-shell" data-layout={layout}>
      <div className="ct-licenses">
        <div className="ct-licenses__topRow">
          <button type="button" className="ct-licenses__back" aria-label={sideStoreFr.back} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={Undo2} size="lg" />
          </button>
        </div>
        <h1 className="ct-licenses__title">{sideStoreFr.title}</h1>
        <p className="ct-licenses__intro">{sideStoreFr.intro}</p>
        <ol className="ct-licenses__steps">
          {sideStoreFr.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="ct-licenses__detail">{sideStoreFr.failure}</p>
      </div>
    </div>
  );
}
