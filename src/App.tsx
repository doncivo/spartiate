import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppContainerProvider, useAppContainer } from './features/app/AppContainerContext';
import { useAppStore } from './features/app/appStore';
import { UndoToast } from './features/app/UndoToast';
import { bootstrapApp, publishStartFailure } from './features/app/bootstrap';
import { DbFailureDetails, DbOpenWatchdog, failureAlertKey } from './features/app/DbFailureDetails';
import type { AppContainer } from './features/app/container';
import { TABS, useNavigationStore, type TabDefinition } from './features/app/navigation';
import { startDesktopIntegration } from './features/app/desktop';
import { toKeyInput, type ShortcutId } from './features/app/shortcuts';
import { startAppStartup, type AppStartup } from './features/app/startup';
import { StartupWatchdog } from './features/app/StartupWatchdog';
import { startupTracker } from './features/app/startupSteps';
import { registerTabShortcuts } from './features/app/tabShortcuts';
import { AppearanceScreen, BodyScreen, ExportImportScreen, LogsScreen, SectionNotice, RecoveryFailureLazy, preloadScreens, SettingsScreen, ShortcutsHelp, SyncDetailsScreen, UpdateBanner } from './features/app/lazyScreens';
import { AppStatusBanner } from './features/app/AppStatusBanner';
import { startNetworkStatus } from './features/app/appStatus';
import { restoreAppearance, startThemeSync } from './features/settings';
import { registerEscapeFallback, registerShellShortcuts } from './features/shortcuts';
import { RestoreChoiceHost } from './features/sync/RestoreChoiceHost';
import { startSyncIntegration } from './features/sync/startSync';
import { AppLockGate } from './features/security/AppLockGate';
import { bootAppLock } from './features/security/appLockBoot';
import { isAppLocked } from './features/security/appLockStore';
import { t } from './i18n';
import { formatPrefsVersion, subscribeFormatPrefs } from './i18n/formatPrefs';
import { AppShell, TabRail } from './ui';
import { PcTopBar, SidebarSyncCard } from './features/app/ShellChrome';
import { SHORTCUTS } from './features/app/shortcuts';
import { todayLocal } from './domain/clock';
import { formatDetailDate } from './i18n/format';
import { useLayout } from './ui/useLayout';

/** Raccourcis encore actifs pendant que la liste des raccourcis est ouverte (P-08). */
const HELP_KEYS: readonly ShortcutId[] = ['app.shortcutsHelp', 'app.escape'];

function requireTab(id: string): TabDefinition {
  const found = TABS.find((tab) => tab.id === id);
  if (!found) throw new Error(`Section manquante dans TABS : ${id}`);
  return found;
}

const MORE_ITEM = requireTab('more');
/** « Ctrl 1 » à « Ctrl 5 » affichés à droite des onglets de la barre latérale PC (registre de raccourcis). */
const SHORTCUT_HINTS: Readonly<Record<string, string>> = Object.fromEntries(TABS.map((tab) => [tab.id, SHORTCUTS[tab.shortcut].keys.replace('+', ' ')]));
const RAIL_ITEMS = TABS.filter((tab) => tab.id !== MORE_ITEM.id);

/**
 * Coquille réelle de l'app : cinq sections fixes. Today, Training, Nutrition et Progress sont neutres jusqu'à leur itération
 * (aucun écran inventé) ; `route.tab` reste la seule source de vérité.
 */
function AppShellContent() {
  // P-03 : un changement de format d'heure ou de premier jour réaffiche aussitôt toute la coquille (sans redémarrage).
  useSyncExternalStore(subscribeFormatPrefs, formatPrefsVersion);
  const container = useAppContainer();
  const route = useNavigationStore((s) => s.route);
  const goToTab = useNavigationStore((s) => s.goToTab);
  const layout = useLayout();

  // PERF-02 : écrans chargés à la demande, préchargés en arrière-plan après le premier rendu.
  useEffect(() => preloadScreens(), []);
  // A-09 : état du réseau (« Hors ligne »).
  useEffect(() => startNetworkStatus(), []);
  // P-02 : barre de titre alignée sur le thème (PC).
  useEffect(() => startThemeSync(container), [container]);
  // A-04 : Ctrl+1 à Ctrl+5 (registre de raccourcis, actifs même dans un champ de saisie).
  useEffect(() => registerTabShortcuts(container.shortcuts), [container]);
  // D-04 : Échap (dernier recours), Ctrl+, (Plus). P-08 : Ctrl+/ (liste des raccourcis), PC seulement.
  useLayoutEffect(() => registerEscapeFallback(container), [container]);
  useEffect(() => registerShellShortcuts(container, { help: layout === 'pc' }), [container, layout]);

  return (
    <AppShell
      detailOverlay={false}
      tabRail={<TabRail items={RAIL_ITEMS} settingsItem={MORE_ITEM} activeId={route.tab} shortcutHints={SHORTCUT_HINTS} footer={<SidebarSyncCard />} onSelect={(id) => goToTab(id as TabDefinition['id'])} />}
      topBar={<PcTopBar labelKey={requireTab(route.tab).labelKey} date={route.tab === 'today' ? formatDetailDate(todayLocal(container.clock)) : undefined} />}
    >
      <AppStatusBanner />
      <UpdateBanner />
      {/* Y-02 : choix après une restauration P-04 (aucune synchro ne part avant) ; fenêtre et textes chargés à la demande. */}
      {container.sync && <RestoreChoiceHost />}
      {layout === 'pc' && <ShortcutsHelp />}
      {route.tab === 'more' ? (
        route.screen === 'appearance' ? <AppearanceScreen /> : route.screen === 'body' ? <BodyScreen /> : route.screen === 'exportimport' ? <ExportImportScreen /> : route.screen === 'logs' ? <LogsScreen /> : route.screen === 'sync' ? <SyncDetailsScreen /> : <SettingsScreen />
      ) : (
        <SectionNotice tab={route.tab} />
      )}
    </AppShell>
  );
}

export function App() {
  const layout = useLayout();
  const dbStatus = useAppStore((s) => s.dbStatus);
  const dbBackupFailed = useAppStore((s) => s.dbBackupFailed);
  const dbFailure = useAppStore((s) => s.dbFailure);
  const [container, setContainer] = useState<AppContainer | null>(null);
  const mounted = useRef(true);
  const startup = useRef<AppStartup | null>(null);
  const appLock = useRef<{ dispose(): void } | null>(null);

  useEffect(() => {
    if (useAppStore.getState().dbStatus === 'idle') {
      // 0.2.1 : étape en cours après `bootstrapApp`, affichée (app.startError) si une étape rejette au lieu de laisser l'écran vide.
      let step = 'bootstrapApp';
      startupTracker.reset();
      startupTracker.begin(step);
      void bootstrapApp().then(async (created) => {
        if (!created) return;
        // Apparence (P-03) : premier jour et format d'heure lus avant le premier rendu.
        step = 'restoreAppearance';
        startupTracker.begin(step);
        await restoreAppearance(created);
        step = 'bootAppLock';
        startupTracker.begin(step);
        // I-03 : verrouillage lu avant le premier rendu de la coquille (illisible : verrouillé). Le verrou couvre l'interface seulement :
        // la suite du démarrage (report, synchro, rappels) continue normalement.
        const lock = await bootAppLock(created);
        appLock.current = lock;
        // Report automatique (T-06) : premier contrôle AVANT le premier rendu d'Aujourd'hui ;
        // démarrage nettoyé si l'app est démontée avant la fin (startup.ts).
        step = 'startAppStartup';
        startupTracker.begin(step);
        const started = startAppStartup(created);
        startup.current = started;
        await started.ready;
        step = 'setContainer';
        startupTracker.done();
        if (!mounted.current) {
          started.dispose();
          lock.dispose();
          appLock.current = null;
          return;
        }
        setContainer(created);
      }).catch((error: unknown) => {
        startupTracker.done();
        if (mounted.current) publishStartFailure(step, error);
      });
    }
  }, []);

  // Démontage : arrête minuterie et écouteurs du démarrage (StrictMode : le drapeau est réarmé au remontage).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      startup.current?.dispose();
      startup.current = null;
      appLock.current?.dispose();
      appLock.current = null;
    };
  }, []);

  // Y-02 : synchro (ouverture, 5 min fenêtre visible, masquage), bandeaux A-09, rechargement après chaque lot reçu ; rien sans synchro.
  useEffect(() => {
    if (!container) return undefined;
    return startSyncIntegration(container).dispose;
  }, [container]);

  // I-02 : avis d'expiration de la signature (iPhone seulement, chargé à la demande hors du bundle de départ, APRÈS le premier rendu).
  useEffect(() => {
    if (!container?.signing.source.supported) return undefined;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('./features/signing/signingRun').then(
      (module) => {
        if (cancelled) return;
        stop = module.startSigningIntegration(container).dispose;
      },
      () => publishStartFailure('signing', new Error('chargement impossible')),
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [container]);

  // PC : zone de notification, « Ajout rapide », vérifications de mise à jour (D-01, D-03).
  useEffect(() => {
    if (!container) return undefined;
    return startDesktopIntegration(container).dispose;
  }, [container]);

  useEffect(() => {
    if (!container) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      // I-03 : aucun raccourci tant que l'app est verrouillée.
      if (isAppLocked()) return;
      // Sous la liste des raccourcis (fenêtre modale), seuls Ctrl+/ et Échap agissent : Espace, Entrée ou Suppr ne touchent pas l'écran dessous.
      const underHelp = useNavigationStore.getState().overlays.at(-1)?.kind === 'shortcutsHelp';
      if (container.shortcuts.handle(toKeyInput(event), underHelp ? HELP_KEYS : undefined)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [container]);

  const recoveryFailed = dbFailure?.errorName === 'StartupRecoveryError';

  return (
    <div className="app-shell" data-layout={layout} data-db-status={dbStatus}>
      {dbStatus === 'loading' && <p role="status">{t('app.loading')}</p>}
      {dbStatus === 'loading' && <DbOpenWatchdog />}
      {/* Tout le démarrage, pas seulement l'ouverture de la base : une étape de plus de 8 s remplace l'attente silencieuse. */}
      {!container && dbStatus !== 'error' && <StartupWatchdog />}
      {dbStatus === 'error' && recoveryFailed && (
        // P-04-iOS (ADR 0009 avenant lot F B3) : récupération d'une restauration interrompue impossible : aucune base ouverte ; recharger la
        // page ne relance pas la récupération (elle est faite par Rust au lancement), d'où la consigne de fermer puis rouvrir l'app.
        <>
          <p role="alert">{t('backup.recoveryFailedIos')}</p>
          <RecoveryFailureLazy message={dbFailure?.message ?? ''} />
        </>
      )}
      {dbStatus === 'error' && !recoveryFailed && <p role="alert">{t(failureAlertKey(dbFailure, dbBackupFailed))}</p>}
      {/* 0.2.1 : étape, erreur exacte, URL et chemins de la base, copiables (diagnostic sans logs, sur PC comme sur iPhone). */}
      {dbStatus === 'error' && dbFailure && <DbFailureDetails failure={dbFailure} retry={!recoveryFailed} />}
      {container ? (
        <AppContainerProvider container={container}>
          {/* I-03 : écran de verrou ; coquille non montée au lancement verrouillé, masquée et inerte au retour. */}
          <AppLockGate>
            <AppShellContent />
            {/* Bandeau « Annuler » et Ctrl+Z globaux (T-13) : au-dessus de tous les écrans. */}
            <UndoToast />
          </AppLockGate>
        </AppContainerProvider>
      ) : (
        dbStatus !== 'error' && <h1>{t('app.name')}</h1>
      )}
    </div>
  );
}
