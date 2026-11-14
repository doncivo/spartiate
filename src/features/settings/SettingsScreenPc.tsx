import { useEffect, useState, type KeyboardEvent } from 'react';
import { summarizeBackups } from '../../domain/backupSchedule';
import { t } from '../../i18n';
import { formatBackupSummary } from '../../i18n/formatBackup';
import { tPlus, type PlusTextKey } from '../../i18n/plusText';
import { useAppContainer, useFeatureStore } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { formatAppearanceParts } from './AppearanceScreen';
import { backupStore } from './backupStore';
import { useProfileSummary } from './ProfileCard';
import { SettingsPanel, type PanelId } from './SettingsPanels';
import { settingsStore } from './settingsStore';
import { useSyncValue } from './useSyncValue';

interface Entry {
  readonly id: PanelId;
  readonly label: string;
  /** Valeur actuelle ; chaîne vide = pas de valeur à montrer pour ce réglage. */
  readonly value: string;
  readonly danger?: boolean;
}

/**
 * Plus sur PC (aperçu PC-Plus-apres, ERGO-02) : liste des réglages à gauche en quatre groupes (MOI, SOURCES, APP, DONNÉES), une ligne par
 * réglage avec sa valeur actuelle ; le réglage choisi s'ouvre à droite, dans le panneau (le même contenu que son écran sur iPhone). Aucune
 * navigation : le choix est local à l'écran. Clavier : flèches haut et bas déplacent le focus dans la liste, Entrée ou Espace ouvre.
 */
export function SettingsScreenPc() {
  const container = useAppContainer();
  const load = useFeatureStore(settingsStore, (s) => s.load);
  const errorKey = useFeatureStore(settingsStore, (s) => s.errorKey);
  const theme = useFeatureStore(settingsStore, (s) => s.theme);
  const firstWeekday = useFeatureStore(settingsStore, (s) => s.firstWeekday);
  const timeFormat = useFeatureStore(settingsStore, (s) => s.timeFormat);
  const timeZone = useAppStore((s) => s.timeZone);
  const syncValue = useSyncValue();
  const profileParts = useProfileSummary();
  const versions = useFeatureStore(backupStore, (s) => s.versions);
  const backupFailed = useFeatureStore(backupStore, (s) => s.failed);
  const loadBackups = useFeatureStore(backupStore, (s) => s.load);
  const backupsAvailable = container.backups.available();
  const [selected, setSelected] = useState<PanelId>('profile');

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (backupsAvailable) void loadBackups();
  }, [backupsAvailable, loadBackups]);

  const [themeText = ''] = formatAppearanceParts(theme, firstWeekday, timeFormat);
  const version = container.appVersion.version;
  const weight = profileParts.find((part) => part.includes(' kg'));
  const groups: readonly { readonly title: PlusTextKey; readonly entries: readonly Entry[] }[] = [
    { title: 'groupMe', entries: [{ id: 'profile', label: tPlus('navProfile'), value: weight ?? tPlus('valueMissing') }] },
    { title: 'groupSources', entries: syncValue === null ? [] : [{ id: 'sync', label: tPlus('navSync'), value: syncValue }] },
    {
      title: 'groupApp',
      entries: [
        { id: 'appearance', label: tPlus('navAppearance'), value: themeText },
        { id: 'general', label: tPlus('navGeneral'), value: timeZone ?? t('settings.timeZoneUnknown') },
        { id: 'keyboard', label: tPlus('navKeyboard'), value: '' },
        { id: 'about', label: tPlus('navAbout'), value: version ?? t('app.versionUnknown') },
      ],
    },
    {
      title: 'groupData',
      entries: [
        { id: 'export', label: tPlus('navExport'), value: '' },
        ...(backupsAvailable ? [{ id: 'backup' as const, label: tPlus('navBackup'), value: formatBackupSummary(summarizeBackups(versions, container.clock), backupFailed) }] : []),
        { id: 'logs', label: tPlus('navLogs'), value: '' },
        { id: 'reset', label: tPlus('resetRow'), value: '', danger: true },
      ],
    },
  ];
  const all = groups.flatMap((group) => group.entries);
  const current = all.find((entry) => entry.id === selected) ?? all[0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const at = buttons.findIndex((button) => button === document.activeElement);
    const next = buttons[at + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  return (
    <div className="ct-settings ct-settings--pc">
      <aside className="ct-settings__list">
        <h1 className="ct-settings__title">{t('settings.title')}</h1>
        {errorKey && (
          <p className="ct-settings__error" role="alert">
            {t(errorKey)}
          </p>
        )}
        {/* Groupe, pas `nav` : la coquille porte déjà le seul repère de navigation (la suite e2e le vise par son rôle). */}
        <div className="ct-settings__listGroups" role="group" aria-label={tPlus('listLabel')} onKeyDown={onKeyDown}>
          {groups
            .filter((group) => group.entries.length > 0)
            .map((group) => (
              <div key={group.title} className="ct-settings__listGroup">
                <h2 className="ct-settings__section ct-section-title">{tPlus(group.title)}</h2>
                {group.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="ct-settings__listItem"
                    data-tone={entry.danger ? 'danger' : undefined}
                    aria-current={entry.id === current?.id ? 'true' : undefined}
                    aria-label={entry.value === '' ? entry.label : `${entry.label} : ${entry.value}`}
                    onClick={() => setSelected(entry.id)}
                  >
                    <span>{entry.label}</span>
                    {entry.value !== '' && <span className="ct-settings__value">{entry.value}</span>}
                  </button>
                ))}
              </div>
            ))}
        </div>
      </aside>
      {current && <SettingsPanel key={current.id} id={current.id} title={current.label} />}
    </div>
  );
}
