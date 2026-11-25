import { describe, expect, it } from 'vitest';
import { RepositoryError } from '../../db/repositories/common';
import type { RawRestAction } from '../../domain/restNotificationActions';
import { restNotificationsFr } from '../../i18n/fr.restNotifications';
import { createRestActionHandler, restActionTypes, type RestActionDeps } from './restActions';

/**
 * SHELL-0294b (§ 13.3 b, BL-108, D-541 (4)) : gestionnaire des actions « +30 s » et « Passer » de la notification de fin de repos.
 * `extendRest(30)` seulement sur le repos annoncé ; ignorée et dite (bandeau bref) quand elle arrive trop tard ou sans séance ; jamais deux fois.
 */
const AT = Date.parse('2026-11-25T10:00:00.000Z');
const extend: RawRestAction = { numericId: 8, actionId: 'extend30', receivedAtMs: AT + 2_000, sid: 'timer:rest', deliveredAt: AT };
const skip: RawRestAction = { ...extend, actionId: 'skip' };

function rig(over: Partial<RestActionDeps> & { restEnd?: number | null; now?: number; failExtend?: unknown } = {}) {
  const calls: string[] = [];
  const notices: string[] = [];
  const logs: string[] = [];
  let changed = 0;
  let restEnd = over.restEnd === undefined ? AT : over.restEnd;
  const deps: RestActionDeps = {
    restEndMs: async () => restEnd,
    controller: async () => ({
      extend: async (seconds) => {
        calls.push(`extend:${String(seconds)}`);
        if (over.failExtend !== undefined) throw over.failExtend;
        restEnd = (over.now ?? AT + 3_000) + 30_000;
        return { workoutId: 'w', endAt: new Date(restEnd).toISOString(), seconds: 30, notification: 'scheduled', live: 'started' };
      },
      skip: async () => {
        calls.push('skip');
        restEnd = null;
      },
      stop: async () => {
        calls.push('stop');
      },
    }),
    nowMs: () => over.now ?? AT + 3_000,
    onChanged: () => {
      changed += 1;
    },
    notice: (text) => notices.push(text),
    log: (code) => logs.push(code),
    ...over,
  };
  return { handle: createRestActionHandler(deps), calls, notices, logs, changed: () => changed };
}

describe('actions de la notification de repos', () => {
  it('catégorie « sp.rest » : « +30 s » et « Passer », au premier plan, titres de src/i18n', () => {
    expect(restActionTypes()).toEqual([
      {
        id: 'sp.rest',
        actions: [
          { id: 'extend30', title: restNotificationsFr.actionExtend, foreground: true },
          { id: 'skip', title: restNotificationsFr.actionSkip, foreground: true },
        ],
      },
    ]);
    expect(restNotificationsFr.actionExtend).toBe('+30 s');
    expect(restNotificationsFr.actionSkip).toBe('Passer');
  });

  it('« +30 s » sur le repos annoncé : extendRest(30), séance prévenue', async () => {
    const r = rig();
    expect(await r.handle([extend])).toBe(true);
    expect(r.calls).toEqual(['extend:30']);
    expect(r.changed()).toBe(1);
    expect(r.notices).toEqual([]);
  });

  it('même action relue (acquittement perdu) : appliquée une seule fois', async () => {
    const r = rig();
    await r.handle([extend]);
    await r.handle([extend]);
    expect(r.calls).toEqual(['extend:30']);
  });

  it('« +30 s » trop tard : ignorée, dite par un bandeau bref et journalisée', async () => {
    const r = rig({ restEnd: null, now: AT + 3_600_000 });
    expect(await r.handle([extend])).toBe(true);
    expect(r.calls).toEqual([]);
    expect(r.notices).toEqual([restNotificationsFr.noticeLate]);
    expect(r.logs).toContain('rest-action-ignored-late');
  });

  it('un autre repos en cours : ignorée sans toucher au repos, journalisée', async () => {
    const r = rig({ restEnd: AT + 90_000 });
    await r.handle([extend]);
    expect(r.calls).toEqual([]);
    expect(r.logs).toContain('rest-action-ignored-other-rest');
  });

  it('aucune séance ouverte : ignorée et dite', async () => {
    const r = rig({ restEnd: null, failExtend: new RepositoryError('not-found', 'workout', 'open') });
    expect(await r.handle([extend])).toBe(true);
    expect(r.notices).toEqual([restNotificationsFr.noticeNoSession]);
    expect(r.logs).toContain('rest-action-ignored-no-session');
  });

  it('« Passer » : repos annoncé arrêté ; repos déjà effacé : seule la fermeture (Live Activity, notification)', async () => {
    const running = rig();
    await running.handle([skip]);
    expect(running.calls).toEqual(['skip']);
    expect(running.changed()).toBe(1);
    const cleared = rig({ restEnd: null });
    await cleared.handle([skip]);
    expect(cleared.calls).toEqual(['stop']);
  });

  it('échec d’écriture : faux (le fichier n’est pas acquitté) ; au troisième essai, abandon dit et journalisé', async () => {
    const r = rig({ failExtend: new Error('disk') });
    expect(await r.handle([extend])).toBe(false);
    expect(await r.handle([extend])).toBe(false);
    expect(await r.handle([extend])).toBe(true);
    expect(r.notices).toEqual([restNotificationsFr.noticeFailed]);
    expect(r.logs).toContain('rest-action-dropped');
  });
});
