
/**
 * Échecs d'enregistrement qu'un nouvel essai ne peut pas résoudre (revue du lot F) : texte et action utile à la place de « Réessayer ».
 * Catalogue à part (chargé avec les écrans qui enregistrent, hors du bundle de départ) ; mêmes clés en anglais (`fileFailureText.test.ts`).
 */
export const fileFailureFr = {
  unsafeFolder: 'Le dossier temporaire de l’app est anormal : ferme puis rouvre Spartiate, il est remis en ordre au lancement.',
  badName: 'Le nom du fichier a été refusé, rien n’a été enregistré : exporte les logs (Réglages › À propos › Logs) pour le signaler.',
} as const;

export function tFileFailure(key: keyof typeof fileFailureFr): string {
  return fileFailureFr[key];
}
