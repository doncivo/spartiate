// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logFailure = vi.fn();
vi.mock('../../platform/desktop/log', () => ({
  logFailure: (...args: unknown[]) => logFailure(...args),
  currentLogJournal: () => null,
  installLogJournal: () => undefined,
}));
vi.mock('../../platform/logs', () => ({ openLogJournal: () => ({ record: () => undefined }) }));

import { installGlobalErrorCapture } from './globalErrors';
import { startLogJournal } from './logJournalBoot';
import { createTimeZoneWatcher } from './timeZoneWatcher';

describe('SHELL-0294d, C-123 et BL-032 : capture des erreurs', () => {
  beforeEach(() => logFailure.mockClear());
  afterEach(() => vi.restoreAllMocks());

  it('la capture globale est installée dès l’appel, avant la fin du chargement du journal', () => {
    const add = vi.spyOn(window, 'addEventListener');
    void startLogJournal('main');
    const names = add.mock.calls.map((call) => call[0]);
    expect(names).toContain('error');
    expect(names).toContain('unhandledrejection');
  });

  it('un message libre (valeur corporelle possible) n’est pas gardé : le nom seul', () => {
    const stop = installGlobalErrorCapture(window);
    window.dispatchEvent(new ErrorEvent('error', { error: new RangeError('poids 82,4 kg invalide'), message: 'x' }));
    stop();
    expect(logFailure).toHaveBeenCalledTimes(1);
    const [, error] = logFailure.mock.calls[0] as [string, Error];
    expect(error.message).toBe('rangeerror');
  });

  it('un code technique reste lisible', () => {
    const stop = installGlobalErrorCapture(window);
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('load-failed'), message: 'x' }));
    stop();
    expect((logFailure.mock.calls[0] as [string, Error])[1].message).toBe('error load-failed');
  });

  it('timeZoneWatcher : une erreur de réglage est notée au journal, jamais absorbée en silence', async () => {
    const failing = {
      data: {
        repos: {
          settings: {
            get: () => Promise.reject(new Error('settings-unreadable')),
          },
        },
      },
    } as never;
    const watcher = createTimeZoneWatcher(failing, { detect: () => 'Europe/Paris' });
    await expect(watcher.check()).resolves.toBeUndefined();
    expect(logFailure).toHaveBeenCalledTimes(1);
    expect((logFailure.mock.calls[0] as [string, Error])[0]).toBe('timezone');
  });
});
