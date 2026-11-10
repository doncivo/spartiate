/**
 * Textes des réglages « Sommeil et rappels » (Plus, I5-02 point 2.3) et des notifications de récupération, à part du catalogue principal
 * (bundle de départ) : chargés avec l'écran, ou à la demande par le service au moment de composer une notification.
 * Les textes de notification sont VISIBLES sur l'écran verrouillé : neutres, sans chiffre, sans valeur corporelle, sans diagnostic.
 */
export const recoveryNotificationsFr = {
  row: 'Sommeil et rappels',
  rowValueOff: 'désactivés',
  rowValueOn: 'activés',
  title: 'Sommeil et rappels',
  back: 'Retour',
  intro: 'Spartiate peut te prévenir sur cet iPhone, avec un texte neutre : jamais un chiffre de ta récupération sur l’écran verrouillé. Tout est désactivé tant que tu ne l’actives pas.',
  proposalTitle: 'Heure de coucher proposée',
  proposalValue: '{time}',
  proposalNone: 'Pas encore de proposition : il faut au moins 7 nuits avec une heure de lever connue.',
  proposalUnknown: 'Pas encore de proposition : importe tes fichiers Raccourcis dans Apple Santé.',
  proposalHelp: 'Calculée avec ton besoin de sommeil de la nuit à venir et ton heure de lever habituelle (médiane des 14 derniers jours). Une proposition, pas une consigne.',
  bedtimeLabel: 'Rappel de coucher',
  bedtimeHint: 'Une notification 30 minutes avant l’heure proposée, chaque soir.',
  morningLabel: 'Notification du matin',
  morningHint: 'Une notification au plus par jour, à 08:00, quand ta récupération du jour est calculée.',
  permissionDenied: 'Les notifications sont refusées pour Spartiate. Autorise-les dans Réglages › Notifications › Spartiate sur l’iPhone, puis reviens ici.',
  permissionUndetermined: 'iOS va te demander l’autorisation d’envoyer des notifications.',
  unavailable: 'Les notifications ne sont pas disponibles sur cet iPhone.',
  failed: 'Les notifications n’ont pas pu être planifiées. Réessaie en rouvrant l’écran.',
  pcInfo: 'Les notifications sont envoyées par l’iPhone uniquement : le PC n’en envoie aucune. Les réglages se font sur l’iPhone.',
  loadError: 'Impossible de lire les réglages. Réessaie.',
  notifBedtimeTitle: 'C’est bientôt l’heure du coucher',
  notifBedtimeBody: 'Ton coucher conseillé approche.',
  notifMorningTitle: 'Spartiate',
  notifMorningBody: 'Ta récupération du jour est prête',
} as const;

export type RecoveryNotificationsTextKey = keyof typeof recoveryNotificationsFr;

export function tRn(key: RecoveryNotificationsTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = recoveryNotificationsFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
