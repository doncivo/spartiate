import { expect, test, type Locator, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * GEST-0303 (BL-169, D-653, § 18.1) : les deux gestes iPhone de la séance active, projet `iphone` (Chromium tactile, 440 px).
 * 1. Glisser une série vers la gauche la supprime ; « Annuler » la rend ; un glissé vertical ne supprime rien.
 * 2. Appui long sur un exercice, puis glisser vers le haut : l'exercice change de place (vignettes dans le nouvel ordre).
 * Pointeurs tactiles envoyés à l'élément (`pointerType: 'touch'`), séance vide sur une base neuve, valeurs inventées.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

async function addExercise(page: Page, search: string, name: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter un exercice' }).click();
  const picker = page.getByRole('region', { name: 'Ajouter un exercice à la séance' });
  await picker.getByLabel('Rechercher un exercice').fill(search);
  await picker.getByRole('button', { name }).click();
}

async function touch(target: Locator, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number): Promise<void> {
  await target.dispatchEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true });
}

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'gestes de l’iPhone seulement (D-653)');
  await page.clock.setFixedTime(new Date('2026-11-27T17:00:00Z'));
  await openToday(page);
  await nav(page, 'Entraînement').click();
  await page.getByRole('button', { name: 'Commencer une séance' }).click();
  await page.getByRole('button', { name: 'Séance vide' }).click();
  await addExercise(page, 'marteau', /^Curl marteau$/);
  await addExercise(page, 'rowing', /^Rowing à la barre$/);
  await expect(page.getByRole('region', { name: 'Rowing à la barre' })).toBeVisible();
  await expect(page.locator('.ct-session__active')).toHaveAttribute('data-gestures', 'on');
});

test('glisser une série vers la gauche la supprime, « Annuler » la rend ; un glissé vertical ne supprime rien', async ({ page }) => {
  const curl = page.getByRole('region', { name: 'Curl marteau' });
  const sets = curl.getByRole('group', { name: /^Série/ });
  await expect(sets).toHaveCount(3);
  const row = sets.nth(1);
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  if (box === null) throw new Error('série hors page');
  const y = box.y + 12;
  const x = box.x + box.width - 20;

  // Glissé vertical : défilement, aucune suppression.
  await touch(row, 'pointerdown', x, y);
  await touch(row, 'pointermove', x - 5, y + 60);
  await touch(row, 'pointermove', x - 200, y + 80);
  await touch(row, 'pointerup', x - 200, y + 80);
  await expect(sets).toHaveCount(3);

  // Glissé vers la gauche au-delà du seuil : la série est supprimée, le bandeau propose « Annuler ».
  await touch(row, 'pointerdown', x, y);
  await touch(row, 'pointermove', x - 40, y + 2);
  await touch(row, 'pointermove', x - 160, y + 3);
  await touch(row, 'pointerup', x - 160, y + 3);
  await expect(sets).toHaveCount(2);
  await expect(page.getByText('« Curl marteau, série 2 » supprimée')).toBeVisible();
  await page.locator('.ct-undo-host').getByRole('button', { name: 'Annuler' }).click();
  await expect(sets).toHaveCount(3);
});

test('appui long sur un exercice puis glisser vers le haut : l’exercice change de place', async ({ page }) => {
  const strip = page.getByRole('list', { name: 'Exercices de la séance' });
  await expect(strip.getByRole('button').first()).toHaveText('1. Curl marteau');
  const curlBox = await page.getByRole('region', { name: 'Curl marteau' }).boundingBox();
  const title = page.getByRole('heading', { level: 3, name: 'Rowing à la barre' });
  const titleBox = await title.boundingBox();
  if (curlBox === null || titleBox === null) throw new Error('exercice hors page');
  const x = titleBox.x + 10;
  await touch(title, 'pointerdown', x, titleBox.y + 5);
  await expect(page.getByText('« Rowing à la barre » soulevé', { exact: false })).toBeVisible();
  await touch(title, 'pointermove', x, curlBox.y + curlBox.height / 2);
  await touch(title, 'pointermove', x, curlBox.y + 5);
  await touch(title, 'pointerup', x, curlBox.y + 5);
  await expect(page.getByText('« Rowing à la barre » en position 1 sur 2.')).toBeVisible();
  await expect(strip.getByRole('button').first()).toHaveText('1. Rowing à la barre');
});
