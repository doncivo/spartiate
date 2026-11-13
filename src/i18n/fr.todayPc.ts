/**
 * ERGO-02 (PC-Aujourdhui-apres.dc.html) : textes de la séance du jour en tableau et de la colonne droite d'Aujourd'hui PC. Catalogue à part de
 * fr.today.ts (départ) : il n'est lu que par des blocs à la demande (TodaySessionCard, TodayPcSide) et se charge avec eux.
 */
export const todayPcFr = {
  sessionEnterHere: 'Saisir la séance ici',
  sessionTableRank: '#',
  sessionTableExercise: 'Exercice',
  sessionTableTarget: 'Cible',
  sessionTableLoad: 'Charge',
  loadToEnter: 'à saisir',
  sessionTarget: '{sets} × {min}–{max}',
  sessionTargetSame: '{sets} × {min}',
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
} as const;
