import { expect, test } from '@playwright/test';
import { openApp } from './helpers/app';
import { START_RUNS, medianMs } from './helpers/perfStart';

/**
 * SPA-009 / D-63 : mesure du démarrage jusqu'à la section « Aujourd'hui » affichée, sur le build de production (projet `perf`,
 * `npm run test:perf:e2e`). Budgets du PRD § 23.1 : PC < 1 500 ms, iPhone < 2 000 ms (le projet `perf` n'a qu'un navigateur de bureau ;
 * la mesure iPhone se refait avec la fenêtre 440 × 956 et le même plafond de 2 s). Aucun seuil relâché.
 *
 * SHELL-0294e (BL-137, BL-167, D-614) : une mesure unique mêlait le bruit du runner (premier chargement du navigateur et du serveur,
 * 1 512, 1 576, 1 683 et 2 183 ms vus sur des runs sans changement du départ) à la dérive réelle. Chaque cas charge l'app dans un contexte neuf
 * (base vide : la migration du premier lancement reste mesurée), un premier chargement est jeté (préchauffage), puis le budget juge la
 * MÉDIANE de START_RUNS chargements : un chargement isolé lent ne fait plus échouer, une dérive réelle (la médiane) échoue toujours.
 */
const BUDGET_MS = { pc: 1500, iphone: 2000 } as const;
const VIEWPORTS = { pc: { width: 1440, height: 900 }, iphone: { width: 440, height: 956 } } as const;

for (const kind of ['pc', 'iphone'] as const) {
  test(`@perf démarrage jusqu'à Aujourd'hui, ${kind}`, async ({ browser, baseURL }) => {
    const storageState = test.info().project.use.storageState;
    const loadOnce = async (): Promise<number> => {
      const context = await browser.newContext({ viewport: VIEWPORTS[kind], ...(baseURL === undefined ? {} : { baseURL }), ...(storageState === undefined ? {} : { storageState }) });
      try {
        const page = await context.newPage();
        await openApp(page);
        await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toContainText('Aujourd’hui');
        return await page.evaluate(() => Math.round(performance.now()));
      } finally {
        await context.close();
      }
    };
    const discarded = await loadOnce(); // premier chargement jeté : préchauffage du navigateur et du serveur
    const runs: number[] = [];
    for (let i = 0; i < START_RUNS; i += 1) runs.push(await loadOnce());
    const median = medianMs(runs);
    test.info().annotations.push({ type: 'mesure', description: `médiane ${String(median)} ms de [${runs.join(', ')}] (jeté : ${String(discarded)}), budget ${String(BUDGET_MS[kind])} ms` });
    expect(median, `démarrage ${kind}`).toBeLessThan(BUDGET_MS[kind]);
    // Relecture à froid : le chargement jeté reste borné (double du budget), un démarrage à froid très dégradé ne passe pas en silence.
    expect(discarded, `premier chargement ${kind}`).toBeLessThan(2 * BUDGET_MS[kind]);
  });
}
