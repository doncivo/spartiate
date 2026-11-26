import { expect, test, type Page } from '@playwright/test';
import { openToday } from './helpers/today';

/**
 * BL-119 (décision d'Ali du 21/11, D-450, D-459) : au zoom Windows de 150 %, le PC garde sa disposition PC (barre latérale, jamais la barre
 * d'onglets de l'iPhone), adaptée à la largeur effective. Écrans de 1 280 × 720, 1 366 × 768 et 1 920 × 1 080 physiques à 150 %, barre des
 * tâches et cadre déduits : contenu de 837 × 393, 895 × 425 et 1 264 × 633 px CSS. Projet `pc` seulement, agent utilisateur Windows
 * (la disposition PC sous 1 024 px vient du système déclaré, comme dans l'app installée).
 */
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const SIZES = [
  { name: '1 280 × 720 à 150 %', width: 837, height: 393 },
  { name: '1 366 × 768 à 150 %', width: 895, height: 425 },
  { name: '1 920 × 1 080 à 150 %', width: 1264, height: 633 },
] as const;
const SECTIONS = ['Aujourd’hui', 'Entraînement', 'Nutrition', 'Progrès', 'Plus'] as const;

test.use({ userAgent: WINDOWS_UA });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pc', 'disposition du PC Windows');
  await page.clock.setFixedTime(new Date('2026-11-18T11:00:00Z'));
});

async function overflow(page: Page): Promise<{ doc: number; main: number }> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const main = document.querySelector<HTMLElement>('.ct-app-shell__main');
    return { doc: root.scrollWidth - root.clientWidth, main: main ? main.scrollWidth - main.clientWidth : -1 };
  });
}

for (const size of SIZES) {
  test(`${size.name} : disposition PC, cinq sections sans débordement horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openToday(page);
    await expect(page.locator('.ct-app-shell')).toHaveAttribute('data-layout', 'pc');
    await expect(page.locator('.ct-tab-rail')).toHaveAttribute('data-layout', 'pc');
    for (const section of SECTIONS) {
      await page.getByRole('navigation').getByRole('button', { name: section, exact: true }).click();
      await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toContainText(section);
      await expect(page.locator('.ct-app-shell')).toHaveAttribute('data-layout', 'pc');
      const o = await overflow(page);
      expect(o.doc, `${section} : document plus large que la fenêtre`).toBeLessThanOrEqual(0);
      expect(o.main, `${section} : zone centrale plus large que sa place`).toBeLessThanOrEqual(1);
    }
  });
}

// BL-136 et C-135 (D-480, SHELL-0294a) : sous 1 100 px la barre latérale se replie en icônes ; sous 1 024 px Progrès › Corps reste en une colonne ;
// les sous-écrans de Plus (Synchronisation, Apparence), ouverts par la palette Ctrl+K, ne débordent pas non plus.
for (const size of SIZES) {
  test(`${size.name} : barre repliée selon la place, Corps en une colonne, sous-écrans sans débordement`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openToday(page);
    await expect(page.locator('.ct-tab-rail')).toHaveAttribute('data-layout', 'pc');
    // Repli en CSS seul (D-596) : pas d'attribut ; on lit la largeur calculée de la barre (64 px repliée, 256 px dépliée) et le libellé masqué.
    const railWidth = await page.locator('nav.ct-tab-rail').evaluate((el) => el.getBoundingClientRect().width);
    const labelWidth = await page.locator('nav.ct-tab-rail .ct-tab-rail__label').first().evaluate((el) => el.getBoundingClientRect().width);
    if (size.width <= 1099) {
      expect(railWidth).toBe(64);
      expect(labelWidth).toBeLessThanOrEqual(1);
    } else {
      expect(railWidth).toBe(256);
      expect(labelWidth).toBeGreaterThan(1);
    }

    await page.getByRole('navigation').getByRole('button', { name: 'Progrès', exact: true }).click();
    // PROG-0301a (BL-177) : Corps est un onglet de Progrès (Mesures par défaut).
    await page.getByRole('tablist', { name: 'Progrès' }).getByRole('tab', { name: 'Corps' }).click();
    const body = page.locator('.ct-bodyprogress').first();
    await expect(body).toBeVisible();
    if (size.width < 1024) expect(await body.evaluate((el) => getComputedStyle(el).display)).toBe('flex');
    expect((await overflow(page)).main, 'Progrès › Corps : zone centrale plus large que sa place').toBeLessThanOrEqual(1);

    for (const [query, name] of [['synchronisation', 'Plus : synchronisation'], ['apparence', 'Plus : apparence']] as const) {
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox', { name: 'Chercher une commande' }).fill(query);
      await page.getByRole('option', { name }).click();
      await expect(page.getByRole('dialog', { name: 'Palette de commandes' })).toHaveCount(0);
      await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toContainText('Plus');
      const o = await overflow(page);
      expect(o.doc, `${name} : document plus large que la fenêtre`).toBeLessThanOrEqual(0);
      expect(o.main, `${name} : zone centrale plus large que sa place`).toBeLessThanOrEqual(1);
    }
  });
}
