import { Undo2 } from 'lucide-react';
import { d3EaseNotice, licencesFr } from '../../i18n/fr.licenses';
import { Icon, useLayout } from '../../ui';
import { useNavigationStore } from '../app/navigation';
import { SideStoreScreen } from './SideStoreScreen';
import './LicensesScreen.css';

/**
 * « À propos et licences » (§ 18.2 c, C-119) : liste des ressources embarquées et de leur licence (source : docs/licences.md).
 * Écran à la demande avec son catalogue ; lecture seule, aucun réseau.
 */
export function LicensesScreen() {
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  // § 18.3 a : la procédure SideStore est servie par ce même bloc à la demande (un écran de moins dans le départ).
  const sideStore = useNavigationStore((s) => s.route.tab === 'more' && s.route.screen === 'sidestore');
  if (sideStore) return <SideStoreScreen />;
  return (
    <div className="ct-licenses-shell" data-layout={layout}>
      <div className="ct-licenses">
        <div className="ct-licenses__topRow">
          <button type="button" className="ct-licenses__back" aria-label={licencesFr.back} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={Undo2} size="lg" />
          </button>
        </div>
        <h1 className="ct-licenses__title">{licencesFr.title}</h1>
        <p className="ct-licenses__intro">{licencesFr.intro}</p>
        <ul className="ct-licenses__list">
          {licencesFr.items.map((item) => (
            <li key={item.name}>
              <h2 className="ct-licenses__name">{item.name}</h2>
              <p className="ct-licenses__detail">{item.licence}</p>
              <p className="ct-licenses__detail">{item.detail}</p>
              {item.name === 'd3-ease' && (
                <pre className="ct-licenses__notice" data-testid="license-d3-ease">
                  {d3EaseNotice}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
