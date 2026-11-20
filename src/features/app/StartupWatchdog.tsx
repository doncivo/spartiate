import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { logFailure } from '../../platform/desktop/log';
import { useAppStore } from './appStore';
import { isDatabaseWorkStep, startupTracker, stepDeadlineMs, type StartupStep, type StartupTracker } from './startupSteps';

const StartupBlockedLazy = lazy(() => import('./StartupBlocked').then((m) => ({ default: m.StartupBlocked })));
const shareLazy = (): Promise<'shared' | 'cancelled' | 'failed'> => import('./shareStartupLog').then((m) => m.shareStartupLog());

export interface StartupWatchdogProps {
  readonly tracker?: StartupTracker;
  readonly now?: () => number;
  readonly onRetry?: () => void;
}

const poisoned = (): boolean => useAppStore.getState().dbFailure?.kind === 'connection-poisoned';

/**
 * C-114 : frontière d'erreur unique du départ (racine de l'app, bloc « Démarrage bloqué ») ; le repli est un message statique du catalogue de
 * départ. `fallback` est évalué au rendu du repli (il lit l'état courant du démarrage).
 */
export class FallbackBoundary extends Component<{ readonly children: ReactNode; readonly fallback: () => ReactNode; readonly code: string }, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    logFailure(this.props.code, error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback() : this.props.children;
  }
}

/**
 * Chien de garde de tout le démarrage (ios-demarrage) : monté tant que la coquille n'est pas affichée, il contrôle chaque seconde l'étape en
 * cours. Au-delà de 8 secondes sur une même étape (120 s pour une sauvegarde ou une migration, C-115), il affiche « Démarrage bloqué : <étape> »
 * (écran et textes chargés à ce moment-là). Jamais de rechargement en pleine migration ni sur un pilote empoisonné (D-326 5).
 */
export function StartupWatchdog({ tracker = startupTracker, now = () => performance.now(), onRetry = () => window.location.reload() }: StartupWatchdogProps) {
  const [blocked, setBlocked] = useState<StartupStep | null>(null);
  useEffect(() => {
    const check = (): void => {
      const step = tracker.current();
      setBlocked(step && now() - step.startedAt > stepDeadlineMs(step.name) ? step : null);
    };
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [tracker, now]);
  if (!blocked) return null;
  const seconds = Math.round((now() - blocked.startedAt) / 1000);
  const canRetry = !isDatabaseWorkStep(blocked.name) && !poisoned();
  return (
    <FallbackBoundary code="startup-blocked-load" fallback={() => <p role="alert">{t('app.crashFallback')}</p>}>
      <Suspense fallback={null}>
        <StartupBlockedLazy step={blocked.name} seconds={seconds} onRetry={() => (poisoned() ? undefined : onRetry())} onShare={shareLazy} retry={canRetry} />
      </Suspense>
    </FallbackBoundary>
  );
}
