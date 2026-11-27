import type { RawOpenAction } from './notificationActions';

/**
 * NOTIF-0302 (BL-184, D-765, D-762 révisée) : écran ouvert par l'appui sur chaque notification de Spartiate. Règle pure : la famille se lit
 * dans l'identifiant stable de la notification (`extra.sid`, préfixe avant « : »), l'écran dans la table ci-dessous. Inventaire fermé
 * (`notificationOpen.test.ts`) : familles du planificateur (`NotificationKind`), minuteurs (`timer:rest`, `timer:test`), alerte de signature
 * (`signing`). Les familles héritées de l'ancien projet (tâche, routine, évènement, récapitulatif, répétition) ne sont plus émises : Aujourd'hui.
 */
export type NotificationScreen = 'today' | 'progress-body-measures' | 'nutrition-supplements' | 'training-session' | 'more-logs' | 'more-sidestore';

export type NotificationFamily =
  | 'measurement'
  | 'supplement'
  | 'injury'
  | 'morning'
  | 'bedtime'
  | 'rest'
  | 'test-timer'
  | 'signing'
  | 'task'
  | 'routine'
  | 'event'
  | 'recap'
  | 'snooze';

export const NOTIFICATION_SCREEN_OF: Readonly<Record<NotificationFamily, NotificationScreen>> = {
  // Rappel des mesures (CORPS-0301d) : Progrès › Corps › Mesures (D-765).
  measurement: 'progress-body-measures',
  // Rappel de compléments : Nutrition › Compléments.
  supplement: 'nutrition-supplements',
  // Check-in des gênes : la carte de suivi est sur Aujourd'hui.
  injury: 'today',
  // « Ta récupération du jour est prête » : cadrans d'Aujourd'hui.
  morning: 'today',
  // Coucher conseillé : besoin de sommeil sur Aujourd'hui.
  bedtime: 'today',
  // Fin de repos : séance en cours.
  rest: 'training-session',
  // Minuteur de test (SPA-007) : Plus › Journaux, où il se lance.
  'test-timer': 'more-logs',
  // Expiration de la signature : Plus › SideStore.
  signing: 'more-sidestore',
  task: 'today',
  routine: 'today',
  event: 'today',
  recap: 'today',
  snooze: 'today',
};

export const NOTIFICATION_FAMILIES = Object.keys(NOTIFICATION_SCREEN_OF) as readonly NotificationFamily[];

/** Identifiants fixes hors du planificateur. */
const FIXED: Readonly<Record<string, NotificationFamily>> = { 'timer:rest': 'rest', 'timer:test': 'test-timer', signing: 'signing' };
/** Familles qui ne s'écrivent jamais en préfixe (identifiant fixe seulement). */
const FIXED_ONLY: readonly string[] = ['rest', 'test-timer', 'signing', 'timer'];

export function notificationFamilyOf(sid: string | null): NotificationFamily | null {
  if (sid === null || sid === '') return null;
  const fixed = FIXED[sid];
  if (fixed !== undefined) return fixed;
  const prefix = sid.split(':')[0] ?? '';
  if (FIXED_ONLY.includes(prefix)) return null;
  return (NOTIFICATION_FAMILIES as readonly string[]).includes(prefix) ? (prefix as NotificationFamily) : null;
}

export function notificationScreenOf(sid: string | null): NotificationScreen | null {
  const family = notificationFamilyOf(sid);
  return family === null ? null : NOTIFICATION_SCREEN_OF[family];
}

/** Un appui plus ancien n'ouvre plus rien (fichier rejoué après un acquittement impossible) : l'utilisateur a pu aller ailleurs depuis. */
export const OPEN_FRESH_MS = 10 * 60_000;

export const openKey = (open: RawOpenAction): string => `${String(open.receivedAtMs)}|${open.sid ?? ''}`;

export type OpenChoice = { readonly kind: 'open'; readonly open: RawOpenAction; readonly screen: NotificationScreen } | { readonly kind: 'stale' | 'unknown' | 'none' };

/** Appui à suivre : le plus récent non encore suivi ; trop ancien ou sans cible : rien. */
export function chooseOpen(opens: readonly RawOpenAction[], nowMs: number, handled: ReadonlySet<string>): OpenChoice {
  const fresh = opens.filter((open) => !handled.has(openKey(open)));
  if (fresh.length === 0) return { kind: 'none' };
  const latest = fresh.reduce((a, b) => (b.receivedAtMs > a.receivedAtMs ? b : a));
  if (nowMs - latest.receivedAtMs > OPEN_FRESH_MS) return { kind: 'stale' };
  const screen = notificationScreenOf(latest.sid);
  return screen === null ? { kind: 'unknown' } : { kind: 'open', open: latest, screen };
}
