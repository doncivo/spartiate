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
/** 0.7.1 : dimanche 8 novembre 2026 (le cas d'Ali : 3 pesées, check-in le lundi), pesées posées dans la base en mémoire du navigateur de test. */
const SUNDAY = new Date('2026-11-08T11:00:00Z');
const seedWeights = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const stamp = '2026-11-08T10:00:00.000Z';
    for (const [date, kg] of [['2026-11-03', 105.0], ['2026-11-05', 104.5], ['2026-11-06', 104.0]] as const) {
      await window.__ctTest?.execute(
        "INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, 'manual', 'Europe/Paris', ?, ?, '0f8fad5b-d9cb-469f-a165-70867728950e', ?)",
        [`weight|${date}|manual`, date, kg, stamp, stamp, '001794218400000-0000-0f8fad5b-d9cb-469f-a165-70867728950e'],
      );
    }
  });
};
const goNutrition = (section?: string) => async (page: Page): Promise<void> => {
  await seedWeights(page);
  await goTab('Nutrition')(page);
  if (section) await page.getByRole('radio', { name: section, exact: true }).click();
};
const goTraining = (section?: string) => async (page: Page): Promise<void> => {
  await goTab('Entraînement')(page);
  if (section) await page.getByRole('radio', { name: section, exact: true }).click();
};
const openAddSheet = async (page: Page): Promise<void> => {
  await goNutrition()(page);
  await page.getByRole('button', { name: 'Rechercher un aliment' }).click();
  await page.getByLabel('Nom de l’aliment').fill('banane');
  await page.locator('[data-hit]').first().click();
  await page.getByLabel('Quantité (g)').waitFor();
};

const SCREENS: Screen[] = [
  { name: 'Aujourdhui', mockup: 'iPhone-Aujourdhui.html', viewport: PHONE, date: WEDNESDAY, dark: true },
  { name: 'PC-Aujourdhui', mockup: 'PC-Aujourdhui.html', viewport: PC, date: WEDNESDAY, dark: true },
  { name: 'Entrainement-indisponible', viewport: PHONE, date: WEDNESDAY, dark: true, prepare: goTab('Entraînement') },
  { name: 'PC-Entrainement-indisponible', viewport: PC, date: WEDNESDAY, dark: true, prepare: goTab('Entraînement') },
  { name: 'Plus', viewport: PHONE, date: WEDNESDAY, dark: true, prepare: goTab('Plus') },
  { name: 'PC-Plus', viewport: PC, date: WEDNESDAY, dark: true, prepare: goTab('Plus') },
  { name: 'Profil-poids', viewport: PHONE, date: WEDNESDAY, dark: true, prepare: goBody },
  { name: 'PC-Profil-poids', viewport: PC, date: WEDNESDAY, dark: true, prepare: goBody },
  { name: 'Aujourdhui-0-7-1', viewport: PHONE, date: SUNDAY, dark: true, prepare: seedWeights },
  { name: 'Entrainement-routines', viewport: PHONE, date: SUNDAY, dark: true, prepare: goTraining() },
  { name: 'Entrainement-bibliotheque', viewport: PHONE, date: SUNDAY, dark: true, prepare: goTraining('Bibliothèque') },
  { name: 'Nutrition-journal-fiche', viewport: PHONE, date: SUNDAY, dark: true, prepare: openAddSheet },
  { name: 'Nutrition-dashboard', viewport: PHONE, date: SUNDAY, dark: true, prepare: goNutrition('Dashboard') },
  { name: 'Nutrition-checkin', viewport: PHONE, date: SUNDAY, dark: true, prepare: goNutrition('Check-in') },
  { name: 'PC-Entrainement-bibliotheque', viewport: PC, date: SUNDAY, dark: true, prepare: goTraining('Bibliothèque') },
  { name: 'PC-Entrainement-bibliotheque-clair', viewport: PC, date: SUNDAY, dark: false, prepare: async (page) => { await goLight(page); await goTraining('Bibliothèque')(page); } },
  { name: 'PC-Nutrition-journal-clair', viewport: PC, date: SUNDAY, dark: false, prepare: async (page) => { await goLight(page); await goNutrition()(page); } },
  { name: 'Aujourdhui-clair', viewport: PHONE, date: WEDNESDAY, dark: false, prepare: goLight },
  { name: 'PC-Aujourdhui-clair', viewport: PC, date: WEDNESDAY, dark: false, prepare: goLight },
];

/**
 * I3-07 : les 8 écrans de l'onboarding (Plus › Profil et poids › Revoir mes réglages), à 440 × 956 et 1 440 × 900. Seule la planche
 * iPhone-Onboarding.html (écran 6, Priorités) existe : les autres écrans suivent son gabarit (consigné dans docs/I3-07.md et D-110).
 */
const ONBOARDING_STEPS = ['toi', 'objectif', 'experience', 'disponibilite', 'materiel', 'priorites', 'split', 'resultat'] as const;
const goOnboarding = (step: number) => async (page: Page): Promise<void> => {
  await goBody(page);
  await page.getByRole('button', { name: 'Revoir mes réglages' }).click();
  await page.getByRole('dialog', { name: 'Configuration de Spartiate' }).waitFor();
  for (let i = 1; i < step; i += 1) {
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.getByText(`Étape ${String(i + 1)} sur 8`, { exact: true }).waitFor();
  }
  if (step === 6) {
    await page.getByLabel('Pectoraux, normal').click();
    await page.getByLabel('Dos, normal').click();
    // Deux priorités atteintes : le troisième toucher range le muscle directement parmi ceux à éviter.
    await page.getByLabel('Mollets, normal').click();
    await page.getByLabel('Mollets, à éviter').waitFor();
  }
};
ONBOARDING_STEPS.forEach((name, i) => {
  SCREENS.push(
    { name: `Onboarding-${String(i + 1)}-${name}`, viewport: PHONE, date: WEDNESDAY, dark: true, ...(i === 5 ? { mockup: 'iPhone-Onboarding.html' } : {}), prepare: goOnboarding(i + 1) },
    { name: `PC-Onboarding-${String(i + 1)}-${name}`, viewport: PC, date: WEDNESDAY, dark: true, prepare: goOnboarding(i + 1) },
  );
});

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

// 0.1.3 (i) et (j), vus sur l'iPhone réel : à 440 × 956, rien ne dépasse la colonne (marge de 20 px à gauche et à droite) et la flèche de
// retour ne chevauche pas la barre d'état. Vérifié par la géométrie des éléments, en plus de la capture « Profil-poids ».
test('géométrie Profil et poids 440 × 956 : cartes dans la colonne, flèche sous la barre d’état', async ({ browser }) => {
  const context = await browser.newContext({ viewport: PHONE, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'dark', deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.setFixedTime(WEDNESDAY);
  await openToday(page);
  await goBody(page);
  await page.waitForTimeout(400);
  const geometry = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('.ct-body__card, .ct-body__card *')).map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className.toString().slice(0, 40), left: r.left, right: r.right, width: r.width };
    });
    const cards = Array.from(document.querySelectorAll('.ct-body__card')).map((el) => el.getBoundingClientRect());
    const back = document.querySelector('.ct-body__back')?.getBoundingClientRect();
    return { boxes, cards, backTop: back?.top ?? -1, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
  });
  const errors: string[] = [];
  if (geometry.cards.length === 0) errors.push('aucune carte');
  for (const card of geometry.cards) {
    if (card.left < 19.5) errors.push(`carte trop à gauche : ${card.left}`);
    if (card.right > PHONE.width - 19.5) errors.push(`carte déborde à droite : ${card.right}`);
  }
  for (const box of geometry.boxes) if (box.right > PHONE.width - 19.5 + 0.5) errors.push(`élément ${box.cls} dépasse : ${box.right}`);
  if (geometry.scrollWidth > geometry.clientWidth) errors.push(`défilement horizontal : ${geometry.scrollWidth} > ${geometry.clientWidth}`);
  if (geometry.backTop < 47) errors.push(`flèche dans la barre d'état : ${geometry.backTop}`);
  await captureApp(page, 'Profil-poids-geometrie');
  await context.close();
  if (errors.length > 0) throw new Error(errors.join(' ; '));
});
