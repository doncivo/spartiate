import { expect, test, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * I6-03b (§ 13.8, § 18.6) : dans l'éditeur de routine, « Grouper en circuit » forme un superset annoncé en texte, au clavier comme au toucher, avec des
 * cibles d'au moins 44 px ; la routine s'enregistre. Projets `pc` et `iphone` (440 px). Données synthétiques : base neuve du navigateur de test.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

async function addExercise(page: Page, search: string, name: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter un exercice', exact: true }).first().click();
  await page.getByLabel('Rechercher un exercice').fill(search);
  await page.getByRole('button', { name }).first().click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-12T17:00:00Z'));
  await openToday(page);
});

test('routine : superset créé dans l’éditeur, dit en texte, cibles ≥ 44 px, enregistré', async ({ page }) => {
  await nav(page, 'Entraînement').click();
  await page.getByRole('radio', { name: 'Routines', exact: true }).click();
  await page.getByRole('button', { name: 'Nouvelle routine', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Modifier la routine' })).toBeVisible();
  await addExercise(page, 'développé couché à la barre', /^Développé couché à la barre/);
  await addExercise(page, 'rowing à la barre', /^Rowing à la barre/);
  const group = page.getByRole('button', { name: 'Grouper en circuit', exact: true });
  await group.focus();
  await page.keyboard.press('Enter');
  const form = page.getByRole('region', { name: 'Superset, triset ou circuit' });
  await expect(form).toBeVisible();
  await form.getByRole('checkbox', { name: 'Développé couché à la barre' }).check();
  await form.getByRole('checkbox', { name: 'Rowing à la barre' }).check();
  const create = form.getByRole('button', { name: 'Créer le groupe', exact: true });
  expect((await create.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await create.click();
  const header = page.getByRole('region', { name: 'Groupe : Superset' });
  await expect(header).toBeVisible();
  await expect(header.getByText('Superset · 2 exercices · 3 tours')).toBeVisible();
  const ungroup = header.getByRole('button', { name: 'Défaire le groupe', exact: true });
  expect((await ungroup.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Enregistrer la routine', exact: true }).click();
  await expect(page.getByText('Routine enregistrée')).toBeVisible();
});
