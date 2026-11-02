// SPA-001b, lot composition + (a) features métier (D-44, D-62) : la purge se prouve par l'état du dépôt, pas par un compte de fichiers.
// Ce fichier grossit lot après lot (un bloc par lot, rouge avant le code).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const present = (path: string): boolean => existsSync(resolve(root, path));

describe('lot (a) : features métier retirées', () => {
  const removed = ['calendars', 'capture', 'checklists', 'events', 'focus', 'goals', 'reminders', 'routines', 'search', 'someday', 'spaces', 'stats', 'tasks', 'today', 'week'];
  for (const name of removed) {
    it(`src/features/${name} n'existe plus`, () => {
      expect(present(`src/features/${name}`)).toBe(false);
    });
  }
  it('les features conservées sont toujours là (D-62)', () => {
    for (const name of ['app', 'settings', 'sync', 'security', 'shortcuts', 'updater']) expect(present(`src/features/${name}`)).toBe(true);
  });
  it("l’avis d’expiration de signature est déplacé dans src/features/signing et découplé du planificateur de rappels (décision d’Ali du 2026-11-02)", () => {
    for (const name of ['signingNotice.ts', 'signingStatus.ts', 'signingText.ts', 'SigningAbout.tsx', 'signingNotice.test.ts', 'signingNoticeQa.test.ts']) {
      expect(present(`src/features/signing/${name}`), name).toBe(true);
    }
    expect(read('src/features/signing/signingNotice.ts')).not.toMatch(/replanNotifications|ReplanTrigger|reminders\//);
    // Condition d’Ali : la notification système d’expiration reste planifiée par l’infrastructure conservée.
    expect(read('src/features/signing/signingNotice.ts')).toMatch(/platform\/notifications/);
  });
});

describe('point de composition minimal', () => {
  it('la navigation a les cinq sections du PRD § 18.2', () => {
    const nav = read('src/features/app/navigation.ts');
    expect(nav).toMatch(/TAB_IDS = \['today', 'training', 'nutrition', 'progress', 'more'\] as const/);
    expect(nav).not.toMatch(/'routines'|'checklists'|'events'|'week'|'tasks'/);
  });
  it('le conteneur ne porte plus de port métier', () => {
    const container = read('src/features/app/container.ts');
    for (const word of ['calendars', 'reminders', 'focusWindow', 'focusEndScheduler', 'soundPlayer', 'taskEntities', 'notificationLedger', 'notificationActions']) {
      expect(container, word).not.toContain(word);
    }
  });
  it('bootstrap ne compose plus de calendriers ni de rappels', () => {
    const boot = read('src/features/app/bootstrap.ts');
    for (const word of ['developmentCalendarSetup', 'openCalendarPlatform', 'openRemindersPlatform', 'openFocusWindowPlatform']) {
      expect(boot, word).not.toContain(word);
    }
  });
  it('main.tsx ne monte plus de fenêtre Focus ni de capture', () => {
    expect(read('src/main.tsx')).not.toMatch(/FocusWindowRoot|captureMain/);
    expect(present('src/captureMain.tsx')).toBe(false);
  });
  it('App.tsx ne référence plus aucune feature retirée', () => {
    expect(read('src/App.tsx')).not.toMatch(/features\/(calendars|capture|checklists|events|focus|goals|reminders|routines|search|someday|spaces|stats|tasks|today|week)/);
  });
});
