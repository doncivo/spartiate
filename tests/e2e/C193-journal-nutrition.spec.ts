import { expect, test, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * C-193 (PRD § 23.1, « journal nutrition ») : recherche d'un aliment du catalogue Ciqual embarqué, quantité et heure saisies au clavier,
 * ajout au journal, provenance affichée, correction de la quantité, grammes invalides refusés. PC (1 440 px) et iPhone (440 px).
 * Données synthétiques : base neuve du navigateur de test, aucune pesée ni cible.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-08T11:00:00Z'));
  await openToday(page);
  await nav(page, 'Nutrition').click();
});

test('journal : recherche, quantité et heure au clavier, ajout, provenance, correction', async ({ page }) => {
  await page.getByRole('button', { name: 'Rechercher un aliment' }).click();
  await page.getByRole('searchbox', { name: 'Nom de l’aliment' }).fill('banane');
  const hit = page.locator('[data-hit]').first();
  await expect(hit).toContainText('Ciqual');
  await hit.click();

  const grams = page.getByLabel('Quantité (g)');
  await expect(grams).toBeVisible();
  await grams.fill('0');
  await expect(page.getByRole('button', { name: 'Ajouter au journal' })).toBeDisabled();
  await grams.fill('120');
  await page.getByLabel('Heure', { exact: true }).fill('08:15');
  await expect(page.getByRole('button', { name: 'Ajouter au journal' })).toBeEnabled();
  await page.getByRole('button', { name: 'Ajouter au journal' }).click();

  const correct = page.getByRole('button', { name: /^Corriger .*banane/i }).first();
  await expect(correct).toBeVisible();
  await expect(page.getByText('08:15').first()).toBeVisible();

  await correct.click();
  await page.getByLabel('Quantité (g)').fill('250');
  await page.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await expect(page.getByRole('button', { name: /^Corriger .*banane/i }).first()).toBeVisible();
  await expect(page.getByText('250 g').first()).toBeVisible();
});

test('aucun résultat : message clair, rien n’est inventé ni ajouté au journal', async ({ page }) => {
  await page.getByRole('button', { name: 'Rechercher un aliment' }).click();
  await page.getByRole('searchbox', { name: 'Nom de l’aliment' }).fill('zzzqqq');
  await expect(page.getByText('Aucun aliment trouvé.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Corriger / })).toHaveCount(0);
});
