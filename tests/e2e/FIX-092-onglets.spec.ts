import { expect, test, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * FIX-092 (0.9.2) : sur le PC, les onglets d'Entraînement (Routines, Bibliothèque, Matériel, Journal, Cycle) étaient écrasés à quelques pixels.
 * Le contrôle segmenté défilant (overflow-x: auto) est un enfant d'une colonne flex : sa hauteur minimale automatique tombe à 0, il rétrécit
 * dès que le contenu est plus haut que la fenêtre (Bibliothèque : 150 exercices). Projets `pc` et `iphone`.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

async function expectTabsUsable(page: Page, names: readonly string[]): Promise<void> {
  // La bande elle-même (radiogroup) garde sa hauteur : un bouton de 44 px rogné par une bande écrasée reste « visible » pour Playwright.
  const strip = await page.locator('.ct-segmented[data-scroll="true"]').first().boundingBox();
  expect(strip?.height ?? 0, 'hauteur de la bande d’onglets').toBeGreaterThanOrEqual(52);
  for (const name of names) {
    const radio = page.getByRole('radio', { name, exact: true });
    await expect(radio).toBeVisible();
    const box = await radio.boundingBox();
    expect(box?.height ?? 0, `onglet « ${name} » : hauteur`).toBeGreaterThanOrEqual(44);
    // Le centre de l'onglet reçoit bien le clic (pas rogné par la bande). Sur 440 px la bande défile : l'onglet est d'abord amené dans la vue.
    await radio.scrollIntoViewIfNeeded();
    const hit = await radio.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === el || el.contains(top);
    });
    expect(hit, `onglet « ${name} » : atteignable au centre`).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-08T11:00:00Z'));
  await openToday(page);
});

test('Entraînement : chaque onglet est visible (≥ 44 px), même avec la Bibliothèque ouverte, et un clic change d’écran', async ({ page }) => {
  const names = ['Routines', 'Bibliothèque', 'Matériel', 'Journal', 'Cycle', 'Cardio'] as const;
  await nav(page, 'Entraînement').click();
  await expectTabsUsable(page, names);
  await page.getByRole('radio', { name: 'Bibliothèque', exact: true }).click();
  await expect(page.getByText('Compatibles avec mon matériel').first()).toBeVisible();
  // Condition de reproduction : le contenu dépasse la coquille (sinon rien ne comprime la bande et le test ne prouverait rien).
  const overflow = await page.locator('.ct-training-shell').evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(overflow, 'Bibliothèque plus haute que la fenêtre').toBe(true);
  await expectTabsUsable(page, names); // contenu long : c'est ici que la bande s'écrasait
  await page.getByRole('radio', { name: 'Cycle', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Cycle', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Compatibles avec mon matériel')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Routines', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Routines', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expectTabsUsable(page, names);
});

test('Nutrition : chaque onglet est visible (≥ 44 px) et un clic change d’écran', async ({ page }) => {
  const names = ['Journal', 'Dashboard', 'Stratégie', 'Check-in', 'Recettes'] as const;
  await nav(page, 'Nutrition').click();
  await expectTabsUsable(page, names);
  await page.getByRole('radio', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expectTabsUsable(page, names);
  await page.getByRole('radio', { name: 'Journal', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Journal', exact: true })).toHaveAttribute('aria-checked', 'true');
});
