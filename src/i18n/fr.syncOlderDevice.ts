/**
 * SYNC-01 (D-275) : avertissement `older-device` (bandeau A-09 « synchro » et section AVERTISSEMENTS de Réglages › Synchronisation › Détails) :
 * des éléments créés sur un appareil resté à une version plus ancienne attendent sa mise à jour. À part du catalogue principal (bundle de
 * départ) : chargé à la demande, jamais au démarrage. Jamais de nom d'élément ni de valeur reçue.
 */
export const syncOlderDeviceFr = {
  banner: 'Un appareil utilise une version plus ancienne. Mets-le à jour.',
} as const;
