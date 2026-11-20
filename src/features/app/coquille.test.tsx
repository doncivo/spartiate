import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootErrorBoundary, startSigningLazily } from '../../App';
import { t } from '../../i18n';
import { tStartupBlocked } from '../../i18n/fr.startupBlocked';
import { DbOpenWatchdog } from './DbFailureDetails';
import { useAppStore, type DbFailure } from './appStore';
import { StartupWatchdog } from './StartupWatchdog';
import { createStartupTracker, startupTracker } from './startupSteps';

/** FIX-COQUILLE (C-114, C-115, C-116) : jamais d'écran blanc, jamais de rechargement en pleine migration ni sur un pilote empoisonné. */
const poisoned: DbFailure = { phase: 'start', step: 'connection-poisoned', errorName: 'DbError', message: 'synthétique', kind: 'connection-poisoned' };

function Boom(): never {
  throw new Error('rendu impossible (synthétique)');
}

describe('C-114 : frontière d’erreur racine', () => {
  beforeEach(() => {
    useAppStore.setState({ dbStatus: 'idle', dbFailure: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('une erreur de rendu affiche un message statique et « Relancer l’app » au lieu d’un écran blanc', () => {
    const reload = vi.fn();
    render(
      <RootErrorBoundary reload={reload}>
        <Boom />
      </RootErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(t('app.crashTitle'));
    fireEvent.click(screen.getByRole('button', { name: t('app.crashRetry') }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('pilote empoisonné : aucun bouton de rechargement, consigne de fermer l’app (D-326 5)', () => {
    useAppStore.setState({ dbStatus: 'error', dbFailure: poisoned });
    const reload = vi.fn();
    render(
      <RootErrorBoundary reload={reload}>
        <Boom />
      </RootErrorBoundary>,
    );
    expect(screen.queryByRole('button', { name: t('app.crashRetry') })).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(t('app.dbPoisoned'));
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('C-114 / C-115 : frontière racine pendant une migration', () => {
  afterEach(() => {
    startupTracker.reset();
    vi.restoreAllMocks();
  });

  it('étape de migration ouverte : aucun bouton de relance, consigne de fermer l’app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useAppStore.setState({ dbStatus: 'loading', dbFailure: null });
    startupTracker.begin('db.migration.5');
    const reload = vi.fn();
    render(
      <RootErrorBoundary reload={reload}>
        <Boom />
      </RootErrorBoundary>,
    );
    expect(screen.queryByRole('button', { name: t('app.crashRetry') })).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(t('app.crashMigration'));
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('C-115 : chien de garde et migration lente', () => {
  beforeEach(() => useAppStore.setState({ dbStatus: 'loading', dbFailure: null, dbProgress: null }));

  async function tick(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('étape de migration à 20 s : pas de « Démarrage bloqué » ; à 130 s : écran sans « Réessayer »', async () => {
    vi.useFakeTimers();
    let clock = 0;
    const tracker = createStartupTracker(() => clock, () => undefined);
    tracker.begin('db.migration.12');
    const onRetry = vi.fn();
    render(<StartupWatchdog tracker={tracker} now={() => clock} onRetry={onRetry} />);
    clock = 20_000;
    await tick(1000);
    expect(screen.queryByRole('alert')).toBeNull();
    clock = 130_000;
    await tick(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(tStartupBlocked('title', { step: 'db.migration.12' })));
    expect(screen.queryByRole('button', { name: tStartupBlocked('retry') })).toBeNull();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('étape hors base à 9 s : « Réessayer » reste proposé', async () => {
    vi.useFakeTimers();
    let clock = 0;
    const tracker = createStartupTracker(() => clock, () => undefined);
    tracker.begin('bootAppLock');
    render(<StartupWatchdog tracker={tracker} now={() => clock} onRetry={() => undefined} />);
    clock = 9000;
    await tick(1000);
    vi.useRealTimers();
    expect(await screen.findByRole('button', { name: tStartupBlocked('retry') })).toBeVisible();
  });

  it('pilote empoisonné : jamais de « Réessayer » ni de rechargement', async () => {
    useAppStore.setState({ dbStatus: 'error', dbFailure: poisoned });
    vi.useFakeTimers();
    let clock = 0;
    const tracker = createStartupTracker(() => clock, () => undefined);
    tracker.begin('bootAppLock');
    render(<StartupWatchdog tracker={tracker} now={() => clock} />);
    clock = 9000;
    await tick(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(screen.queryByRole('button', { name: tStartupBlocked('retry') })).toBeNull();
  });

  it('ouverture de la base en migration au-delà de 15 s : diagnostic sans « Réessayer »', async () => {
    vi.useFakeTimers();
    useAppStore.setState({ dbProgress: { step: 'migration', migration: 30 } });
    render(<DbOpenWatchdog />);
    await tick(16_000);
    // Migration : le délai est celui des étapes de base (120 s), aucun diagnostic à 16 s.
    expect(screen.queryByTestId('db-failure-detail')).toBeNull();
    await tick(110_000);
    expect(screen.getByTestId('db-failure-detail')).toBeVisible();
    expect(screen.queryByRole('button', { name: t('app.diag.retry') })).toBeNull();
    // Texte vrai : plus de « touche Réessayer » quand le bouton n'existe pas.
    expect(screen.queryByText(t('app.dbStalled'))).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(t('app.dbSlow'));
    vi.useRealTimers();
  });

  it('ouverture de la base à l’étape « load » au-delà de 15 s : « Réessayer » proposé', async () => {
    vi.useFakeTimers();
    useAppStore.setState({ dbProgress: { step: 'load' } });
    render(<DbOpenWatchdog />);
    await tick(16_000);
    vi.useRealTimers();
    expect(screen.getByRole('button', { name: t('app.diag.retry') })).toBeVisible();
  });
});

describe('C-116 : bloc de signature illisible', () => {
  it('l’échec du chargement est journalisé sans passer l’app en erreur de démarrage', async () => {
    useAppStore.setState({ dbStatus: 'ready', dbFailure: null });
    const stop = startSigningLazily({} as never, () => Promise.reject(new Error('bloc illisible')));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useAppStore.getState().dbStatus).toBe('ready');
    expect(useAppStore.getState().dbFailure).toBeNull();
    stop();
  });
});
