/**
 * ERGO-02 (PC-Aujourdhui-apres.dc.html) : textes de la colonne droite d'Aujourd'hui PC (le tableau de la séance du jour est dans fr.training.ts). Catalogue à part de
 * fr.today.ts (départ) : il n'est lu que par des blocs à la demande (TodayPcSide) et se charge avec eux.
 */
export const todayPcFr = {
  macrosLabel: 'Macros du jour',
  macroProtein: 'Protéines',
  macroCarb: 'Glucides',
  macroFat: 'Lipides',
  macroUnknown: 'rien de saisi',
  macroOf: '{done} / {target} g',
  spendEyebrow: 'Dépense',
  spendUnit: 'kcal',
  spendMissing: 'pas encore estimée',
  weekEyebrow: 'Cette semaine',
  weekDone: 'séance faite',
  weekNone: 'pas de séance',
  weekCount: '{n} séances',
  weekCountOne: '1 séance',
  recordsEyebrow: 'Derniers records',
  recordsMissing: 'pas encore de record',
  recordsFailed: 'lecture impossible des séances',
  sideFailed: 'Lecture impossible : nutrition, semaine et records ne sont pas affichés. Réessaie en rouvrant l’écran.',
  /** Raisons des données manquantes de la carte « État » (PC). */
  signatureMissing: 'lue sur l’iPhone',
  healthKitMissing: 'iPhone seulement',
  lastExportMissing: 'aucun export noté',
  backupUnknown: 'non disponible ici',
} as const;
