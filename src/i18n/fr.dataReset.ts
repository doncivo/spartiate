/**
 * RESET-01 (D-180 à D-186) : écran « Repartir de zéro » (Plus › Données). Catalogue chargé avec l'écran, hors du départ. Français simple, tutoiement.
 */
export const dataResetFr = {
  back: 'Retour à Plus',
  title: 'Repartir de zéro',
  intro: 'Efface toutes tes données pour commencer l’usage réel avec une app comme neuve.',
  wipedTitle: 'Ce qui est effacé',
  wipedProfile: 'Profil, objectifs et onboarding',
  wipedTraining: 'Programmes, routines, profils de matériel, séances et séries, cycles',
  wipedNutrition: 'Journal alimentaire, aliments perso, recettes, favoris, cibles et check-ins, journées complètes',
  wipedBody: 'Pesées, mensurations, photos (fiches et fichiers), entrées Renpho',
  wipedRecovery: 'Récupération : résumés, échantillons importés, facteurs',
  keptTitle: 'Ce qui est gardé',
  keptSettings: 'Tes réglages de cet appareil : apparence, notifications, raccourcis, verrouillage',
  keptSync: 'L’appairage et la clé de synchro',
  keptContent: 'Le contenu fourni avec l’app : exercices, programmes de départ, table Ciqual',
  keptHealth: 'Le dossier Santé d’iCloud Drive n’est pas touché : le prochain import relira les fichiers présents.',
  bothDevices: 'S’applique à tes deux appareils : l’autre appareil efface aussi dès sa prochaine synchro, même s’il est hors ligne maintenant.',
  irreversible: 'C’est irréversible : aucune archive n’est faite avant, et les sauvegardes d’avant ne pourront plus être restaurées.',
  confirmLabel: 'Pour confirmer, tape EFFACER',
  confirmPlaceholder: 'EFFACER',
  submit: 'Tout effacer',
  busy: 'Effacement en cours…',
  refusedSession: 'Une séance est en cours : termine-la ou abandonne-la avant de repartir de zéro.',
  refusedUnsupported: 'Cette version ne peut pas repartir de zéro.',
  failed: 'L’effacement a échoué : rien n’a été modifié. Réessaie.',
  done: 'Tes données sont effacées. Spartiate redémarre.',
} as const;
