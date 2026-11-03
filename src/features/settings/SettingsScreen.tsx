import { useEffect } from 'react';
import { t } from '../../i18n';
import { tBody } from '../../i18n/bodyText';
import { tExportImport } from '../../i18n/exportImportText';
import { Switch, useLayout } from '../../ui';
import { useFeatureStore } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { useNavigationStore } from '../app/navigation';
import { SigningAboutRow } from '../signing/SigningAbout';
import { ShortcutsSettingsSection } from '../shortcuts';
import { SyncSettingsSection } from '../sync/SyncSettingsSection';
import { AboutSection } from './AboutSection';
import { BackupRow } from './BackupRow';
import { SecuritySection } from './SecuritySection';
import { SettingsScreenPc } from './SettingsScreenPc';
import { formatAppearanceParts } from './AppearanceScreen';
import { settingsStore } from './settingsStore';
import './SettingsScreen.css';

/**
 * Écran Réglages minimal (Reglages.html) : section « GÉNÉRAL » avec la seule ligne « Fuseau horaire » (T-11, lecture seule), section « TÂCHES » avec les interrupteurs « Reporter
 * les tâches non faites » (T-06) et « Masquer les routines de la liste » (A-03), section « DONNÉES ET SÉCURITÉ » avec la seule ligne
 * « Corbeille » (T-08, Q6 : unique point d'accès). Sur PC seulement : section « GÉNÉRAL » avec
 * « Démarrer avec Windows » (D-02) et section « À PROPOS » (D-03). Section « SYNCHRONISATION » (Y-01, PC à l’ordre 4). Aucun autre réglage n’est
 * simulé : ils arrivent avec M12.
 */
export function SettingsScreen() {
  const layout = useLayout();
  return layout === 'pc' ? <SettingsScreenPc /> : <SettingsScreenMobile />;
}

/** Réglages sur iPhone (Reglages.html) : une colonne, titres en capitales ; inchangé par UI-REFONTE-09. */
function SettingsScreenMobile() {
  const load = useFeatureStore(settingsStore, (s) => s.load);
  const errorKey = useFeatureStore(settingsStore, (s) => s.errorKey);
  const timeZone = useAppStore((s) => s.timeZone);
  const launchAtStartup = useFeatureStore(settingsStore, (s) => s.launchAtStartup);
  const setLaunchAtStartup = useFeatureStore(settingsStore, (s) => s.setLaunchAtStartup);
  const navigate = useNavigationStore((s) => s.navigate);
  const firstWeekday = useFeatureStore(settingsStore, (s) => s.firstWeekday);
  const timeFormat = useFeatureStore(settingsStore, (s) => s.timeFormat);
  const theme = useFeatureStore(settingsStore, (s) => s.theme);
  const appearanceSummary = formatAppearanceParts(theme, firstWeekday, timeFormat).join(t('appearance.summarySeparator'));

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ct-settings">
      <h1 className="ct-settings__title">{t('settings.title')}</h1>
      <div className="ct-settings__rule" aria-hidden="true">
        <div className="ct-settings__ruleAccent" />
        <div className="ct-settings__ruleLine" />
      </div>
      {errorKey && (
        <p className="ct-settings__error" role="alert">
          {t(errorKey)}
        </p>
      )}
      <SigningAboutRow />
      <h2 className="ct-settings__section">{t('settings.sectionGeneral')}</h2>
      {/* --- M12 apparence et formats --- */}
      <button
        type="button"
        className="ct-settings__row ct-settings__rowButton"
        aria-label={`${t('appearance.row')} : ${appearanceSummary}`}
        onClick={() => navigate({ tab: 'more', screen: 'appearance' })}
      >
        <span>{t('appearance.row')}</span>
        <span className="ct-settings__value">{appearanceSummary}</span>
      </button>
      <button type="button" className="ct-settings__row ct-settings__rowButton" onClick={() => navigate({ tab: 'more', screen: 'body' })}>
        <span>{tBody('row')}</span>
      </button>
      <button type="button" className="ct-settings__row ct-settings__rowButton" onClick={() => navigate({ tab: 'more', screen: 'exportimport' })}>
        <span>{tExportImport('row')}</span>
      </button>
      <div className="ct-settings__row">
        <span>{t('settings.timeZone')}</span>
        <span className="ct-settings__value">
          {timeZone ? t('settings.timeZoneAuto', { zone: timeZone }) : t('settings.timeZoneUnknown')}
        </span>
      </div>
      {/* --- fin M12 apparence et formats --- */}
      {launchAtStartup !== null && (
        <div className="ct-settings__row">
          <span>{t('settings.launchAtStartup')}</span>
          <Switch checked={launchAtStartup} onChange={(value) => void setLaunchAtStartup(value)} label={t('settings.launchAtStartup')} />
        </div>
      )}
      <ShortcutsSettingsSection />
      {/* M15 (Y-01) : dossier de synchro ; section absente sur iPhone jusqu'à l'ordre 5. */}
      <SyncSettingsSection />
      <h2 className="ct-settings__section">{t('settings.sectionData')}</h2>
      {/* I-03 : « Verrouillage Face ID » (Reglages.html), iPhone seulement. */}
      <SecuritySection />
      {/* M12 (P-04) : sauvegarde automatique quotidienne et restauration. */}
      <BackupRow />
      <AboutSection />
    </div>
  );
}
