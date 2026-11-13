/**
 * Textes de l'onglet « Plus » réorganisé (planches docs/maquettes/i0/iPhone-Plus et PC-Plus) : chargés avec l'écran Réglages, hors du
 * bundle de départ. Les libellés des lignes existantes restent dans leurs catalogues.
 */
const fr = {
  // iPhone : sections en capitales
  // ERGO-02 : quatre groupes (aperçu Plus-apres), iPhone et PC
  groupMe: 'MOI',
  groupSources: 'SOURCES',
  groupApp: 'APP',
  groupData: 'DONNÉES',
  listLabel: 'Réglages',
  navAppearance: 'Apparence',
  navSync: 'Appareils et synchro',
  navHealth: 'Apple Santé',
  navGeneral: 'Fuseau et démarrage',
  navBackup: 'Sauvegarde',
  navExport: 'Export et import',
  navLogs: 'Journaux',
  valueMissing: '— non renseigné',
  // Carte profil
  profileSummaryEmpty: 'Taille, poids et objectif',
  profileSummarySeparator: ' · ',
  profileHeight: '{cm} cm',
  profileWeight: '{kg} kg {when}',
  profileWeightToday: 'aujourd’hui',
  profileWeightOn: 'le {date}',
  // PC : sommaire (cinq entrées) et titres de section
  navProfile: 'Profil et poids',
  navKeyboard: 'Raccourcis clavier',
  navAbout: 'À propos et diagnostic',
  // PC : sous-titres de « Synchro et données »
  // RESET-01 : entrée de l'écran « Repartir de zéro » (ses textes sont chargés avec lui).
  resetRow: 'Repartir de zéro',
} as const;
export type PlusTextKey = keyof typeof fr;

export function tPlus(key: PlusTextKey, params: Readonly<Record<string, string | number>> = {}): string {
  let text: string = fr[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}
