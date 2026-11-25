/**
 * Actions « +30 s » et « Passer » de la notification de fin de repos (SHELL-0294b, § 13.3 b, BL-108, D-541, D-599). Règles pures : aucune
 * horloge implicite, tout est passé en argument.
 *
 * La notification de repos (identifiant fixe, `extra.sid = 'timer:rest'`, `extra.at` = échéance du repos en ms) porte la catégorie
 * `sp.rest`. L'action ne s'applique qu'au repos que cette notification annonçait : échéance persistée identique, ou repos déjà effacé par la
 * reprise de l'écran de séance (l'app vient de s'ouvrir sur l'échéance passée), et toujours dans les cinq minutes qui suivent l'échéance.
 */

export type RestActionId = 'extend30' | 'skip';
export const REST_ACTION_IDS: readonly RestActionId[] = ['extend30', 'skip'];
export const isRestActionId = (value: unknown): value is RestActionId => value === 'extend30' || value === 'skip';

/** Catégorie de la notification de fin de repos (`actionTypeId` envoyé avec `show`). */
export const REST_ACTION_TYPE_ID = 'sp.rest';
/** `extra.sid` de la notification du repos (`timerNotification.ts`, sorte `rest`). */
export const REST_NOTIFICATION_SID = 'timer:rest';
/** Secondes ajoutées par « +30 s ». */
export const REST_ACTION_EXTEND_SEC = 30;
/** Au-delà de cinq minutes après l'échéance, « +30 s » n'a plus de sens : l'action est ignorée et dite. */
export const REST_ACTION_WINDOW_MS = 5 * 60_000;

/** Action de repos telle que la rend le fichier natif (une ligne). */
export interface RawRestAction {
  readonly numericId: number;
  readonly actionId: RestActionId;
  /** Instant de la réponse de l'utilisateur (ms UTC). */
  readonly receivedAtMs: number;
  readonly sid: string | null;
  /** Échéance annoncée par la notification (`extra.at`, ms UTC) ; null si absente. */
  readonly deliveredAt: number | null;
}

export type RestActionIgnored = 'not-rest' | 'other-rest' | 'late';

export type RestActionDecision =
  | { readonly kind: 'extend' }
  /** `running` : le repos annoncé est encore persisté (il est arrêté) ; sinon seules la Live Activity et la notification sont fermées. */
  | { readonly kind: 'skip'; readonly running: boolean }
  | { readonly kind: 'ignore'; readonly reason: RestActionIgnored };

/** Décision pour une action, d'après l'échéance du repos persistée (ms, null : aucun repos) et l'instant présent. */
export function decideRestAction(action: RawRestAction, restEndMs: number | null, nowMs: number): RestActionDecision {
  if (action.sid !== REST_NOTIFICATION_SID || action.deliveredAt === null) return { kind: 'ignore', reason: 'not-rest' };
  if (restEndMs !== null && restEndMs !== action.deliveredAt) return { kind: 'ignore', reason: 'other-rest' };
  if (action.actionId === 'skip') return { kind: 'skip', running: restEndMs !== null };
  return nowMs - action.deliveredAt <= REST_ACTION_WINDOW_MS ? { kind: 'extend' } : { kind: 'ignore', reason: 'late' };
}

/** Clé d'idempotence : identifiant stable (sinon numérique), action, échéance livrée (sinon instant de la réponse). */
export function restActionKey(action: RawRestAction): string {
  const who = action.sid !== null && action.sid !== '' ? action.sid : `n:${String(action.numericId)}`;
  return `${who}|${action.actionId}|${String(action.deliveredAt ?? action.receivedAtMs)}`;
}
