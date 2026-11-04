import { lazy, Suspense, useEffect, useState } from 'react';
import { STARTUP_STEP_DEADLINE_MS, startupTracker, type StartupStep, type StartupTracker } from './startupSteps';

const StartupBlockedLazy = lazy(() => import('./StartupBlocked').then((m) => ({ default: m.StartupBlocked })));
const shareLazy = (): Promise<'shared' | 'cancelled' | 'failed'> => import('./shareStartupLog').then((m) => m.shareStartupLog());

export interface StartupWatchdogProps {
  readonly tracker?: StartupTracker;
  readonly now?: () => number;
  readonly onRetry?: () => void;
}

/**
 * Chien de garde de tout le démarrage (ios-demarrage) : monté tant que la coquille n'est pas affichée, il contrôle chaque seconde l'étape en
 * cours. Au-delà de 8 secondes sur une même étape, il affiche « Démarrage bloqué : <étape> » (écran et textes chargés à ce moment-là).
 */
export function StartupWatchdog({ tracker = startupTracker, now = () => performance.now(), onRetry = () => window.location.reload() }: StartupWatchdogProps) {
  const [blocked, setBlocked] = useState<StartupStep | null>(null);
  useEffect(() => {
    const check = (): void => setBlocked(tracker.current() && now() - (tracker.current()?.startedAt ?? now()) > STARTUP_STEP_DEADLINE_MS ? tracker.current() : null);
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [tracker, now]);
  if (!blocked) return null;
  const seconds = Math.round((now() - blocked.startedAt) / 1000);
  return (
    <Suspense fallback={null}>
      <StartupBlockedLazy step={blocked.name} seconds={seconds} onRetry={onRetry} onShare={shareLazy} />
    </Suspense>
  );
}
