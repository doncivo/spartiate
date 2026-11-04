import { test, type Browser, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openToday } from '../e2e/helpers/today';

/**
 * Comparaison visuelle manuelle (npm run visual) : capture l'app et la maquette correspondante à la même taille. Aucune comparaison
 * au pixel : les paires sont écrites dans test-results/visual/ pour revue humaine.
 * SPA-001b : les scènes de l'ancien projet (tâches, semaine, routines, agendas, focus, recherche, scan) sont retirées avec leurs
 * fonctions ; les scènes des nouvelles sections arrivent avec SPA-009 (maquettes de docs/maquettes/).
 */
const OUT = resolve('test-results/visual');
const MOCKUPS = resolve('docs/maquettes');
const PHONE = { width: 440, height: 956 };
const PC = { width: 1440, height: 900 };
const WEDNESDAY = new Date('2026-09-23T08:00:00Z'); // 10:00 à Paris

mkdirSync(OUT, { recursive: true });

async function captureMockup(browser: Browser, viewport: { width: number; height: number }, file: string, name: string, dark = false): Promise<void> {
  // Contexte non mobile : une page statique sans balise viewport serait sinon réduite à 980 px de large.
  const context = await browser.newContext({ viewport, locale: 'fr-FR', colorScheme: dark ? 'dark' : 'light' });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve(MOCKUPS, file)).href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, `${name}-maquette.png`) });
  await context.close();
}

async function captureApp(page: Page, name: string, element?: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const path = resolve(OUT, `${name}-app.png`);
  if (element) await page.locator(element).screenshot({ path });
  else await page.screenshot({ path });
}

interface Screen {
  readonly name: string;
  readonly mockup?: string;
  readonly viewport: { width: number; height: number };
  readonly date: Date;
  readonly dark?: boolean;
  readonly element?: string;
  readonly prepare?: (page: Page, testInfo: { project: { name: string } }) => Promise<void>;
}

/** Va sur une section par la navigation (barre basse sur iPhone, barre latérale sur PC). */
const goTab = (name: string) => async (page: Page): Promise<void> => {
  await page.getByRole('navigation').getByRole('button', { name }).click();
};
/** Applique réellement le thème clair par Plus › Apparence (le thème vient du réglage de l'app, pas du système), puis revient à Aujourd'hui. */
const goLight = async (page: Page): Promise<void> => {
  await goTab('Plus')(page);
  await page.getByRole('button', { name: /Thème/ }).first().click();
  await page.getByRole('radio', { name: 'Clair' }).click();
  await page.waitForFunction(() => document.documentElement.dataset['theme'] === 'light');
  await goTab('Aujourd’hui')(page);
};
/** Plus › Profil et poids. */
const goBody = async (page: Page): Promise<void> => {
  await goTab('Plus')(page);
  await page.getByRole('button', { name: /Profil et poids/ }).click();
  await page.getByRole('heading', { name: 'Profil et poids' }).waitFor();
};

// SPA-009 critère 7 : paires app / maquette aux mêmes dimensions (440 × 956 et 1 440 × 900), relues par un humain. Sans maquette (états I0
// qui n'en ont pas), seule la capture de l'app est écrite : le choix est consigné dans la fiche du ticket (motifs Plus / Réglages).
const SCREENS: Screen[] = [
  { name: 'Aujourdhui', mockup: 'iPhone-Aujourdhui.html', viewport: PHONE, date: WEDNESDAY, dark: true },
  { name: 'PC-Aujourdhui', mockup: 'PC-Aujourdhui.html', viewport: PC, date: WEDNESDAY, dark: true },
  { name: 'Entrainement-indisponible', viewport: PHONE, date: WEDNESDAY, dark: true, prepare: goTab('Entraînement') },
  { name: 'PC-Entrainement-indisponible', viewport: PC, date: WEDNESDAY, dark: true, prepare: goTab('Entraînement') },
  { name: 'Plus', viewport: PHONE, date: WEDNESDAY, dark: true, prepare: goTab('Plus') },
  { name: 'PC-Plus', viewport: PC, date: WEDNESDAY, dark: true, prepare: goTab('Plus') },
  { name: 'Profil-poids', viewport: PHONE, date: WEDNESDAY, dark: true, prepare: goBody },
  { name: 'PC-Profil-poids', viewport: PC, date: WEDNESDAY, dark: true, prepare: goBody },
  { name: 'Aujourdhui-clair', viewport: PHONE, date: WEDNESDAY, dark: false, prepare: goLight },
  { name: 'PC-Aujourdhui-clair', viewport: PC, date: WEDNESDAY, dark: false, prepare: goLight },
];

for (const screen of SCREENS) {
  test(`capture ${screen.name}`, async ({ browser }) => {
    const phone = screen.viewport === PHONE;
    const context = await browser.newContext({
      viewport: screen.viewport,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      colorScheme: screen.dark ? 'dark' : 'light',
      ...(phone ? { deviceScaleFactor: 1, isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(screen.date);
    await openToday(page);
    await screen.prepare?.(page, { project: { name: phone ? 'iphone' : 'pc' } });
    await captureApp(page, screen.name, screen.element);
    if (screen.mockup) await captureMockup(browser, screen.viewport, screen.mockup, screen.name, screen.dark);
    await context.close();
  });
}
