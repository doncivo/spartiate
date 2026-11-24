import { expect, test, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * C-193 (PRD § 23.1, « séance complète au clavier ») : séance vide, exercice ajouté, deux séries validées au clavier seul (saisie puis
 * Entrée, jamais un clic sur « Valider la série »), une série laissée non faite, clôture avec confirmation, résumé, séance close dans le
 * journal d'Entraînement. PC (1 440 px) et iPhone (440 px). Données synthétiques : base neuve du navigateur de test.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T17:00:00Z'));
  await openToday(page);
});

test('séance au clavier : exercice ajouté, séries saisies puis Entrée, clôture, résumé et journal', async ({ page }) => {
  await nav(page, 'Entraînement').click();
  await page.getByRole('button', { name: 'Commencer une séance' }).click();
  await page.getByRole('button', { name: 'Séance vide' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Séance libre' })).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter un exercice' }).click();
  const picker = page.getByRole('region', { name: 'Ajouter un exercice à la séance' });
  await picker.getByLabel('Rechercher un exercice').fill('marteau');
  await picker.getByRole('button', { name: /^Curl marteau$/ }).click();
  const exercise = page.getByRole('region', { name: 'Curl marteau' });
  await expect(exercise).toBeVisible();
  await expect(page.getByText('0 / 3 séries validées')).toBeVisible();

  const openSet = () => exercise.getByRole('group', { name: /^Série/ }).filter({ has: page.getByRole('button', { name: 'Valider la série' }) }).first();

  // Série 1 : charge, répétitions, Entrée (virgule décimale comprise).
  const first = openSet();
  await first.getByLabel(/^Charge( par haltère)? \(kg\)$/).fill('17,5');
  await first.getByLabel('Répétitions', { exact: true }).fill('10');
  await first.getByLabel('Répétitions', { exact: true }).press('Enter');
  await expect(page.getByText('1 / 3 séries validées')).toBeVisible();
  await expect(exercise.getByText('17,5 kg × 10')).toBeVisible();

  // Série 2 : même geste, la série suivante devient la série en cours.
  const second = openSet();
  await expect(second.getByText('Série en cours')).toBeVisible();
  await second.getByLabel(/^Charge( par haltère)? \(kg\)$/).fill('17,5');
  await second.getByLabel('Répétitions', { exact: true }).fill('9');
  await second.getByLabel('Répétitions', { exact: true }).press('Enter');
  await expect(page.getByText('2 / 3 séries validées')).toBeVisible();

  // Une saisie incomplète est refusée en texte, sans rien valider.
  const third = openSet();
  await third.getByLabel(/^Charge( par haltère)? \(kg\)$/).fill('17,5');
  await third.getByLabel(/^Charge( par haltère)? \(kg\)$/).press('Enter');
  await expect(third.getByRole('alert')).toBeVisible();
  await expect(page.getByText('2 / 3 séries validées')).toBeVisible();

  // Clôture : la série non validée est dite, « Terminer » ferme la séance et ouvre le résumé.
  await page.getByRole('button', { name: 'Terminer la séance' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Terminer la séance ?' });
  await expect(confirm).toContainText('1 série prévue n’est pas validée');
  await confirm.getByRole('button', { name: 'Terminer', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Résumé de la séance' });
  await expect(summary.getByRole('heading', { level: 2, name: 'Séance libre terminée' })).toBeVisible();
  await expect(summary.locator('.ct-summary__kpi').filter({ has: page.locator('dt', { hasText: /^Séries$/ }) }).locator('dd')).toHaveText('2');
  await expect(summary.locator('.ct-summary__kpi').filter({ has: page.locator('dt', { hasText: /^Volume \(kg\)$/ }) }).locator('dd')).toContainText('332,5');

  // Séance close : l'historique d'Entraînement la liste, « Reprendre la séance » n'est plus proposé.
  await summary.getByRole('button', { name: 'Fermer le résumé' }).click();
  await nav(page, 'Entraînement').click();
  await expect(page.getByRole('button', { name: 'Reprendre la séance' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Journal', exact: true }).click();
  await expect(page.getByText('2 séries').first()).toBeVisible();
  await expect(page.getByText('Aucune séance terminée pour l’instant.')).toHaveCount(0);
});
