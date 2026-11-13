import { t } from '../../i18n';
import { tSettingsRefonte } from '../../i18n/settingsRefonteText';
import { Kbd, useLayout } from '../../ui';
import { useNavigationStore } from '../app/navigation';
import './ShortcutsSettingsSection.css';

/**
 * Section « Clavier » de Réglages (PC seulement, D-04 et P-08 ; UI-REFONTE-09, PC-Reglages.html) : dans l'app installée, la ligne
 * « Capture rapide » (combinaison globale configurable ; une combinaison prise par une autre application s'explique en une phrase sous
 * l'étiquette, touche en ambre), puis la ligne cliquable « Tous les raccourcis · Ctrl / » (ouvre la liste). Le titre reste au sommaire
 * du PC (`heading={false}`). Absente sur iPhone : pas de clavier.
 */
export function ShortcutsSettingsSection({ heading = true }: { readonly heading?: boolean } = {}) {
  const layout = useLayout();
  const openOverlay = useNavigationStore((s) => s.openOverlay);
  if (layout !== 'pc') return null;
  return (
    <>
      {heading && <h2 className="ct-settings__section ct-section-title">{t('shortcutsUi.settings.section')}</h2>}
      <button
        type="button"
        className="ct-settings__row ct-settings__rowButton"
        aria-label={t('shortcutsUi.openHelpLabel')}
        onClick={() => openOverlay({ kind: 'shortcutsHelp' })}
      >
        <span>{tSettingsRefonte('allShortcuts')}</span>
        <Kbd keys="Ctrl+/" separator=" " className="ct-settings__kbd" />
      </button>
    </>
  );
}
