// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logFailure = vi.fn();
vi.mock('../../platform/desktop/log', () => ({ logFailure: (...args: unknown[]) => logFailure(...args) }));

import { installGlobalErrorCapture } from './globalErrors';

/** 0.2.4 point 2 : les erreurs non gérées de la fenêtre vont au journal (nom et message tronqué ; le journal assainit). */
describe('capture globale des erreurs', () => {
  let stop: () => void;
  beforeEach(() => {
    logFailure.mockClear();
    stop = installGlobalErrorCapture(window);
  });
  afterEach(() => stop());

  it('error : nom de l’erreur et message tronqué à 120 caractères', () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new TypeError(`x`.repeat(500)), message: 'x' }));
    expect(logFailure).toHaveBeenCalledTimes(1);
    const [scope, error] = logFailure.mock.calls[0] as [string, Error];
    expect(scope).toBe('app');
    expect(error.message.startsWith('typeerror ')).toBe(true);
    expect(error.message.length).toBeLessThanOrEqual('typeerror '.length + 120);
  });

  it('unhandledrejection : raison Error ou autre valeur', () => {
    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new RangeError('hors limites');
    window.dispatchEvent(event);
    const other = new Event('unhandledrejection') as Event & { reason: unknown };
    other.reason = 'texte brut';
    window.dispatchEvent(other);
    expect(logFailure).toHaveBeenCalledTimes(2);
    expect((logFailure.mock.calls[0] as [string, Error])[1].message).toBe('rangeerror hors limites');
    expect((logFailure.mock.calls[1] as [string, Error])[1].message).toBe('unknown texte brut');
  });

  it('après l’arrêt, plus rien n’est noté ; une seule installation à la fois', () => {
    const again = installGlobalErrorCapture(window);
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('une fois'), message: 'une fois' }));
    expect(logFailure).toHaveBeenCalledTimes(1);
    again();
    stop();
    window.dispatchEvent(new Event('error'));
    expect(logFailure).toHaveBeenCalledTimes(1);
  });
});
