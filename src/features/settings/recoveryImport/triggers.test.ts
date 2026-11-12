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

  it('I6-04 : l’import Renpho part avec celui de la récupération, aux mêmes déclenchements ; son rejet ne gêne pas l’autre', async () => {
    const run = vi.fn(async () => ({ status: 'done' }) as never);
    const bodyRun = vi.fn(async () => {
      throw new Error('boom');
    });
    const handle = startRecoveryImportOnOpen(container, { service: { run }, bodyService: { run: bodyRun } });
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledWith('open');
    expect(bodyRun).toHaveBeenCalledWith('open');
    setVisibility('hidden');
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(bodyRun).toHaveBeenCalledTimes(2);
    handle.dispose();
  });

  describe('FIX-0172 : une relecture environ 45 s après l’ouverture, si la lecture d’ouverture n’a rien apporté (D-135)', () => {
    type Logged = { event: string; counts: Record<string, number> };
    const nothingNew = { status: 'done', files: [{ type: 'sommeil', state: 'imported', read: 10, added: 0, duplicates: 10, updated: 0 }] };
    const somethingNew = { status: 'done', files: [{ type: 'sommeil', state: 'imported', read: 10, added: 3, duplicates: 7, updated: 0 }] };
    const setup = (first: object, then: object = nothingNew) => {
      const logs: Logged[] = [];
      const run = vi.fn(async (trigger: string) => (trigger === 'open' ? first : then) as never);
      const handle = startRecoveryImportOnOpen(container, { service: { run }, log: (event, counts) => logs.push({ event, counts }) });
      return { run, logs, handle };
    };
    const rereads = (logs: readonly Logged[]) => logs.filter((l) => l.event === 'recovery-import-reread');

    it('rien de nouveau à l’ouverture : UNE relecture « reread » 45 s plus tard, pas avant, journalisée ok', async () => {
      const { run, logs, handle } = setup(nothingNew);
      await vi.advanceTimersByTimeAsync(3000);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open']);
      await vi.advanceTimersByTimeAsync(44_999);
      expect(run).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open', 'reread']);
      expect(rereads(logs)).toEqual([{ event: 'recovery-import-reread', counts: { ok: 1 } }]);
      handle.dispose();
    });

    it('jamais de boucle : une relecture qui n’apporte rien n’en programme pas d’autre', async () => {
      const { run, handle } = setup(nothingNew, nothingNew);
      await vi.advanceTimersByTimeAsync(3000 + 45_000);
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open', 'reread']);
      handle.dispose();
    });

    it('lecture d’ouverture limitée par les 30 minutes (« throttled ») : la relecture a lieu quand même, une fois', async () => {
      const { run, handle } = setup({ status: 'throttled', files: [] });
      await vi.advanceTimersByTimeAsync(3000 + 45_000);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open', 'reread']);
      handle.dispose();
    });

    it('la lecture d’ouverture a importé du nouveau : aucune relecture', async () => {
      const { run, logs, handle } = setup(somethingNew);
      await vi.advanceTimersByTimeAsync(3000 + 120_000);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open']);
      expect(rereads(logs)).toEqual([]);
      handle.dispose();
    });

    it('PC (« unsupported ») ou lecteur non automatique (« needs-pick ») : aucune relecture', async () => {
      for (const status of ['unsupported', 'needs-pick', 'busy']) {
        const { run, handle } = setup({ status, files: [] });
        await vi.advanceTimersByTimeAsync(3000 + 120_000);
        expect(run.mock.calls.map((c) => c[0]), status).toEqual(['open']);
        handle.dispose();
      }
    });

    it('l’app passe en arrière-plan avant 45 s : minuteur annulé, aucune relecture, journalisée skipped', async () => {
      const { run, logs, handle } = setup(nothingNew);
      await vi.advanceTimersByTimeAsync(3000 + 20_000);
      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(120_000);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open']);
      expect(rereads(logs)).toEqual([{ event: 'recovery-import-reread', counts: { skipped: 1 } }]);
      handle.dispose();
    });

    it('dispose avant 45 s : aucune relecture', async () => {
      const { run, handle } = setup(nothingNew);
      await vi.advanceTimersByTimeAsync(3000);
      handle.dispose();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(run.mock.calls.map((c) => c[0])).toEqual(['open']);
    });

    it('relecture qui ne peut pas lire (dossier injoignable, import en cours) : journalisée skipped', async () => {
      const { logs, handle } = setup(nothingNew, { status: 'folder-unavailable', files: [] });
      await vi.advanceTimersByTimeAsync(3000 + 45_000);
      expect(rereads(logs)).toEqual([{ event: 'recovery-import-reread', counts: { skipped: 1 } }]);
      handle.dispose();
    });
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
