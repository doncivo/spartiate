/**
 * Textes des médias d'exercice (I6-07, D-235) : texte alternatif, repli visible, attribution par source vérifiée (D-231). Catalogue chargé
 * avec le bloc à la demande `ExerciseMedia` (src/features/training/media), jamais dans le départ. L'adresse de la licence est écrite sans
 * schéma : texte affiché, jamais un lien ni un appel réseau.
 */
export const trainingMediaFr = {
  mediaAlt: 'Illustration : {name}',
  mediaUnavailable: 'Illustration indisponible',
  attributionEverkinetic: 'Illustration : Everkinetic (Greg Priday et contributeurs), CC BY-SA 4.0, creativecommons.org/licenses/by-sa/4.0',
} as const;
