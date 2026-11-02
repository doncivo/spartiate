import { expect, type Page } from '@playwright/test';
import { openApp } from './app';

export type Project = 'pc' | 'iphone';

export const isPhone = (testInfo: { project: { name: string } }): boolean => testInfo.project.name === 'iphone';

/** Ouvre l'app sur Aujourd'hui (première section, neutre jusqu'à I1) : navigation visible, section « Aujourd’hui » courante. */
export async function openToday(page: Page): Promise<void> {
  await openApp(page);
  await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toContainText('Aujourd’hui');
}
