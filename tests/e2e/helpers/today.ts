import { expect, type Page } from '@playwright/test';
import { openApp } from './app';

export type Project = 'pc' | 'iphone';

export const isPhone = (testInfo: { project: { name: string } }): boolean => testInfo.project.name === 'iphone';

/** Ouvre l'app sur Aujourd'hui (première section) : navigation et titre de l'écran visibles. */
export async function openToday(page: Page): Promise<void> {
  await openApp(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
