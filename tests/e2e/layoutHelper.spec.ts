import { expect, test, type Page } from '@playwright/test';
import { expectFitsViewport } from './helpers/layout';
import { installFakeBackups } from './helpers/backups';
import { isPhone, openToday } from './helpers/today';

/**
 * Test négatif de `expectFitsViewport` (revue de la PR #19) : le contrôle doit échouer pour un vrai débordement, dans la coquille de l'app
 * comme dans une feuille (deux conteneurs qui rognent leur contenu), (le cas de la rangée d'icônes désignée `data-scroll-row` est retiré avec le sélecteur d'icônes, SPA-001b).
 */
test.describe('expectFitsViewport : le contrôle de mise en page contrôle vraiment', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo), 'Mesure à 440 × 956.');
    await openToday(page);
  });

  const inject = (page: Page, selector: string): Promise<void> =>
    page.evaluate((target) => {
      const host = document.querySelector(target);
      if (!host) throw new Error(`conteneur ${target} introuvable`);
      const wide = document.createElement('div');
      wide.id = 'ct-test-wide';
      wide.textContent = 'trop large';
      wide.style.cssText = 'width:600px;min-width:600px;flex:none;height:20px;';
      host.appendChild(wide);
    }, selector);

  test('un élément de 600 px dans la coquille fait échouer le contrôle', async ({ page }) => {
    await inject(page, '.ct-app-shell');
    await expect(expectFitsViewport(page, 'coquille')).rejects.toThrow(/ct-test-wide|hors de la largeur|défilement horizontal/);
  });

  test('un élément de 600 px dans une feuille fait échouer le contrôle', async ({ page }) => {
    // Feuille conservée : « Restaurer une sauvegarde » (P-04), versions simulées.
    await installFakeBackups(page, [{ name: 'spartiate-daily-20261007.db', kind: 'daily', stamp: '20261007', size: 40_960, at: '2026-10-07T03:12:00', tasks: 4 }], { directory: null });
    await openToday(page);
    await page.getByRole('navigation').getByRole('button', { name: 'Plus', exact: true }).tap();
    await page.getByRole('button', { name: 'Restaurer une sauvegarde' }).tap();
    await expect(page.getByRole('dialog', { name: 'Restaurer une sauvegarde' })).toBeVisible();
    await inject(page, '.ct-sheet');
    await expect(expectFitsViewport(page, 'feuille')).rejects.toThrow(/hors de la largeur|défilement horizontal/);
  });
});
