/**
 * Textes du scan de tâches (M9, Q-04), en français : source de vérité ; `en.scan.ts` suit la même forme.
 * Sources : Scan.html (relecture) ; la fenêtre PC (source, webcam, moteur indisponible) n'a pas de maquette.
 */
export const scanFr = {
  button: 'Scan tâches',
  dialogLabel: 'Scan tâches',
  heading: 'SCAN TÂCHES',
  cancel: 'Annuler le scan',
  // Choix de la source (PC : fichier ou webcam ; iPhone : sélecteur du système).
  source: {
    title: 'Ta liste',
    hint: 'Photographie ou importe une liste de tâches, une par ligne. La photo n’est ni enregistrée ni envoyée.',
    pickPhoto: 'Prendre ou choisir une photo',
    drop: 'Dépose une image ici',
    formats: 'JPEG, PNG ou WebP, 10 Mo au plus',
  },
  refusal: {
    unsupported: 'Format non pris en charge. Choisis une image JPEG, PNG ou WebP.',
    tooLarge: 'Cette image est trop lourde (10 Mo au plus).',
    unreadable: 'Cette image est illisible. Essaie-en une autre.',
  },
  reading: {
    title: 'Lecture en cours',
    hint: 'Le texte de la photo est lu sur cet appareil.',
  },
  error: {
    title: 'La lecture a échoué',
    hint: 'La photo n’a pas pu être lue. Reprends la photo ou choisis une autre image.',
  },
  empty: {
    title: 'Aucune ligne reconnue',
    hint: 'Aucun texte n’a été trouvé sur cette image.',
  },
  // Écran de relecture (Scan.html).
  review: {
    title: 'Relecture',
    truncated: 'Seules les {max} premières lignes sur {count} sont gardées.',
    instructions: 'Corrige le texte, décoche ce qu’il ne faut pas créer, puis valide.',
    create: 'Créer cette tâche',
    skip: 'Ne pas créer cette tâche',
    space: 'Espace',
    lines: 'Lignes à créer',
  },
  dateChoice: {
    today: 'Aujourd’hui',
    tomorrow: 'Demain',
    someday: 'Un jour',
    pick: 'Choisir une date',
  },
  confirmClose: {
    title: 'Fermer sans créer ?',
    message: 'Tes corrections seront perdues.',
    confirm: 'Fermer sans créer',
    keep: 'Continuer la relecture',
  },
  // Pack de langue français absent (PRD section 10, Q-04 critère 11).
  unavailable: {
    title: 'Reconnaissance du texte indisponible',
    hint: 'Le pack de langue français avec reconnaissance de texte n’est pas installé sur ce PC. Pour le lire avec Windows :',
    step1: 'Ouvre Paramètres Windows › Heure et langue › Langue et région.',
    step2: 'Choisis Français › Options de langue.',
    step3: 'Installe « Reconnaissance de texte ».',
    steps: 'Marche à suivre',
  },
  // Moteur de lecture de l’iPhone (Vision, CAP-IOS-01) : indisponible ou lecture refusée. Jamais de repli automatique : le moteur intégré se choisit.
  unavailableIos: {
    title: 'Le moteur de lecture de l’iPhone est indisponible',
    languageHint: 'Le moteur de lecture de l’iPhone ne sait pas lire le français sur cet appareil. Tu peux lire la photo avec le moteur intégré, plus lent.',
  },
  visionError: {
    title: 'La lecture n’a pas abouti',
    hint: 'Le moteur de lecture de l’iPhone n’a pas pu lire cette photo. Réessaie, ou lis-la avec le moteur intégré, plus lent.',
    retry: 'Réessayer',
    cause: {
      timeout: 'La lecture a pris trop de temps. Réessaie, ou lis la photo avec le moteur intégré, plus lent.',
      busy: 'Une lecture est encore en cours. Réessaie dans un instant.',
      tooLarge: 'Cette image est trop lourde pour le moteur de l’iPhone. Reprends une photo, ou lis-la avec le moteur intégré.',
      dimensions: 'Cette image est trop grande pour le moteur de l’iPhone. Reprends une photo, ou lis-la avec le moteur intégré.',
    },
  },
  code: 'Code : {code}',
  cleanupFailed: 'Une copie temporaire d’une photo précédente n’a pas pu être supprimée de l’iPhone. Redémarre l’application.',
  // Caméra du sélecteur de photo de l’iPhone (I-05 critère 10) : l’état de l’autorisation n’est pas lisible, la phrase ne dépend d’aucun état.
  cameraHint: {
    text: 'Pour photographier une liste, autorise la caméra : iOS te le demandera la première fois. Si rien ne se passe, ouvre Réglages › Spartiate › Caméra.',
    openSettings: 'Ouvrir les réglages',
    settingsFailed: 'Les réglages n’ont pas pu s’ouvrir. Ouvre Réglages › Spartiate › Caméra.',
  },
  checking: 'Vérification du moteur de lecture',
} as const;
