/**
 * Procédure d'actualisation par SideStore (§ 18.3 a, C-126) : catalogue à part, chargé avec l'écran (hors du bundle de départ).
 * Texte prudent, non vérifié sur l'appareil (D-36) : le constat d'Ali dit si les libellés de SideStore sont les bons.
 */
export const sideStoreFr = {
  title: 'Actualiser avec SideStore',
  back: 'Retour à Plus',
  intro: 'La signature de Spartiate dure 7 jours. Tant qu’elle n’est pas actualisée, l’app cesse de s’ouvrir à son expiration ; tes données ne sont pas touchées.',
  steps: [
    'Ouvre SideStore, onglet « Mes apps ».',
    'Touche « Actualiser » sous Spartiate (ou « Tout actualiser »).',
    'Attends la fin de l’actualisation sans fermer SideStore.',
    'Reviens dans Spartiate : la date d’expiration affichée dans Plus › À propos et diagnostic se met à jour.',
  ],
  failure: 'Si l’actualisation échoue, vérifie la connexion de SideStore (Wi-Fi, VPN de SideStore activé) puis réessaie.',
} as const;
