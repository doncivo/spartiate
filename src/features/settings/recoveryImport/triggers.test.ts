// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContainer } from '../../app/container';
import { startRecoveryImportOnOpen } from './index';

/**
 * I5-03 point 1 (D-90) : lecture du dossier sante à l'ouverture de l'app (après le premier rendu, tâche différée) et au retour au premier
 * plan. La limite de 30 minutes est tenue par le service (`run('open')` rend « throttled »), pas ici : chaque déclenchement appelle `run('open')`.
 */

const container = {} as AppContainer;

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('déclenchements de l’import automatique', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ouverture : une lecture « open » après le délai de 3 s, pas avant', async () => {
    const run = vi.fn(async () => ({ status: 'done' }) as never);
    const handle = startRecoveryImportOnOpen(container, { service: { run } });
    await vi.advanceTimersByTimeAsync(2999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('open');
    handle.dispose();
  });

  it('retour au premier plan : une lecture « open » à chaque retour visible, aucune quand la page se cache', async () => {
    const run = vi.fn(async () => ({ status: 'throttled' }) as never);
    const handle = startRecoveryImportOnOpen(container, { service: { run } });
    await vi.advanceTimersByTimeAsync(3000);
    run.mockClear();
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).not.toHaveBeenCalled();
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('open');
    setVisibility('hidden');
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    handle.dispose();
  });

  it('dispose : minuteur annulé et écouteur retiré', async () => {
    const run = vi.fn(async () => ({ status: 'done' }) as never);
    const early = startRecoveryImportOnOpen(container, { service: { run } });
    early.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
    setVisibility('hidden');
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).not.toHaveBeenCalled();
  });

  it('un rejet du service ne remonte jamais', async () => {
    const run = vi.fn(async () => {
      throw new Error('boom');
    });
    const handle = startRecoveryImportOnOpen(container, { service: { run } });
    await vi.advanceTimersByTimeAsync(3000);
    setVisibility('hidden');
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    handle.dispose();
  });
});
