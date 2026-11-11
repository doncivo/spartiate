import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * I6-01 point A (§ 16.7) : la carte « valeurs inhabituelles » n'est JAMAIS une notification (aucun chiffre ni mesure sur l'écran verrouillé) et le
 * journal de facteurs n'en déclenche aucune. Garde de lecture des sources : ni le planificateur (`src/domain/notificationPlan.ts`, `src/features/notifications`, `src/platform/notifications`)
 * ni les textes de notification ne citent les valeurs inhabituelles ou les facteurs.
 */
const ROOT = resolve(import.meta.dirname, '../../..');
const FILES = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

describe('aucune notification des valeurs inhabituelles ni des facteurs', () => {
  it('le planificateur et les textes de notification ne les citent pas', () => {
    const files = [...FILES('src/features/notifications'), ...FILES('src/platform/notifications'), join(ROOT, 'src/domain/notificationPlan.ts'), join(ROOT, 'src/i18n/fr.notifications.ts'), join(ROOT, 'src/i18n/fr.recoveryNotifications.ts')];
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/unusualValues|UnusualValues|recoveryFactor|factorAnalysis|inhabituelles?|FACTOR_CODES/);
    }
  });
});
