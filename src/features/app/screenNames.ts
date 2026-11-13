/**
 * Noms des écrans à la demande (`lazyScreens.tsx`) et préfixe du repère posé sur <html> quand le bloc d'un écran est arrivé ou a
 * échoué. Module sans dépendance : les aides e2e l'importent sans tirer React ni les feuilles de style.
 */
export const SCREEN_LOADED_PREFIX = 'data-ct-loaded-';

export type ScreenName =
  | 'settingsscreen'
  | 'appearancescreen'
  | 'bodyscreen'
  | 'trainingscreen'
  | 'todaysessioncard'
  | 'nutritionscreen'
  | 'nutritionremainingcard'
  | 'supplementstoday'
  | 'recoverytoday'
  | 'todaypcside'
  | 'recoveryprogress'
  | 'bodyprogress'
  | 'cardioprogress'
  | 'onboardinghost'
  | 'onboardingflow'
  | 'applehealthscreen'
  | 'exportimportscreen'
  | 'resetdatascreen'
  | 'sectionnotice'
  | 'logsscreen'
  | 'recoveryfailure'
  | 'updaterestoreaction'
  | 'syncdetailsscreen'
  | 'restorechoicedialog'
  | 'shortcutshelp'
  | 'updatebanner';
