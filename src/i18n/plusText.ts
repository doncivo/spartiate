/**
 * Textes de l'onglet « Plus » réorganisé (planches docs/maquettes/i0/iPhone-Plus et PC-Plus) : chargés avec l'écran Réglages, hors du
 * bundle de départ. Les libellés des lignes existantes restent dans leurs catalogues.
 */
const fr = {
  // iPhone : sections en capitales
  sectionData: 'DONNÉES',
  sectionIphone: 'IPHONE',
  sectionPreferences: 'PRÉFÉRENCES',
  sectionAbout: 'À PROPOS',
  // Carte profil
  avatarInitial: 'A',
  profileSummaryEmpty: 'Taille, poids et objectif',
  profileSummarySeparator: ' · ',
  profileHeight: '{cm} cm',
  profileWeight: '{kg} kg {when}',
  profileWeightToday: 'aujourd’hui',
  profileWeightOn: 'le {date}',
  // PC : sommaire (cinq entrées) et titres de section
  navProfile: 'Profil et poids',
  navData: 'Synchro et données',
  navPreferences: 'Préférences',
  navKeyboard: 'Raccourcis clavier',
  navAbout: 'À propos et diagnostic',
  // PC : sous-titres de « Synchro et données »
  groupSync: 'SYNCHRONISATION ICLOUD',
  groupBackups: 'SAUVEGARDES',
  groupExport: 'EXPORT ET IMPORT',
  exportHint: 'Archive .zip : profil, pesées et thème',
  // RESET-01 : entrée de l'écran « Repartir de zéro » (ses textes sont chargés avec lui).
  resetRow: 'Repartir de zéro',
  resetHint: 'Efface toutes les données, sur tes deux appareils',
} as const;
export type PlusTextKey = keyof typeof fr;

export function tPlus(key: PlusTextKey, params: Readonly<Record<string, string | number>> = {}): string {
  let text: string = fr[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}
