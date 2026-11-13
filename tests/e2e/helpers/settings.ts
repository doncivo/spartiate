import { expect, type Locator, type Page } from '@playwright/test';

type TestInfo = { readonly project: { readonly name: string } };
const isPhone = (testInfo: TestInfo): boolean => testInfo.project.name === 'iphone';

/**
 * UI-REFONTE-09 : sur PC, les sections de Réglages portent des titres en minuscules (sommaire et colonne, PC-Reglages.html) ; l'iPhone garde
 * les capitales de Reglages.html. Même clé, deux libellés.
 */
const SECTIONS = {
  general: ['GÉNÉRAL', 'Général'],
  tasks: ['TÂCHES', 'Tâches'],
  reminders: ['RAPPELS', 'Rappels'],
  spaces: ['ESPACES ET CALENDRIERS', 'Espaces et agendas'],
  sync: ['SYNCHRONISATION', 'Synchronisation'],
  data: ['DONNÉES', 'DONNÉES'],
  keyboard: ['CLAVIER', 'Clavier'],
  about: ['À PROPOS', 'À propos et diagnostic'],
} as const;

export type SettingsSectionKey = keyof typeof SECTIONS;

/** Titre de section tel qu'il s'affiche sur l'appareil du test. */
export const settingsSectionTitle = (testInfo: TestInfo, key: SettingsSectionKey): string => SECTIONS[key][isPhone(testInfo) ? 0 : 1];

/**
 * Titre h2 d'une section de Plus. ERGO-02 : Plus a quatre groupes (MOI, SOURCES, APP, DONNÉES) ; « À propos » n'est plus une section :
 * sur iPhone, la ligne « Version … » (groupe APP) ; sur PC, l'entrée « À propos et diagnostic » de la liste.
 */
export const settingsSectionHeading = (page: Page, testInfo: TestInfo, key: SettingsSectionKey): Locator =>
  key === 'about'
    ? isPhone(testInfo)
      ? page.getByText(/^Version/)
      : page.getByRole('button', { name: /^À propos et diagnostic/ })
    : page.getByRole('heading', { level: 2, name: settingsSectionTitle(testInfo, key), exact: true });

/**
 * ERGO-02 : sur PC, un réglage de Plus s'ouvre dans le panneau de droite après un clic sur son entrée de la liste ; sur iPhone (pas de
 * liste), les lignes sont déjà dans l'écran : sans effet. Sans effet aussi quand l'entrée n'existe pas (plateforme sans sauvegarde, par exemple).
 */
export async function openPlusEntry(page: Page, name: RegExp | string): Promise<void> {
  const entry = page.getByRole('group', { name: 'Réglages' }).getByRole('button', { name });
  if ((await entry.count()) > 0) await entry.first().click();
}

/** Ligne qui ouvre « Apparence et formats » : « Thème : … » (iPhone et PC, Plus réorganisé : trois lignes). */
export const appearanceRow = (page: Page, _testInfo: TestInfo): Locator =>
  page.getByRole('button', { name: /^Thème : / });

/** Ligne « Onglets » de Réglages : « Onglets : 5 visibles » sur iPhone, « Onglets visibles : 5 sur 5 » sur PC (UI-REFONTE-09, Réglages non compté). */
export const tabsRow = (page: Page, testInfo: TestInfo, visible?: number): Locator =>
  page.getByRole('button', {
    name: visible === undefined ? (isPhone(testInfo) ? /^Onglets : / : /^Onglets visibles : /) : isPhone(testInfo) ? `Onglets : ${visible} visibles` : `Onglets visibles : ${visible} sur 5`,
  });

/** Résumé d'apparence de Réglages après un choix : lignes « Début de semaine » et « Format de l’heure » (iPhone et PC). */
export async function expectAppearanceSummary(page: Page, _testInfo: TestInfo, weekday: string, format: string): Promise<void> {
  const capitalized = weekday.charAt(0).toLocaleUpperCase('fr-FR') + weekday.slice(1);
  await expect(page.getByRole('button', { name: `Début de semaine : ${capitalized}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `Format de l’heure : ${format}` })).toBeVisible();
}

/** Fuseau horaire de Réglages : « Europe/Paris (automatique) » sur iPhone ; sur PC la valeur seule, « Suit celui de Windows » sous l'étiquette. */
export async function expectTimeZone(page: Page, testInfo: TestInfo, zone: string): Promise<void> {
  if (isPhone(testInfo)) {
    await expect(page.getByText(`${zone} (automatique)`)).toBeVisible();
    return;
  }
  await expect(page.getByText(zone, { exact: true })).toBeVisible();
  await expect(page.getByText('Suit celui de Windows')).toBeVisible();
}
