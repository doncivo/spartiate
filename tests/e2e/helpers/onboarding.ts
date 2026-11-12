import { expect, type Page } from '@playwright/test';
import { E2E_DEV_PORT } from '../../sim/ports';

/**
 * I3-07 : l'onboarding s'ouvre tout seul sur une base vide, et toute la suite e2e part d'une base vide. L'accroche de développement
 * `ct.skipOnboarding` (src/features/onboarding/launch.ts, absente d'un build de production) est donc posée par défaut dans le stockage local de
 * l'origine testée ; les specs de l'onboarding la retirent (`test.use({ storageState: NO_STORAGE })`).
 */
export const SKIP_ONBOARDING_KEY = 'ct.skipOnboarding';

export interface StorageState {
  readonly cookies: [];
  readonly origins: { readonly origin: string; readonly localStorage: { readonly name: string; readonly value: string }[] }[];
}

/** État de stockage qui masque le lancement automatique de l'onboarding pour l'origine `http://localhost:<port>`. */
export const skipOnboardingState = (port: number = E2E_DEV_PORT): StorageState => ({
  cookies: [],
  origins: [{ origin: `http://localhost:${String(port)}`, localStorage: [{ name: SKIP_ONBOARDING_KEY, value: '1' }] }],
});

/** Aucun stockage : l'app se comporte comme au premier lancement (l'onboarding s'ouvre sur la base vide). */
export const NO_STORAGE: StorageState = { cookies: [], origins: [] };

/** Titre (h1) de l'écran courant de l'onboarding. */
export const onboardingTitle = (page: Page, title: string) => page.getByRole('heading', { level: 1, name: title, exact: true });

/** Attend le dialogue de l'onboarding sur son premier écran. */
export async function expectOnboardingOpen(page: Page): Promise<void> {
  await expect(page.getByRole('dialog', { name: 'Configuration de Spartiate' })).toBeVisible();
}
