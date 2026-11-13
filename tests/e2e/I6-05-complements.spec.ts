import { expect, test, type Page } from '@playwright/test';
import { waitForScreenLoaded } from './helpers/app';
import { openToday } from './helpers/today';

/**
 * I6-05 (§ 15.3) : un complément ajouté dans Nutrition › Compléments apparaît sur Aujourd'hui ; la prise se coche en un tap (cible ≥ 44 px) et le
 * reste quand la carte est relue de la base (retour sur Aujourd’hui). Pas de rechargement de page : hors Tauri, la base SQLite Wasm des e2e
 * est en mémoire (src/db/drivers/sqliteWasm.ts) et repart vide ; la persistance sur disque relève des tests du dépôt et de Rust. Projets `pc` et `iphone` (440 px). Données synthétiques : base neuve du navigateur de test.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T06:00:00Z'));
  await openToday(page);
});

test('complément : ajouté, coché depuis Aujourd’hui en un tap, gardé quand la carte est relue', async ({ page }) => {
  await nav(page, 'Nutrition').click();
  await page.getByRole('radio', { name: 'Compléments', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un complément', exact: true }).click();
  await page.getByLabel('Nom', { exact: true }).fill('Créatine');
  await page.getByLabel('Dose', { exact: true }).fill('5');
  await page.getByLabel('Unité', { exact: true }).fill('g');
  await page.getByLabel('Heure 1', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Créatine' })).toBeVisible();

  await nav(page, 'Aujourd’hui').click();
  await waitForScreenLoaded(page, 'supplementstoday');
  const box = page.getByRole('checkbox', { name: '08:00 · Créatine, 5 g' });
  await expect(box).toHaveAttribute('aria-checked', 'false');
  expect((await box.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1 sur 1 prise')).toBeVisible();

  // Carte démontée puis relue de la base : la prise cochée est gardée.
  await nav(page, 'Nutrition').click();
  await page.getByRole('radio', { name: 'Compléments', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Créatine' })).toBeVisible();
  await nav(page, 'Aujourd’hui').click();
  await expect(page.getByRole('checkbox', { name: '08:00 · Créatine, 5 g' })).toHaveAttribute('aria-checked', 'true');
});
