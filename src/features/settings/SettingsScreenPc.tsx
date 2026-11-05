import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tExportImport } from '../../i18n/exportImportText';
import { t } from '../../i18n';
import { tPlus, type PlusTextKey } from '../../i18n/plusText';
import { tSettingsRefonte } from '../../i18n/settingsRefonteText';
import { Switch } from '../../ui';
import { useAppContainer, useFeatureStore } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { useNavigationStore } from '../app/navigation';
import { SigningAboutRow } from '../signing/SigningAbout';
import { ShortcutsSettingsSection } from '../shortcuts';
import { SyncSettingsSection, useSyncAvailable } from '../sync/SyncSettingsSection';
import { AboutSection } from './AboutSection';
import { BackupRow } from './BackupRow';
import { LinkRow } from './LinkRow';
import { SecuritySection } from './SecuritySection';
import { formatAppearanceParts } from './AppearanceScreen';
import { settingsStore } from './settingsStore';

/** Entrées du sommaire (planche PC-Plus) : « profile » ouvre l'écran Profil et poids, les autres font défiler leur section. */
const NAV_IDS = ['profile', 'data', 'prefs', 'keyboard', 'about'] as const;
type NavId = (typeof NAV_IDS)[number];
type SectionId = Exclude<NavId, 'profile'>;
const NAV_TITLES: Readonly<Record<NavId, PlusTextKey>> = {
  profile: 'navProfile',
  data: 'navData',
  prefs: 'navPreferences',
  keyboard: 'navKeyboard',
  about: 'navAbout',
};
const SECTION_IDS: readonly SectionId[] = ['data', 'prefs', 'keyboard', 'about'];
/** Après un clic du sommaire, le défilement observé ne reprend la main qu'une fois le défilement doux terminé. */
const PIN_MS = 800;

/**
 * Plus sur PC (planche PC-Plus) : sommaire à gauche de cinq entrées (Profil et poids, Synchro et données, Préférences, Raccourcis clavier,
 * À propos et diagnostic), colonne bornée à 660 px. « Profil et poids » ouvre son écran ; les autres entrées font défiler leur section
 * (section courante suivie par IntersectionObserver). « Synchro et données » regroupe synchronisation iCloud, sauvegardes, export et
 * import sous des titres en capitales, en lignes séparées. Règle 7 des maquettes : sur grand écran, on borne et on navigue.
 */
export function SettingsScreenPc() {
  const container = useAppContainer();
  const load = useFeatureStore(settingsStore, (s) => s.load);
  const errorKey = useFeatureStore(settingsStore, (s) => s.errorKey);
  const timeZone = useAppStore((s) => s.timeZone);
  const launchAtStartup = useFeatureStore(settingsStore, (s) => s.launchAtStartup);
  const setLaunchAtStartup = useFeatureStore(settingsStore, (s) => s.setLaunchAtStartup);
  const navigate = useNavigationStore((s) => s.navigate);
  const firstWeekday = useFeatureStore(settingsStore, (s) => s.firstWeekday);
  const timeFormat = useFeatureStore(settingsStore, (s) => s.timeFormat);
  const theme = useFeatureStore(settingsStore, (s) => s.theme);
  const syncAvailable = useSyncAvailable();
  const backupsAvailable = container.backups.available();
  const [themeText = '', weekdayText = '', formatText = ''] = formatAppearanceParts(theme, firstWeekday, timeFormat);
  const weekdayCapitalized = weekdayText.charAt(0).toLocaleUpperCase('fr-FR') + weekdayText.slice(1);

  const [current, setCurrent] = useState<SectionId>('data');
  const refs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const pinnedUntil = useRef(0);

  useEffect(() => {
    void load();
  }, [load]);

  // Sommaire : la section courante suit le défilement (première section visible), sauf juste après un clic du sommaire.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < pinnedUntil.current) return;
        const first = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
          ?.target.getAttribute('data-section');
        if (first) setCurrent(first as SectionId);
      },
      { rootMargin: '0px 0px -55% 0px' },
    );
    for (const id of SECTION_IDS) {
      const element = refs.current[id];
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  function go(id: NavId): void {
    if (id === 'profile') {
      navigate({ tab: 'more', screen: 'body' });
      return;
    }
    pinnedUntil.current = Date.now() + PIN_MS;
    setCurrent(id);
    refs.current[id]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  const section = (id: SectionId, children: ReactNode) => {
    const headingId = `ct-settings-section-${id}`;
    return (
      <section
        key={id}
        className="ct-settings__group"
        data-section={id}
        aria-labelledby={headingId}
        ref={(element) => {
          refs.current[id] = element;
        }}
      >
        <h2 id={headingId} className="ct-settings__section">
          {tPlus(NAV_TITLES[id])}
        </h2>
        {children}
      </section>
    );
  };

  /** Sous-groupe de « Synchro et données » : titre en capitales discrètes, lignes en carte. */
  const group = (key: PlusTextKey, children: ReactNode) => (
    <div className="ct-settings__subgroup" role="group" aria-label={tPlus(key)}>
      <h3 className="ct-settings__groupTitle">{tPlus(key)}</h3>
      <div className="ct-settings__card">{children}</div>
    </div>
  );

  const openAppearance = () => navigate({ tab: 'more', screen: 'appearance' });

  return (
    <div className="ct-settings ct-settings--pc">
      <aside className="ct-settings__summary">
        <h1 className="ct-settings__title">{t('settings.title')}</h1>
        {/* Groupe, pas `nav` : la coquille porte déjà le seul repère de navigation (la suite e2e le vise par son rôle). */}
        <div className="ct-settings__nav" role="group" aria-label={tSettingsRefonte('summaryLabel')}>
          {NAV_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="ct-settings__navItem"
              aria-current={id !== 'profile' && current === id ? 'true' : undefined}
              onClick={() => go(id)}
            >
              {tPlus(NAV_TITLES[id])}
            </button>
          ))}
        </div>
      </aside>
      <div className="ct-settings__content">
        {errorKey && (
          <p className="ct-settings__error" role="alert">
            {t(errorKey)}
          </p>
        )}
        <SigningAboutRow />
        {section(
          'data',
          <>
            {syncAvailable && group('groupSync', <SyncSettingsSection heading={false} />)}
            {backupsAvailable && group('groupBackups', <BackupRow />)}
            {group(
              'groupExport',
              <LinkRow label={tExportImport('row')} hint={tPlus('exportHint')} onClick={() => navigate({ tab: 'more', screen: 'exportimport' })} />,
            )}
            <SecuritySection />
          </>,
        )}
        {section(
          'prefs',
          <div className="ct-settings__card">
            <LinkRow label={tSettingsRefonte('theme')} value={themeText} onClick={openAppearance} />
            <LinkRow label={tSettingsRefonte('firstWeekday')} value={weekdayCapitalized} onClick={openAppearance} />
            <LinkRow label={tSettingsRefonte('timeFormat')} value={formatText} onClick={openAppearance} />
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
          </div>,
        )}
        {section(
          'keyboard',
          <div className="ct-settings__card">
            <ShortcutsSettingsSection heading={false} />
          </div>,
        )}
        {section(
          'about',
          <div className="ct-settings__card">
            <AboutSection heading={false} />
          </div>,
        )}
      </div>
    </div>
  );
}
