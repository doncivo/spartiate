import { expect, test, type Locator, type Page } from '@playwright/test';
import { isPhone, openToday } from './helpers/today';

/**
 * 0.7.1 (retours d'Ali sur l'iPhone en 0.7.0) : mise en page à 440 px. Projet `iphone` seulement (les défauts sont ceux de l'iPhone).
 * Point 1 : la fiche d'ajout d'un aliment ne déborde pas (largeur de défilement du document = largeur visible), marge intérieure des cartes.
 * Point 4 : les onglets d'Entraînement et de Nutrition tiennent sur une seule ligne. Point 5 : filtres de la Bibliothèque compacts.
 */
const tab = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'défauts propres à l’iPhone (440 px)');
  await page.clock.setFixedTime(new Date('2026-11-08T11:00:00Z'));
  await openToday(page);
});

test('Point 1 : fiche d’ajout d’un aliment, rien de plus large que sa carte, marge intérieure, Quantité et Heure côte à côte', async ({ page }) => {
  await tab(page, 'Nutrition').click();
  await page.getByRole('button', { name: 'Rechercher un aliment' }).click();
  await page.getByLabel('Nom de l’aliment').fill('banane');
  await page.locator('[data-hit]').first().click();
  const quantity = page.getByLabel('Quantité (g)');
  await expect(quantity).toBeVisible();

  const report = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const form = document.querySelector<HTMLElement>('form.ct-nutrition__form');
    const panel = form?.getBoundingClientRect();
    const inputs = [...(form?.querySelectorAll<HTMLElement>('input') ?? [])].map((el) => el.getBoundingClientRect());
    const title = form?.querySelector<HTMLElement>('h2')?.getBoundingClientRect();
    return {
      scroll: root.scrollWidth,
      client: root.clientWidth,
      panel: panel ? { left: panel.left, right: panel.right } : null,
      inputs: inputs.map((r) => ({ left: r.left, right: r.right, top: r.top })),
      titleLeft: title?.left ?? -1,
    };
  });
  expect(report.scroll, 'largeur de défilement du document = largeur visible').toBe(report.client);
  expect(report.panel).not.toBeNull();
  const panel = report.panel as { left: number; right: number };
  for (const input of report.inputs) {
    expect(input.right, 'champ dans sa carte').toBeLessThanOrEqual(panel.right + 0.5);
    expect(input.left).toBeGreaterThanOrEqual(panel.left + 8);
  }
  expect(report.titleLeft - panel.left, 'marge intérieure de la carte').toBeGreaterThanOrEqual(8);
  expect(report.inputs.length).toBeGreaterThanOrEqual(2);
  expect(Math.abs((report.inputs[0]?.top ?? 0) - (report.inputs[1]?.top ?? 99)), 'Quantité et Heure sur la même ligne').toBeLessThan(2);
});

test('Point 2 : les boutons de la fiche d’ajout restent atteignables au-dessus de la barre d’onglets', async ({ page }) => {
  await tab(page, 'Nutrition').click();
  await page.getByRole('button', { name: 'Rechercher un aliment' }).click();
  await page.getByLabel('Nom de l’aliment').fill('banane');
  await page.locator('[data-hit]').first().click();
  await page.getByLabel('Quantité (g)').focus();
  const cancel = page.getByRole('button', { name: 'Annuler' });
  await cancel.scrollIntoViewIfNeeded();
  const rail = await page.getByRole('navigation').boundingBox();
  const box = await cancel.boundingBox();
  expect(rail).not.toBeNull();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0), 'bas du bouton au-dessus de la barre d’onglets').toBeLessThanOrEqual((rail?.y ?? 0) + 0.5);
});

/** Écart vertical maximal entre les onglets d'un groupe, lu en une seule évaluation (même image). */
const rowSpread = (group: Locator): Promise<number> =>
  group.getByRole('radio').evaluateAll((els) => {
    const tops = els.map((el) => el.getBoundingClientRect().top);
    return Math.max(...tops) - Math.min(...tops);
  });

test('Point 4 : onglets d’Entraînement et de Nutrition sur une seule ligne, onglet actif visible', async ({ page }) => {
  await tab(page, 'Entraînement').click();
  const names = ['Routines', 'Bibliothèque', 'Matériel', 'Journal', 'Cycle', 'Cardio'];
  // FIX-0115 : les onglets sont lus dans la même image (une seule évaluation) ; une mesure onglet par onglet pouvait croiser un décalage de mise en page (CI du 12/11 : 182 px d'écart) et n'est plus utilisée. Le seuil (< 2 px) est inchangé ; la lecture est refaite jusqu'à la stabilité de la page.
  const trainingGroup = page.getByRole('radiogroup', { name: 'Sections de l’entraînement' });
  for (const name of names) await expect(trainingGroup.getByRole('radio', { name, exact: true })).toBeVisible();
  await expect.poll(() => rowSpread(trainingGroup), 'une seule ligne').toBeLessThan(2);
  // FIX-0115 : des onglets sont cachés à droite à l'ouverture, le fondu le dit ; une fois défilé, il passe à gauche.
  const group = page.getByRole('radiogroup', { name: 'Sections de l’entraînement' });
  await expect(group).toHaveAttribute('data-fade-end', 'true');
  // I6-06 : « Cardio » est désormais le dernier onglet : c'est lui qui, une fois choisi, fait défiler la bande jusqu'au bout.
  await page.getByRole('radio', { name: 'Cardio', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Cardio', exact: true })).toBeInViewport();
  await expect(group).toHaveAttribute('data-fade-start', 'true');
  await expect(group).not.toHaveAttribute('data-fade-end', 'true');

  await tab(page, 'Nutrition').click();
  const nutritionGroup = page.getByRole('radiogroup', { name: 'Sections de Nutrition' });
  for (const name of ['Journal', 'Dashboard', 'Stratégie', 'Check-in']) await expect(nutritionGroup.getByRole('radio', { name, exact: true })).toBeVisible();
  await expect.poll(() => rowSpread(nutritionGroup), 'une seule ligne').toBeLessThan(2);
});

test('Point 5 : filtres de la Bibliothèque compacts, interrupteur visible sans défiler', async ({ page }) => {
  await tab(page, 'Entraînement').click();
  await page.getByRole('radio', { name: 'Bibliothèque', exact: true }).click();
  const search = page.locator('.ct-training__filters > .ct-training__field').first();
  await expect(search).toBeVisible();
  const heights = await page.locator('.ct-training__filters > .ct-training__field').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  for (const height of heights) expect(height, 'un champ prend sa hauteur de contenu').toBeLessThan(90);
  await expect(page.getByText('Compatibles avec mon matériel').first()).toBeInViewport();
});
