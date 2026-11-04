import { expect, test } from '@playwright/test';
import { openApp } from './helpers/app';

/**
 * SPA-009 / D-63 : mesure du démarrage jusqu'à la section « Aujourd'hui » affichée, sur le build de production (projet `perf`,
 * `npm run test:perf:e2e`). Budgets du PRD § 23.1 : PC < 1 500 ms, iPhone < 2 000 ms (le projet `perf` n'a qu'un navigateur de bureau ;
 * la mesure iPhone se refait avec la fenêtre 440 × 956 et le même plafond de 2 s). Jamais rejouée, aucun seuil relâché.
 */
const BUDGET_MS = { pc: 1500, iphone: 2000 } as const;
const VIEWPORTS = { pc: { width: 1440, height: 900 }, iphone: { width: 440, height: 956 } } as const;

for (const kind of ['pc', 'iphone'] as const) {
  test(`@perf démarrage jusqu'à Aujourd'hui, ${kind}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[kind]);
    await openApp(page);
    await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toContainText('Aujourd’hui');
    const elapsed = await page.evaluate(() => Math.round(performance.now()));
    test.info().annotations.push({ type: 'mesure', description: `${String(elapsed)} ms (budget ${String(BUDGET_MS[kind])} ms)` });
    expect(elapsed, `démarrage ${kind}`).toBeLessThan(BUDGET_MS[kind]);
  });
}
