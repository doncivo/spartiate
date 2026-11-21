/**
 * Textes de l'essai Apple Intelligence (Plus › Logs › Outils de test, IOS-029b), à part du catalogue principal (bundle de départ) : chargés
 * avec l'écran des Logs. Tutoiement. Aucune promesse : l'essai dit ce que le système a répondu, rien de plus.
 */
export const appleIntelligenceFr = {
  row: 'Essai Apple Intelligence',
  rowHint: 'Interroge le modèle local d’Apple (iPhone, iOS 26) avec un texte d’essai fixe. Aucune de tes données n’est envoyée.',
  start: 'Lancer l’essai',
  running: 'Essai en cours…',
  prompt: 'Texte envoyé : {prompt}',
  answered: 'Réponse du modèle en {seconds} s :',
  answeredNoTime: 'Réponse du modèle :',
  unsupported: 'Indisponible sur cet appareil : l’essai ne fonctionne que sur l’iPhone.',
  reasonSdkAbsent: 'Indisponible : cette version de l’app a été compilée sans Foundation Models (SDK iOS antérieur à 26).',
  reasonOsTooOld: 'Indisponible : il faut iOS 26 ou plus récent.',
  reasonDeviceNotEligible: 'Indisponible : cet iPhone ne prend pas en charge Apple Intelligence.',
  reasonNotEnabled: 'Indisponible : Apple Intelligence est désactivée (Réglages › Apple Intelligence et Siri).',
  reasonModelNotReady: 'Indisponible : le modèle n’est pas prêt (téléchargement en cours ?). Réessaie plus tard.',
  reasonUnknown: 'Indisponible : le système n’a pas dit pourquoi.',
  detail: 'Détail technique : {detail}',
  error: 'Le modèle a répondu par une erreur :',
  nativeError: 'Détail technique : {domain}, code {code}, {description}',
  failed: 'L’essai n’a pas abouti ({code}).',
} as const;
