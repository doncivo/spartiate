import { logFailure } from '../../platform/desktop/log';

const MAX_MESSAGE = 120;

/** Erreur à noter : le nom (en minuscules, forme d'un code) puis le message tronqué ; le journal assainit le détail (seconde barrière). */
function toLoggable(value: unknown): Error {
  const name = value instanceof Error ? value.name.toLowerCase() : 'unknown';
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  return new Error(`${/^[a-z0-9][a-z0-9-]*$/.test(name) ? name : 'unknown'} ${message.slice(0, MAX_MESSAGE)}`.trimEnd());
}

type Target = Pick<Window, 'addEventListener' | 'removeEventListener'>;
let active: (() => void) | null = null;

/**
 * 0.2.4 point 2 : capture globale des erreurs non gérées (`error`, `unhandledrejection`) vers `logFailure('app', …)`. Une seule installation
 * à la fois (la seconde rend un arrêt sans effet) ; renvoie l'arrêt.
 */
export function installGlobalErrorCapture(target: Target): () => void {
  if (active) return () => undefined;
  const onError = (event: Event): void => logFailure('app', toLoggable((event as ErrorEvent).error ?? (event as ErrorEvent).message));
  const onRejection = (event: Event): void => logFailure('app', toLoggable((event as PromiseRejectionEvent).reason));
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  const stop = (): void => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
    if (active === stop) active = null;
  };
  active = stop;
  return stop;
}
