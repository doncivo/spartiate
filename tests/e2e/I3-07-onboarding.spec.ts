import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers/app';
import { NO_STORAGE, expectOnboardingOpen, onboardingTitle } from './helpers/onboarding';
import { isPhone } from './helpers/today';

/**
 * I3-07 : onboarding en 8 écrans (PRD § 10.1), sur PC (1 440 px) et iPhone (440 px). Sans stockage préposé : base vide au premier lancement,
 * donc l'onboarding s'ouvre tout seul. Tourne en CI seulement (pc et iphone, jamais en local sur ce PC).
 */
test.use({ storageState: NO_STORAGE });

const TITLES = ['Toi', 'Ton objectif', 'Ton expérience', 'Ton temps', 'Où t’entraînes-tu ?', 'Tes priorités', 'Ta semaine', 'Prêt'] as const;
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Configuration de Spartiate' });
const next = (page: Page) => dialog(page).getByRole('button', { name: 'Continuer', exact: true }).click();
const choose = (page: Page, name: string) => dialog(page).getByRole('radio', { name, exact: true }).click();
const tab = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name }).click();

async function goToStep(page: Page, index: number): Promise<void> {
  for (let i = 0; i < index; i += 1) {
    await expect(onboardingTitle(page, TITLES[i] ?? '')).toBeVisible();
    await next(page);
  }
  await expect(onboardingTitle(page, TITLES[index] ?? '')).toBeVisible();
}

test('premier lancement sur base vide : l’onboarding s’ouvre sur l’écran 1, étape 1 sur 8, le titre a le focus', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  await expect(page.getByText('Étape 1 sur 8', { exact: true })).toBeVisible();
  await expect(onboardingTitle(page, 'Toi')).toBeFocused();
  await expect(dialog(page).getByRole('progressbar', { name: 'Progression de la configuration' })).toHaveAttribute('aria-valuenow', '1');
  await expect(dialog(page).getByRole('button', { name: 'Retour' })).toHaveCount(0);
});

test('parcours des 8 écrans : profil, pesée, routine proposée ajoutée, retour à Aujourd’hui', async ({ page }) => {
  // L'âge de Mifflin vient de l'année courante : date figée, le chiffre attendu ne dépend pas du jour du test.
  await page.clock.setFixedTime(new Date('2026-11-12T10:00:00Z'));
  await openApp(page);
  await expectOnboardingOpen(page);
  // 1. Toi : la dépense de départ (Mifflin-St Jeor) apparaît dès que tout est saisi.
  await choose(page, 'Homme');
  await dialog(page).getByLabel('Année de naissance').fill('1996');
  await dialog(page).getByLabel('Taille (cm)').fill('180');
  await dialog(page).getByLabel('Poids (kg)').fill('80');
  await choose(page, 'Modérément actif');
  await expect(dialog(page).getByText(/Dépense estimée : 2\s?760 kcal par jour/)).toBeVisible();
  await expect(dialog(page).getByText(/point de départ, recalculé après 2 semaines/)).toBeVisible();
  await next(page);
  // 2. Objectif.
  await expect(onboardingTitle(page, 'Ton objectif')).toBeVisible();
  await choose(page, 'Prendre du muscle');
  await choose(page, '+0,25 % par semaine');
  await expect(dialog(page).getByText('Environ 0,2 kg par semaine.')).toBeVisible();
  await next(page);
  // 3. Expérience.
  await expect(onboardingTitle(page, 'Ton expérience')).toBeVisible();
  await choose(page, 'Intermédiaire');
  await next(page);
  // 4. Disponibilité.
  await expect(onboardingTitle(page, 'Ton temps')).toBeVisible();
  await choose(page, '3');
  await choose(page, '60 min');
  await next(page);
  // 5. Matériel : préréglages embarqués, chargés à la demande avec l'écran.
  await expect(onboardingTitle(page, 'Où t’entraînes-tu ?')).toBeVisible();
  await choose(page, 'Salle complète');
  await next(page);
  // 6. Priorités : body map, 2 à prioriser au plus.
  await expect(onboardingTitle(page, 'Tes priorités')).toBeVisible();
  await dialog(page).getByLabel('Pectoraux, normal').click();
  await expect(dialog(page).getByText('Prioriser : 1 sur 2')).toBeVisible();
  await next(page);
  // 7. Split : proposition, aucune routine existante remplacée.
  await expect(onboardingTitle(page, 'Ta semaine')).toBeVisible();
  await expect(dialog(page).getByText('Proposition : Full Body')).toBeVisible();
  await expect(dialog(page).getByText(/aucune routine existante n’est remplacée/)).toBeVisible();
  await next(page);
  // 8. Résultat : première séance et cibles du jour.
  await expect(onboardingTitle(page, 'Prêt')).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: 'Première séance' })).toBeVisible();
  await expect(dialog(page).getByLabel('Dépense de départ (kcal par jour)')).toHaveValue('2760');
  await dialog(page).getByRole('button', { name: 'Commencer', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toContainText('Aujourd’hui');
  // La routine proposée est une routine NOUVELLE dans Entraînement ; le profil est enregistré dans Plus › Profil et poids.
  await tab(page, 'Entraînement');
  await expect(page.getByText('Full Body 3 j').first()).toBeVisible();
  await tab(page, 'Plus');
  await page.getByRole('button', { name: /Profil et poids/ }).click();
  await expect(page.getByLabel('Taille (cm)')).toHaveValue('180');
  await expect(page.getByLabel('Année de naissance')).toHaveValue('1996');
});

test('Passer : les 7 questions peuvent être ignorées, aucun profil ni routine n’est créé', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  for (let i = 0; i < 7; i += 1) {
    await expect(onboardingTitle(page, TITLES[i] ?? '')).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Passer cette étape' }).click();
  }
  await expect(onboardingTitle(page, 'Prêt')).toBeVisible();
  await expect(dialog(page).getByText(/Dépense estimée indisponible/)).toBeVisible();
  await expect(dialog(page).getByText(/Aucune routine ne sera ajoutée/)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Commencer', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await tab(page, 'Plus');
  await page.getByRole('button', { name: /Profil et poids/ }).click();
  await expect(page.getByLabel('Taille (cm)')).toHaveValue('');
});

test('Retour garde les valeurs ; une valeur hors bornes est refusée en français sans changer d’écran', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  await dialog(page).getByLabel('Année de naissance').fill('1900');
  await next(page);
  await expect(dialog(page).getByText(/L’année de naissance doit être comprise entre 1920 et/)).toBeVisible();
  await expect(onboardingTitle(page, 'Toi')).toBeVisible();
  await dialog(page).getByLabel('Année de naissance').fill('1990');
  await dialog(page).getByLabel('Taille (cm)').fill('172');
  await next(page);
  await expect(onboardingTitle(page, 'Ton objectif')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Retour' }).click();
  await expect(dialog(page).getByLabel('Taille (cm)')).toHaveValue('172');
});

test('fermer puis « Revoir mes réglages » : le brouillon est repris là où il était ; ne revient pas tout seul', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  await choose(page, 'Femme');
  await next(page);
  await choose(page, 'Perdre du gras');
  await next(page);
  await expect(onboardingTitle(page, 'Ton expérience')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Fermer la configuration' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await tab(page, 'Plus');
  await page.getByRole('button', { name: /Profil et poids/ }).click();
  await page.getByRole('button', { name: 'Revoir mes réglages' }).click();
  await expect(onboardingTitle(page, 'Ton expérience')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Retour' }).click();
  await expect(dialog(page).getByRole('radio', { name: 'Perdre du gras', exact: true })).toBeChecked();
  await dialog(page).getByRole('button', { name: 'Retour' }).click();
  await expect(dialog(page).getByRole('radio', { name: 'Femme', exact: true })).toBeChecked();
});

test('clavier : Échap ferme, Tab part du titre vers le premier champ, Entrée sur Continuer avance', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  await expect(onboardingTitle(page, 'Toi')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('radio', { name: 'Non renseigné' }).first()).toBeFocused();
  await dialog(page).getByRole('button', { name: 'Continuer', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(onboardingTitle(page, 'Ton objectif')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('priorités au clavier : une pression fait passer le muscle prioritaire puis évité puis normal', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  await goToStep(page, 5);
  const chest = dialog(page).getByRole('button', { name: /^Pectoraux, / });
  await chest.focus();
  await page.keyboard.press('Enter');
  await expect(chest).toHaveAccessibleName('Pectoraux, à prioriser');
  await page.keyboard.press('Enter');
  await expect(chest).toHaveAccessibleName('Pectoraux, à éviter');
  await expect(dialog(page).getByText('Éviter : 1 sur 4')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(chest).toHaveAccessibleName('Pectoraux, normal');
});

test('mise en page : rien ne déborde, cibles tactiles de 44 pt, carte centrée de 640 px au plus sur PC', async ({ page }, testInfo) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  for (let i = 0; i < TITLES.length; i += 1) {
    await expect(onboardingTitle(page, TITLES[i] ?? '')).toBeVisible();
    const report = await page.evaluate(() => {
      const root = document.querySelector('[role="dialog"]');
      const panel = root?.getBoundingClientRect();
      const small = Array.from(root?.querySelectorAll<HTMLElement>('button, input:not([type="checkbox"]), [role="radio"], [role="checkbox"]') ?? [])
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 43.5)
        // Les zones tactiles de la silhouette sont des reflets (aria-hidden) ; la saisie est la liste de boutons.
        .map(({ el }) => `${el.tagName}.${el.className.toString()}`);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, panelWidth: panel?.width ?? 0, small };
    });
    expect(report.scrollWidth, `défilement horizontal à l'écran ${TITLES[i] ?? ''}`).toBeLessThanOrEqual(report.clientWidth);
    expect(report.small, `cibles de moins de 44 pt à l'écran ${TITLES[i] ?? ''}`).toEqual([]);
    if (!isPhone(testInfo)) expect(report.panelWidth).toBeLessThanOrEqual(640);
    if (i < TITLES.length - 1) await next(page);
  }
});
