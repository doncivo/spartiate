import { describe, expect, it } from 'vitest';
import { decideRestAction, isRestActionId, REST_ACTION_IDS, REST_ACTION_TYPE_ID, REST_ACTION_WINDOW_MS, REST_NOTIFICATION_SID, restActionKey, type RawRestAction } from './restNotificationActions';

/**
 * SHELL-0294b (§ 13.3 b, BL-108, D-541 (4)) : actions « +30 s » et « Passer » de la notification de fin de repos. Règle pure : l'action ne
 * s'applique qu'au repos que la notification annonçait (`extra.at` = échéance persistée), ou, repos déjà effacé à la reprise, dans les
 * cinq minutes qui suivent l'échéance ; tout le reste est ignoré avec son motif (jamais un repos d'une autre série prolongé).
 */
const AT = Date.parse('2026-11-25T10:00:00.000Z');
const action = (over: Partial<RawRestAction> = {}): RawRestAction => ({ numericId: 8, actionId: 'extend30', receivedAtMs: AT + 2_000, sid: REST_NOTIFICATION_SID, deliveredAt: AT, ...over });

describe('actions de la notification de repos', () => {
  it('identifiants : « extend30 » et « skip », catégorie « sp.rest »', () => {
    expect(REST_ACTION_IDS).toEqual(['extend30', 'skip']);
    expect(REST_ACTION_TYPE_ID).toBe('sp.rest');
    expect(isRestActionId('extend30')).toBe(true);
    expect(isRestActionId('skip')).toBe(true);
    expect(isRestActionId('done')).toBe(false);
    expect(isRestActionId('snooze15')).toBe(false);
  });

  it('« +30 s » sur le repos annoncé (échéance persistée identique) : prolongé', () => {
    expect(decideRestAction(action(), AT, AT + 3_000)).toEqual({ kind: 'extend' });
  });

  it('« +30 s » quand la reprise a déjà effacé le repos échu : prolongé dans la fenêtre de cinq minutes, ignoré « late » au-delà', () => {
    expect(decideRestAction(action(), null, AT + REST_ACTION_WINDOW_MS)).toEqual({ kind: 'extend' });
    expect(decideRestAction(action(), null, AT + REST_ACTION_WINDOW_MS + 1)).toEqual({ kind: 'ignore', reason: 'late' });
    // Même échéance encore persistée, mais app rouverte bien plus tard : jamais un repos de 30 s relancé une heure après.
    expect(decideRestAction(action(), AT, AT + 3_600_000)).toEqual({ kind: 'ignore', reason: 'late' });
  });

  it('un autre repos est en cours (nouvelle série, ou « +30 s » déjà appliqué) : ignoré « other-rest »', () => {
    expect(decideRestAction(action(), AT + 30_000, AT + 3_000)).toEqual({ kind: 'ignore', reason: 'other-rest' });
    expect(decideRestAction(action({ actionId: 'skip' }), AT + 90_000, AT + 3_000)).toEqual({ kind: 'ignore', reason: 'other-rest' });
  });

  it('« Passer » : repos annoncé arrêté ; repos déjà effacé : seule la Live Activity est fermée', () => {
    expect(decideRestAction(action({ actionId: 'skip' }), AT, AT + 3_000)).toEqual({ kind: 'skip', running: true });
    expect(decideRestAction(action({ actionId: 'skip' }), null, AT + 3_600_000)).toEqual({ kind: 'skip', running: false });
  });

  it('notification qui n’est pas celle du repos (identifiant ou échéance absents) : ignorée « not-rest »', () => {
    expect(decideRestAction(action({ sid: 'timer:test' }), AT, AT)).toEqual({ kind: 'ignore', reason: 'not-rest' });
    expect(decideRestAction(action({ sid: null }), AT, AT)).toEqual({ kind: 'ignore', reason: 'not-rest' });
    expect(decideRestAction(action({ deliveredAt: null }), AT, AT)).toEqual({ kind: 'ignore', reason: 'not-rest' });
  });

  it('clé d’idempotence : identifiant, action, échéance livrée', () => {
    expect(restActionKey(action())).toBe(`timer:rest|extend30|${String(AT)}`);
    expect(restActionKey(action({ sid: null, deliveredAt: null }))).toBe(`n:8|extend30|${String(AT + 2_000)}`);
  });
});
