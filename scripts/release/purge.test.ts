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

// Lot (d) Rust : calendriers, capture rapide, mini-fenêtre Focus et raccourci global retirés (D-64, inventaire § Lots périphériques).
describe('lot (d) : Rust calendriers, capture, focus, raccourci', () => {
  const gone = [
    'src-tauri/src/calendars', 'src-tauri/src/capture.rs', 'src-tauri/src/focus_window.rs', 'src-tauri/src/shortcut.rs',
    'src-tauri/tests/desktop/calendars.rs', 'src-tauri/tests/desktop/capture.rs', 'src-tauri/tests/desktop/focus.rs',
    'src-tauri/tests/desktop/shortcut.rs', 'src-tauri/tests/desktop/web_auth.rs', 'src-tauri/tests/desktop/web_auth_qa.rs', 'src-tauri/tests/desktop/support/fake_web_auth.rs',
    'src-tauri/capabilities/calendars.json', 'src-tauri/capabilities/capture.json',
    'src-tauri/capabilities/focus.json', 'src-tauri/capabilities/focus-launcher.json',
    'src/platform/calendars', 'src/platform/capture', 'src/platform/focus',
  ];
  for (const path of gone) {
    it(`${path} n'existe plus`, () => {
      expect(present(path)).toBe(false);
    });
  }
  it('lib.rs, desktop.rs et ios_setup.rs ne déclarent ni n’enregistrent plus ces modules', () => {
    const rust = ['lib.rs', 'desktop.rs', 'ios_setup.rs'].map((f) => read(`src-tauri/src/${f}`)).join('\n');
    expect(rust).not.toMatch(/calendars|calendar_|capture::|pub mod capture|focus_window|shortcut::|pub mod shortcut|quick_capture/);
  });
  it('build.rs ne déclare plus les commandes retirées ni les secrets CT_GOOGLE_*', () => {
    expect(read('src-tauri/build.rs')).not.toMatch(/calendar_|quick_capture|focus_window|CT_GOOGLE|capture_setup_error/);
  });
  it('Cargo.toml ne tire plus le raccourci global ni le client HTTP des agendas', () => {
    const cargo = read('src-tauri/Cargo.toml');
    expect(cargo).not.toMatch(/global-shortcut|reqwest|CT_GOOGLE/);
  });
  it('les capabilities de bureau ne citent plus de permission retirée', () => {
    expect(read('src-tauri/capabilities/desktop.json')).not.toMatch(/quick-capture|capture-setup-error|global-shortcut/);
  });
  it('import / export : l’entrée CSV est neutralisée jusqu’à SPA-005, le transport générique reste', () => {
    const imp = read('src-tauri/src/import.rs');
    expect(imp).not.toMatch(/IMPORT_EXTENSIONS|read_import_file|DialogExt/);
    expect(imp).toMatch(/unsupported/);
    expect(present('src-tauri/src/export_common.rs')).toBe(true);
    expect(read('src-tauri/src/lib.rs')).toMatch(/export::export_save_file/);
  });
  it('la façade TypeScript de bureau ne porte plus de raccourci global de capture', () => {
    const desktop = read('src/platform/desktop/types.ts');
    expect(desktop).not.toMatch(/GlobalShortcuts|QuickCapture/);
  });
});
