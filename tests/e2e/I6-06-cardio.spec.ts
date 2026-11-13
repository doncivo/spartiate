import { expect, test, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * I6-06 (D-221 à D-224) : Entraînement › Cardio. Saisie d'une séance au clavier, refus d'un champ fautif dit en texte, historique, carte Cardio de
 * Progrès ; cibles d'au moins 44 px ; dans le navigateur de test (PC comme iPhone 440 px), aucun bouton GPS (pas d'app installée : stub sans GPS).
 * Données synthétiques : base neuve du navigateur de test.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T17:00:00Z'));
  await openToday(page);
});

test('cardio : séance saisie, refus dit en texte, historique et carte de Progrès', async ({ page }) => {
  await nav(page, 'Entraînement').click();
  await page.getByRole('radio', { name: 'Cardio', exact: true }).click();
  const form = page.getByRole('region', { name: 'Nouvelle séance' });
  await expect(form).toBeVisible();
  await expect(page.getByText('Aucune séance de cardio pour l’instant.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Démarrer le suivi GPS' })).toHaveCount(0);

  await form.getByLabel('Durée (min ou h:mm:ss)').fill('abc');
  await form.getByLabel('Ressenti (1 à 10)').selectOption('7');
  const save = form.getByRole('button', { name: 'Enregistrer', exact: true });
  expect((await save.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await save.click();
  await expect(form.getByRole('alert')).toHaveText('Durée illisible : écris des minutes (45) ou h:mm:ss (1:05:00).');

  await form.getByLabel('Type').selectOption('run');
  await form.getByLabel('Heure de début').fill('17:15');
  await form.getByLabel('Durée (min ou h:mm:ss)').fill('45');
  await form.getByLabel('Distance (km, facultative)').fill('7,5');
  await form.getByLabel('Durée (min ou h:mm:ss)').press('Enter');
  await expect(form.getByRole('status')).toHaveText('Séance enregistrée.');
  const history = page.getByRole('region', { name: 'Historique' });
  await expect(history.getByText('45 min · 7,5 km · ressenti 7/10')).toBeVisible();
  const edit = history.getByRole('button', { name: /^Modifier la séance du/ });
  expect((await edit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

  await nav(page, 'Progrès').click();
  const card = page.getByRole('region', { name: 'Cardio' });
  await expect(card.getByText('1 séance · 45 min · 7,5 km')).toBeVisible();
});
