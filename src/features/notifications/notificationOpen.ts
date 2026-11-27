import type { RawOpenAction } from '../../domain/notificationActions';
import { chooseOpen, openKey, type NotificationScreen } from '../../domain/notificationTargets';
import { useNavigationStore } from '../app/navigation';

/**
 * NOTIF-0302 (BL-184, D-765) : l'appui simple sur une notification ouvre l'écran qu'elle concerne. Reçoit les appuis d'un tirage du fichier
 * natif (répartiteur), suit le plus récent (règle pure `chooseOpen`) et ouvre son écran par le store de navigation. Un appui déjà suivi par ce
 * processus n'est pas rejoué ; trop ancien ou sans cible : rien ne bouge, un code est journalisé.
 */
export function createNotificationOpener(deps: { readonly nowMs: () => number; readonly log: (code: string) => void }): (opens: readonly RawOpenAction[]) => NotificationScreen | null {
  const handled = new Set<string>();
  return (opens) => {
    const choice = chooseOpen(opens, deps.nowMs(), handled);
    for (const open of opens) handled.add(openKey(open));
    if (choice.kind === 'stale' || choice.kind === 'unknown') deps.log(`notification-open-${choice.kind}`);
    if (choice.kind !== 'open') return null;
    goTo(choice.screen);
    return choice.screen;
  };
}

function goTo(screen: NotificationScreen): void {
  const nav = useNavigationStore.getState();
  nav.closeDetail();
  switch (screen) {
    case 'progress-body-measures':
      nav.setProgressView({ tab: 'body', body: 'measures' });
      nav.navigate({ tab: 'progress' });
      return;
    case 'nutrition-supplements':
      nav.navigate({ tab: 'nutrition', screen: 'supplements' });
      return;
    case 'training-session':
      nav.navigate({ tab: 'training', screen: 'session' });
      return;
    case 'more-logs':
      nav.navigate({ tab: 'more', screen: 'logs' });
      return;
    case 'more-sidestore':
      nav.navigate({ tab: 'more', screen: 'sidestore' });
      return;
    case 'today':
      nav.navigate({ tab: 'today' });
      return;
    default: {
      // Écran ajouté à la table sans route ici : erreur de typage.
      const missing: never = screen;
      throw new Error(`notification-open: ${String(missing)}`);
    }
  }
}
