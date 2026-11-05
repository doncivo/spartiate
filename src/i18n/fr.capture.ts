/**
 * Textes de la capture rapide (M9, Q-06 et Q-02), en français : source de vérité ; `en.capture.ts` suit la même forme.
 */
export const captureFr = {
  suggestionsLabel: 'Suggestions',
  spaceOptionLabel: 'Espace {name}',
  projectOptionLabel: 'Projet {name}',
  projectOptionLabelIn: 'Projet {name}, espace {space}',
  previewLabel: 'Ce qui sera appliqué',
  removeToken: 'Retirer {label}',
  // Feuille « Nouvelle tâche » de l'iPhone (Q-05) : base occupée ou création refusée, texte conservé.
  sheetNotReady: 'La base n’est pas prête. Ton texte est conservé ; il ne peut pas être modifié pendant l’attente. Touche « Réessayer » pour relancer l’enregistrement.',
  sheetRetry: 'Réessayer',
  // Q-05-FIX-01 : le bouton de soumission ne dépend plus du bloc des options chargé à la demande.
  sheetAdd: 'Ajouter la tâche',
  // Écriture qui se termine après la fermeture de la feuille, jamais de fin muette.
  lateSaved: 'La tâche « {title} » a été enregistrée après la fermeture de la feuille.',
  lateFailed: 'La tâche « {title} » n’a pas pu être enregistrée. Touche « + » pour la saisir de nouveau.',
  sheetSaveError: 'La tâche n’a pas pu être enregistrée. Ton texte est conservé.',
  spaceAnnounce: 'Espace {space}',
  projectAnnounce: 'Projet {project}',
  spaceProjectAnnounce: 'Espace {space}, projet {project}',
  dateAnnounce: 'Date détectée : {label}',
  unknownProject: 'Projet inconnu dans {space}',
  today: 'aujourd’hui',
  tomorrow: 'demain',
  dateAndTime: '{date} · {time}',
  spaceAndProject: '{space} · {project}',
  // Mini-fenêtre de capture rapide (Q-01).
  window: {
    label: 'Capture rapide',
    heading: 'CAPTURE RAPIDE',
    placeholder: 'Ajouter une tâche — ex. « Appeler Paul demain 10h »',
    help: 'Entrée pour ajouter · Ctrl+Entrée pour enchaîner · Échap pour fermer',
    added: 'Ajoutée : {title}',
    titleEmpty: 'Saisis un titre.',
    failed: 'Impossible d’ajouter la tâche.',
    noSpace: 'Aucun espace disponible.',
    sending: 'Ajout en cours…',
  },
  // Dictée (Q-03).
  dictation: {
    button: 'Dicter',
    helpPc: 'Appuie sur Win + H pour dicter, parle, puis relis avant d’ajouter',
    listening: 'Je t’écoute',
    finish: 'Terminer',
    permissionDenied: 'Autorise le micro dans les Réglages de l’iPhone',
    failed: 'La dictée n’a pas abouti. Réessaie ou utilise le micro du clavier.',
    // Autorisations de la dictée (I-05) : explication avant les fenêtres d’iOS, refus nommé et persistant, ouverture des Réglages.
    explain: {
      title: 'Dicter une tâche',
      text: 'Spartiate écoute ta voix pour la transformer en texte, sur l’iPhone. Rien n’est enregistré ni envoyé. iOS te demandera deux autorisations : le micro, puis la reconnaissance vocale.',
      continue: 'Continuer',
      later: 'Pas maintenant',
    },
    denied: {
      microphone: 'Le micro est refusé. Autorise-le dans les Réglages de l’iPhone pour dicter.',
      speechRecognition: 'La reconnaissance vocale est refusée. Autorise-la dans les Réglages de l’iPhone pour dicter.',
      microphoneRestricted: 'Le micro est restreint sur cet iPhone par Temps d’écran ou un profil de gestion. Seule la personne qui a posé la restriction peut la lever.',
      speechRecognitionRestricted: 'La reconnaissance vocale est restreinte sur cet iPhone par Temps d’écran ou un profil de gestion. Seule la personne qui a posé la restriction peut la lever.',
      openSettings: 'Ouvrir les réglages',
    },
    settingsFailed: 'Les réglages n’ont pas pu s’ouvrir. Ouvre Réglages › Spartiate.',
    onDeviceUnavailable: 'La dictée hors ligne en français n’est pas disponible sur cet iPhone. Active la dictée dans Réglages › Général › Clavier › Dictée. Le micro du clavier reste utilisable.',
    pluginUnavailable: 'Dictée indisponible sur cet iPhone. Le micro du clavier reste utilisable.',
    nothingHeard: 'Rien n’a été entendu. Réessaie.',
    timeLimit: 'Dictée arrêtée après 60 s.',
    interrupted: 'Dictée interrompue.',
    busy: 'Une dictée est déjà en cours.',
    unavailable: 'La dictée n’est pas disponible pour le moment.',
    unknownState: 'L’état des autorisations n’a pas pu être lu.',
    code: 'Code : {code}',
  },
  // Messages « Annuler » des créations depuis la mini-fenêtre et le scan (Q-01, Q-04).
  undo: {
    created: '« {title} » ajoutée',
    createdMany: '{count} tâches créées',
  },
} as const;
