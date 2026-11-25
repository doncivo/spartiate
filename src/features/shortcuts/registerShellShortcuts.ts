import type { AppContainer } from '../app/container';
import { DEFAULT_ROUTES, useNavigationStore } from '../app/navigation';
import { isModalOpen } from '../app/tabShortcuts';

/**
 * Raccourcis de la coquille (D-04, P-08), enregistrés une fois par l'application :
 * - Ctrl+/ : ouvre la liste des raccourcis, même dans un champ de saisie ; déjà ouverte, la ferme ;
 * - Ctrl+K : ouvre la palette de commandes (C-135, D-480), PC seulement ;
 * - Ctrl+, : ouvre Réglages (ignoré sous une feuille ou une fenêtre modale, qui peut contenir une saisie en cours).
 *
 * `help` est faux sur iPhone : pas de clavier, donc ni raccourci ni fenêtre (P-08 critère 6).
 * Renvoie la fonction qui retire les raccourcis.
 */
export function registerShellShortcuts(container: Pick<AppContainer, 'shortcuts'>, options: { readonly help: boolean; readonly palette?: boolean }): () => void {
  const offs: Array<() => void> = [];
  // C-135 (D-480) : Ctrl+K ouvre la palette de commandes (PC) ; ignoré sous une feuille ou une fenêtre modale ; déjà ouverte, la ferme.
  if (options.palette ?? options.help) {
    offs.push(
      container.shortcuts.register('app.palette', (): boolean => {
        const navigation = useNavigationStore.getState();
        if (navigation.overlays.at(-1)?.kind === 'commandPalette') navigation.closeOverlay();
        else if (isModalOpen()) return false;
        else navigation.openOverlay({ kind: 'commandPalette' });
        return true;
      }),
    );
  }
  if (options.help) {
    offs.push(
      container.shortcuts.register('app.shortcutsHelp', () => {
        const navigation = useNavigationStore.getState();
        if (navigation.overlays.at(-1)?.kind === 'shortcutsHelp') navigation.closeOverlay();
        else navigation.openOverlay({ kind: 'shortcutsHelp' });
      }),
    );
  }
  offs.push(
    container.shortcuts.register('app.settings', (): boolean => {
      if (isModalOpen()) return false;
      useNavigationStore.getState().navigate(DEFAULT_ROUTES.more);
      return true;
    }),
  );
  return () => {
    for (const off of offs) off();
  };
}

/**
 * Échap, dernier recours (D-04) : ferme la surcouche du dessus, sinon la fiche détail. Enregistré avant les écrans, donc de
 * priorité la plus basse : le panneau « Un jour » et le mode édition gardent leur propre Échap. Sans rien à fermer, il décline.
 */
export function registerEscapeFallback(container: Pick<AppContainer, 'shortcuts'>): () => void {
  return container.shortcuts.register('app.escape', (): boolean => {
    return useNavigationStore.getState().escape();
  });
}
