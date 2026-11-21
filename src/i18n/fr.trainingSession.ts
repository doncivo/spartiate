/**
 * SESS-01 : textes des ajouts de la séance active (remplacer, ne plus proposer, vignettes, sauter, notes, disques, fatigue déclarée, résumé
 * partageable). Catalogue à part, chargé avec les blocs à la demande qui l'importent ; jamais dans le départ.
 */
export const trainingSessionFr = {
  // SESS-01a — Remplacer
  replace: 'Remplacer',
  replaceTitle: 'Remplacer « {name} »',
  replaceHint: 'Les séries à faire passent au nouvel exercice, à la même place, avec la même plage et le même repos. Les séries validées restent.',
  replaceAlternatives: 'Alternatives de la fiche',
  replaceSimilar: 'Même groupe musculaire',
  replaceNone: 'Aucune alternative compatible avec le matériel de ce profil.',
  replaceSearch: 'Chercher dans la bibliothèque',
  replaceSearchClose: 'Fermer la recherche',
  replaceChosen: 'Par « {name} »',
  replaceEstimate: 'Charge de départ estimée : {load} ({rule}).',
  replaceRule: '{from} → {to} × {factor}, arrondie au cran inférieur',
  replaceNoEstimate: 'Aucune charge estimée : à saisir.',
  replaceHistory: 'Cet exercice a un historique : la progression habituelle proposera sa charge.',
  replaceReading: 'Lecture de l’historique…',
  replaceRoutine: 'Remplacer aussi dans la routine',
  replaceRoutineHint: 'Sinon, la question « Mettre à jour la routine ? » sera posée à la fin de la séance.',
  replaceConfirm: 'Remplacer',
  replaceCancel: 'Annuler',
  replacePresent: 'Cet exercice est déjà dans la séance.',
  replaceError: 'Remplacement impossible : rien n’a été modifié.',
  implBarbell: 'barre',
  implDumbbell: 'haltères (paire)',
  implMachine: 'machine',
} as const;
