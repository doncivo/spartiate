import { expect, test } from '@playwright/test';
import { isPhone, openToday } from './helpers/today';

/**
 * C-193 (PRD § 18.3, « aucune donnée : pas de faux zéro ») : sur une base neuve, Aujourd'hui dit l'absence de données de récupération en
 * texte, sans cadran ni valeur inventée ; sur l'iPhone, l'action mène à Apple Santé. Les autres lignes de § 18.3 sont testées ailleurs
 * (tests/e2e/I-02.spec.ts pour la signature ; voir docs/CI-0292.md pour la correspondance complète). PC (1 440 px) et iPhone (440 px).
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T09:00:00Z'));
  await openToday(page);
});

test('aucune donnée de récupération : texte d’absence, aucun cadran, aucun zéro inventé', async ({ page }, testInfo) => {
  const card = page.getByRole('region', { name: 'Récupération' });
  await expect(card).toBeVisible();
  await expect(card.getByText(isPhone(testInfo) ? 'Aucune donnée de récupération importée pour l’instant.' : 'Aucun résumé de récupération reçu de l’iPhone.')).toBeVisible();
  await expect(card.getByRole('img')).toHaveCount(0);
  await expect(card.getByText('J+0/14')).toHaveCount(0);
});

test('iPhone : « Ouvrir Apple Santé » mène à l’écran Apple Santé', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'L’import Santé est propre à l’iPhone');
  await page.getByRole('region', { name: 'Récupération' }).getByRole('button', { name: 'Ouvrir Apple Santé' }).click();
  await expect(page.getByRole('heading', { name: 'Apple Santé' }).first()).toBeVisible();
});
