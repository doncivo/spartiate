import { expect, test } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * C-193 (PRD § 18.3, « aucune donnée : pas de faux zéro ») : sur une base neuve, Aujourd'hui dit l'absence de données de récupération en
 * texte, sans cadran ni valeur inventée. Les deux projets (pc, iphone) tournent dans Chromium sans agent iPhone : l'app y détecte un
 * autre système que iOS et affiche le texte « résumé jamais reçu » (RecoveryToday.tsx) ; les textes de l'iPhone réel et l'action
 * du bouton d'import Santé sont couverts par src/features/recovery/RecoveryToday.test.tsx. Les autres lignes de § 18.3 sont testées
 * ailleurs (tests/e2e/I-02.spec.ts pour la signature ; voir docs/CI-0292.md). PC (1 440 px) et iPhone (440 px).
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T09:00:00Z'));
  await openToday(page);
});

test('aucune donnée de récupération : texte d’absence, aucun cadran, aucun zéro inventé', async ({ page }) => {
  const card = page.getByRole('region', { name: 'Récupération' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Aucun résumé de récupération reçu de l’iPhone.')).toBeVisible();
  await expect(card.getByText('L’iPhone calcule la récupération depuis ses imports Raccourcis et la publie ici par la synchro.')).toBeVisible();
  await expect(card.getByRole('img')).toHaveCount(0);
});
