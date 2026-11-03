
/**
 * Textes des actions de secours de la synchro (Détails › AVERTISSEMENTS : « Démarrer la synchro depuis cet appareil », « Lancer une reprise
 * complète »). Catalogue à part, importé seulement par `SyncDetailsRescue` (bloc à la demande) : ces textes rares ne pèsent pas dans le
 * JavaScript de départ. Clés typées ; l'anglais est servi quand la langue courante est `en`, sinon le français.
 */
const fr = {
  startHere: 'Démarrer la synchro depuis cet appareil',
  startHereTitle: 'Démarrer la synchro depuis cet appareil ?',
  startHereBody: 'À utiliser seulement si vos autres appareils ne sont plus disponibles. Cet appareil devient le point de départ : les autres appareils fusionneront ensuite leurs données dans celui-ci.',
  fullResume: 'Lancer une reprise complète',
  fullResumeTitle: 'Lancer une reprise complète ?',
  fullResumeBody: 'Les données reçues sont relues depuis le dernier instantané et fusionnées avec celles de cet appareil ; rien n’est effacé. Une ligne supprimée sur cet appareil n’est pas recréée.',
} as const;

export type RescueTextKey = keyof typeof fr;

export function rescueText(key: RescueTextKey): string {
  return fr[key];
}
