import { expect, test, type Page } from '@playwright/test';
import { APP_READY_TIMEOUT_MS, openApp, waitForScreenLoaded } from './helpers/app';
import { NO_STORAGE, expectOnboardingOpen } from './helpers/onboarding';

/**
 * RESET-01 (D-180 à D-186) : Plus › Données › « Repartir de zéro », sur PC (1 440 px) et iPhone (440 px). Sans stockage préposé : l'onboarding
 * s'ouvre au premier lancement, est fermé, puis doit se rouvrir tout seul après l'effacement (même état qu'une installation neuve). Tourne en CI
 * seulement (pc, iphone, iphone-webkit ; jamais en local sur ce PC).
 */
test.use({ storageState: NO_STORAGE });

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Configuration de Spartiate' });
const tab = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name }).click();

test('confirmation par EFFACER obligatoire, puis effacement et onboarding rouvert', async ({ page }) => {
  await openApp(page);
  await expectOnboardingOpen(page);
  await dialog(page).getByRole('button', { name: 'Fermer la configuration' }).click();
  await expect(dialog(page)).toHaveCount(0);

  await tab(page, 'Plus');
  await page.getByRole('button', { name: /Repartir de zéro/ }).click();
  await waitForScreenLoaded(page, 'resetdatascreen');
  await expect(page.getByRole('heading', { level: 1, name: 'Repartir de zéro' })).toBeVisible();
  await expect(page.getByText('Ce qui est effacé')).toBeVisible();
  await expect(page.getByText('Ce qui est gardé')).toBeVisible();
  await expect(page.getByText(/S’applique à tes deux appareils/)).toBeVisible();
  await expect(page.getByText(/C’est irréversible/)).toBeVisible();

  const submit = page.getByRole('button', { name: 'Tout effacer' });
  const field = page.getByLabel('Pour confirmer, tape EFFACER');
  await expect(submit).toBeDisabled();
  await field.fill('effacer');
  await expect(submit).toBeDisabled();
  await field.fill('EFFACER');
  await expect(submit).toBeEnabled();
  await submit.click();

  // L'app redémarre comme une installation neuve (rechargement : même attente de démarrage que `openApp`) : l'onboarding s'ouvre tout seul.
  await expect(dialog(page)).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  await expect(page.getByText('Configuration · étape 1 sur 8')).toBeVisible();
});
