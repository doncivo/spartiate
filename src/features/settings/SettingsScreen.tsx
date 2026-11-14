import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { tExportImport } from '../../i18n/exportImportText';
import { healthFr } from '../../i18n/fr.health';
import { tPlus } from '../../i18n/plusText';
import { tSettingsRefonte } from '../../i18n/settingsRefonteText';
import { Switch, useLayout } from '../../ui';
import { useAppContainer, useFeatureStore } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { useNavigationStore } from '../app/navigation';
import { SigningAboutRow } from '../signing/SigningAbout';
import { SyncSettingsSection } from '../sync/SyncSettingsSection';
import { AboutSection } from './AboutSection';
import { BackupRow } from './BackupRow';
import { LinkRow } from './LinkRow';
import { ProfileCard } from './ProfileCard';
import { SecuritySection } from './SecuritySection';
import { SettingsScreenPc } from './SettingsScreenPc';
import { formatAppearanceParts } from './AppearanceScreen';
import { utcToLocal } from '../../domain/timeZone';
import { onLocalImport } from '../../db/localWrite';
import { settingsStore } from './settingsStore';
import { useSyncValue } from './useSyncValue';
import './SettingsScreen.css';

/** `HH:MM` en 24 h dans le fuseau de l'app (celui de l'appareil tant qu'il n'est pas connu). */
function formatLocalTime(isoUtc: string, timeZone: string | null): string {
  return utcToLocal(isoUtc, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).time.slice(0, 5);
}

/**
 * Onglet « Plus » (planches docs/maquettes/i0/iPhone-Plus et PC-Plus). iPhone : titre, carte « Profil et poids », puis quatre groupes en
 * cartes sous des titres en capitales discrètes : DONNÉES (synchronisation, sauvegardes, export et import), IPHONE (signature SideStore,
 * le verrouillage Face ID reste masqué, D-37), PRÉFÉRENCES (thème, début de semaine et format de l'heure vers Apparence, fuseau horaire, démarrage avec Windows)
 * et À PROPOS (version, diagnostic et journal). Apple Santé et Notifications n'existent pas encore : aucune ligne pour eux. PC : voir
 * `SettingsScreenPc`.
 */
export function SettingsScreen() {
  const layout = useLayout();
  return layout === 'pc' ? <SettingsScreenPc /> : <SettingsScreenMobile />;
}

function SettingsScreenMobile() {
  const container = useAppContainer();
  const hasHealthRow = container.platform.runtime === 'tauri' && container.platform.os === 'ios';
  // D-37 : code conservé, entrée masquée, activation différée. La ligne n'apparaît que si un test pose `__ctShowAppLockRow` (même procédé que
  // `__ctBiometricFake`) ; l'app livrée ne le pose jamais.
  const showLockRow = container.authenticator.supported && (globalThis as { __ctShowAppLockRow?: boolean }).__ctShowAppLockRow === true;
  const [healthBlocked, setHealthBlocked] = useState(false);
  /** Dernier import Raccourcis (le plus récent des fichiers lus), affiché quand Santé n'est pas accessible. */
  const [lastShortcutImport, setLastShortcutImport] = useState<string | null>(null);
  const load = useFeatureStore(settingsStore, (s) => s.load);
  const errorKey = useFeatureStore(settingsStore, (s) => s.errorKey);
  const timeZone = useAppStore((s) => s.timeZone);
  const shortcutsValue = lastShortcutImport === null ? healthFr.rowValueViaShortcuts : healthFr.rowValueViaShortcutsAt.replace('{time}', formatLocalTime(lastShortcutImport, timeZone));
  const syncValue = useSyncValue();
  const launchAtStartup = useFeatureStore(settingsStore, (s) => s.launchAtStartup);
  const setLaunchAtStartup = useFeatureStore(settingsStore, (s) => s.setLaunchAtStartup);
  const navigate = useNavigationStore((s) => s.navigate);
  const firstWeekday = useFeatureStore(settingsStore, (s) => s.firstWeekday);
  const timeFormat = useFeatureStore(settingsStore, (s) => s.timeFormat);
  const theme = useFeatureStore(settingsStore, (s) => s.theme);
  const [themeText = '', weekdayText = '', formatText = ''] = formatAppearanceParts(theme, firstWeekday, timeFormat);
  const weekdayCapitalized = weekdayText.charAt(0).toLocaleUpperCase('fr-FR') + weekdayText.slice(1);
  const openAppearance = () => navigate({ tab: 'more', screen: 'appearance' });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hasHealthRow) return undefined;
    let live = true;
    void container.data.repos.settings.get('healthkit.entitlementMissing').then(
      (value) => {
        if (live) setHealthBlocked(value === true);
      },
      () => undefined,
    );
    const readLastImport = (): void =>
      void container.data.repos.recoverySamples().then((samples) => samples.listImportStates()).then(
        (states) => {
          const latest = states.reduce<string | null>((max, state) => (max === null || state.importedAt > max ? state.importedAt : max), null);
          if (live) setLastShortcutImport(latest);
        },
        () => undefined,
      );
    readLastImport();
    // FIX-0173 : un import consigné pendant que Plus est affiché (ouverture, retour au premier plan) rafraîchit la ligne.
    const stop = onLocalImport(readLastImport);
    return () => {
      live = false;
      stop();
    };
  }, [container, hasHealthRow]);

  return (
    <div className="ct-settings ct-settings--phone">
      <h1 className="ct-settings__title">{t('settings.title')}</h1>
      {errorKey && (
        <p className="ct-settings__error" role="alert">
          {t(errorKey)}
        </p>
      )}
      <h2 className="ct-settings__section ct-section-title">{tPlus('groupMe')}</h2>
      <div className="ct-settings__card ct-flat">
        <ProfileCard />
      </div>
      {/* Sources : Apple Santé (iPhone) et synchro ; groupe absent quand la plateforme n'en a aucune (navigateur de développement). */}
      {(hasHealthRow || syncValue !== null) && <h2 className="ct-settings__section ct-section-title">{tPlus('groupSources')}</h2>}
      <div className="ct-settings__card ct-flat" hidden={!hasHealthRow && syncValue === null}>
        {hasHealthRow && <LinkRow label={healthFr.row} value={healthBlocked ? shortcutsValue : healthFr.rowValue} onClick={() => navigate({ tab: 'more', screen: 'health' })} />}
        {syncValue !== null && <LinkRow label={tPlus('navSync')} value={syncValue} onClick={() => navigate({ tab: 'more', screen: 'sync' })} />}
        <SyncSettingsSection heading={false} showStatus={false} />
      </div>
      <h2 className="ct-settings__section ct-section-title">{tPlus('groupApp')}</h2>
      <div className="ct-settings__card ct-flat">
        <LinkRow label={tSettingsRefonte('theme')} value={themeText} onClick={openAppearance} />
        <LinkRow label={tSettingsRefonte('firstWeekday')} value={weekdayCapitalized} onClick={openAppearance} />
        <LinkRow label={tSettingsRefonte('timeFormat')} value={formatText} onClick={openAppearance} />
        <div className="ct-settings__row">
          <span>{t('settings.timeZone')}</span>
          <span className="ct-settings__value">{timeZone ? t('settings.timeZoneAuto', { zone: timeZone }) : t('settings.timeZoneUnknown')}</span>
        </div>
        {launchAtStartup !== null && (
          <div className="ct-settings__row">
            <span>{t('settings.launchAtStartup')}</span>
            <Switch checked={launchAtStartup} onChange={(value) => void setLaunchAtStartup(value)} label={t('settings.launchAtStartup')} />
          </div>
        )}
        <SigningAboutRow />
        {showLockRow && <SecuritySection />}
        <AboutSection heading={false} />
      </div>
      <h2 className="ct-settings__section ct-section-title">{tPlus('groupData')}</h2>
      <div className="ct-settings__card ct-flat">
        <LinkRow label={tExportImport('row')} onClick={() => navigate({ tab: 'more', screen: 'exportimport' })} />
        <BackupRow />
        <LinkRow label={tPlus('resetRow')} tone="danger" onClick={() => navigate({ tab: 'more', screen: 'reset' })} />
      </div>
    </div>
  );
}
