import { lazy, Suspense, type ReactNode } from 'react';
import { t } from '../../i18n';
import { tSettingsRefonte } from '../../i18n/settingsRefonteText';
import { Switch } from '../../ui';
import { useFeatureStore } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { SigningAboutRow } from '../signing/SigningAbout';
import { ShortcutsSettingsSection } from '../shortcuts';
import { SyncSettingsSection } from '../sync/SyncSettingsSection';
import { AboutSection } from './AboutSection';
import { BackupRow } from './BackupRow';
import { SecuritySection } from './SecuritySection';
import { settingsStore } from './settingsStore';

/** Réglages ouvrables dans le panneau de droite de Plus sur PC (ERGO-02, aperçu PC-Plus-apres). */
export type PanelId = 'profile' | 'sync' | 'appearance' | 'general' | 'keyboard' | 'about' | 'export' | 'backup' | 'logs' | 'reset';

// Même contenu que les sous-écrans, chargés à la demande avec leurs catalogues (aucun module ajouté au départ).
const BodyScreen = lazy(() => import('./BodyScreen').then((m) => ({ default: m.BodyScreen })));
const AppearanceScreen = lazy(() => import('./AppearanceScreen').then((m) => ({ default: m.AppearanceScreen })));
const ExportImportScreen = lazy(() => import('./ExportImportScreen').then((m) => ({ default: m.ExportImportScreen })));
const LogsScreen = lazy(() => import('./logs/LogsScreen').then((m) => ({ default: m.LogsScreen })));
const ResetDataScreen = lazy(() => import('./ResetDataScreen').then((m) => ({ default: m.ResetDataScreen })));
const SyncDetailsScreen = lazy(() => import('../sync/SyncDetailsScreen').then((m) => ({ default: m.SyncDetailsScreen })));

/** Fuseau horaire et démarrage avec Windows : les deux réglages de l'ancienne section « Préférences » qui n'ont pas d'écran à eux. */
function GeneralPanel() {
  const timeZone = useAppStore((s) => s.timeZone);
  const launchAtStartup = useFeatureStore(settingsStore, (s) => s.launchAtStartup);
  const setLaunchAtStartup = useFeatureStore(settingsStore, (s) => s.setLaunchAtStartup);
  return (
    <div className="ct-settings__card ct-flat">
      <div className="ct-settings__row">
        <span className="ct-settings__stack">
          <span>{t('settings.timeZone')}</span>
          <span className="ct-settings__hint">{tSettingsRefonte('timeZoneHint')}</span>
        </span>
        <span className="ct-settings__value">{timeZone ?? t('settings.timeZoneUnknown')}</span>
      </div>
      {launchAtStartup !== null && (
        <div className="ct-settings__row">
          <span className="ct-settings__stack">
            <span>{t('settings.launchAtStartup')}</span>
            <span className="ct-settings__hint">{tSettingsRefonte('launchHint')}</span>
          </span>
          <Switch checked={launchAtStartup} onChange={(value) => void setLaunchAtStartup(value)} label={t('settings.launchAtStartup')} />
        </div>
      )}
    </div>
  );
}

function content(id: PanelId): ReactNode {
  switch (id) {
    case 'profile':
      return <BodyScreen />;
    case 'sync':
      return (
        <>
          {/* Dossier, association de cet appareil et « Oublier » : mêmes actions que la ligne de Réglages d'avant. */}
          <div className="ct-settings__card ct-flat">
            <SyncSettingsSection heading={false} showStatus={false} showPairing={false} />
          </div>
          <SyncDetailsScreen />
        </>
      );
    case 'appearance':
      return <AppearanceScreen />;
    case 'general':
      return <GeneralPanel />;
    case 'keyboard':
      return (
        <div className="ct-settings__card ct-flat">
          <ShortcutsSettingsSection heading={false} />
        </div>
      );
    case 'about':
      return (
        <div className="ct-settings__card ct-flat">
          <SigningAboutRow />
          <AboutSection heading={false} />
          <SecuritySection />
        </div>
      );
    case 'export':
      return <ExportImportScreen />;
    case 'backup':
      return (
        <div className="ct-settings__card ct-flat">
          <BackupRow />
        </div>
      );
    case 'logs':
      return <LogsScreen />;
    case 'reset':
      return <ResetDataScreen />;
  }
}

/** Panneau de droite : le réglage choisi dans la liste (sa propre page, ouverte ici au lieu d'un écran). */
export function SettingsPanel({ id, title }: { readonly id: PanelId; readonly title: string }) {
  return (
    <section className="ct-settings__panel" role="region" aria-label={title} data-panel={id}>
      <Suspense fallback={null}>{content(id)}</Suspense>
    </section>
  );
}
