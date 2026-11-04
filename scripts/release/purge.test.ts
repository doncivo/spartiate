// SPA-001b, lot composition + (a) features métier (D-44, D-62) : la purge se prouve par l'état du dépôt, pas par un compte de fichiers.
// Ce fichier grossit lot après lot (un bloc par lot, rouge avant le code).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  it('import / export : l’entrée CSV de l’ancien projet n’existe plus ; SPA-005 la remplace par l’archive zip Spartiate, le transport générique reste', () => {
    const imp = read('src-tauri/src/import.rs');
    // SPA-005 lève la neutralisation de SPA-001b : lecture du seul fichier choisi, extension .zip uniquement, plus aucun CSV / TXT / TSV.
    expect(imp).toMatch(/IMPORT_EXTENSIONS: \[&str; 1\] = \["zip"\]/);
    expect(imp).toMatch(/read_import_file|DialogExt/);
    expect(imp).not.toMatch(/"csv"|"txt"|"tsv"|unsupported/);
    expect(present('src-tauri/src/export_common.rs')).toBe(true);
    expect(read('src-tauri/src/lib.rs')).toMatch(/export::export_save_file/);
  });
  it('la façade TypeScript de bureau ne porte plus de raccourci global de capture', () => {
    const desktop = read('src/platform/desktop/types.ts');
    expect(desktop).not.toMatch(/GlobalShortcuts|QuickCapture/);
  });
});

// Lot (e) plugins reminders et web-auth (D-64) : dossiers, inscriptions, capability, plist, contrats et façade TypeScript.
describe('lot (e) : plugins reminders et web-auth retirés', () => {
  for (const path of ['src-tauri/plugins/reminders', 'src-tauri/plugins/web-auth', 'src-tauri/capabilities/reminders-ios.json', 'src/platform/reminders', 'tests/fixtures/calendars']) {
    it(`${path} n'existe plus`, () => {
      expect(present(path)).toBe(false);
    });
  }
  it('Cargo.toml, lib.rs et le plist ne citent plus ces plugins', () => {
    expect(read('src-tauri/Cargo.toml')).not.toMatch(/tauri-plugin-(reminders|web-auth)/);
    expect(read('src-tauri/src/lib.rs')).not.toMatch(/tauri_plugin_(reminders|web_auth)/);
    expect(read('src-tauri/Info.ios.plist')).not.toMatch(/NSRemindersFullAccessUsageDescription/);
    expect(read('src-tauri/Cargo.lock')).not.toMatch(/name = "tauri-plugin-(reminders|web-auth)"/);
  });
  it('le contrat de plist, le workflow iOS et le README des plugins ne les citent plus', () => {
    expect(read('scripts/ios/plist-contract.json')).not.toMatch(/reminders|NSRemindersFullAccess/i);
    expect(read('.github/workflows/build-ios.yml')).not.toMatch(/tauri-plugin-(reminders|web-auth)/);
    expect(read('src-tauri/plugins/README.md')).not.toMatch(/reminders|web-auth/);
  });
  it('les plugins conservés sont toujours là', () => {
    for (const name of ['files', 'folder-bookmark', 'haptics', 'notification-actions', 'privacy-shield', 'speech', 'vision']) expect(present(`src-tauri/plugins/${name}`), name).toBe(true);
  });
});

// Lot (f) workflows (D-64) : plus de CT_GOOGLE_*, tests.yml sans double exécution, fmt et clippy en CI.
describe('lot (f) : workflows', () => {
  const tests = read('.github/workflows/tests.yml');
  it('plus aucun secret ni variable CT_GOOGLE_* dans les workflows', () => {
    for (const f of ['tests.yml', 'build-windows.yml', 'build-ios.yml']) expect(read(`.github/workflows/${f}`), f).not.toContain('CT_GOOGLE');
  });
  it('tests.yml ne se déclenche que sur pull_request et sur push vers main (D-64)', () => {
    const on = tests.slice(tests.indexOf('\non:'), tests.indexOf('\npermissions:'));
    expect(on).toMatch(/pull_request:/);
    expect(on).toMatch(/push:\s*\n\s*branches: \["main"\]/);
    expect(on).not.toContain('"**"');
  });
  it('la CI Rust exécute cargo clippy --locked -- -D warnings', () => {
    // `cargo fmt --check` : non branché, ~2 500 écarts hérités dont src/sync (journal des écarts de l'inventaire) ; PR de formatage à part.
    expect(tests).toContain('cargo clippy --locked -- -D warnings');
  });
});

// Lot (g) i18n français seul (D-64, inventaire § Lots périphériques) : plus de catalogue anglais, de chargeur ni de choix de langue.
describe('lot (g) : i18n français seul', () => {
  const walk = (dir: string): string[] =>
    readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      return entry.isDirectory() ? walk(path) : [path];
    });
  const sources = [...walk('src'), ...walk('tests'), ...walk('scripts')].filter((p) => /\.(ts|tsx|mjs)$/.test(p) && !p.endsWith('purge.test.ts') && !p.startsWith('tests/bundle/') && !p.endsWith('eslintGuards.test.ts'));
  it('aucun catalogue anglais dans src/i18n', () => {
    expect(walk('src/i18n').filter((p) => /\/en(\.[A-Za-z]+)?\.ts$/.test(p))).toEqual([]);
  });
  it('index.ts et types.ts ne connaissent que le français : ni chargeur, ni ensureLocale, ni registerCatalog, ni setLocale', () => {
    const index = read('src/i18n/index.ts');
    for (const word of ['ensureLocale', 'registerCatalog', 'setLocale', 'setCatalogFailureReporter', 'loaders', "'en'"]) expect(index, word).not.toContain(word);
    expect(read('src/i18n/types.ts')).not.toMatch(/'en'/);
  });
  it('aucune source ne choisit une langue ni n’importe un catalogue anglais', () => {
    const offenders = sources.filter((p) => {
      const text = read(p);
      return /getLocale\(\) === 'en'|setLocale\('en'\)|ensureLocale|registerCatalog|i18n\/en['.]|from '\.\/en['.]/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

// Lot (h) archivage D-40 : les documents CircleTasks vont dans docs/archive/circletasks/ (git mv), les liens suivent.
describe('lot (h) : archivage CircleTasks (D-40)', () => {
  const moved = ['stories', 'maquettes-refonte', 'backlog.md', 'dettes.md', 'audit-1.0.md', 'audits', 'essais-iphone.md', 'essais-iphone-a9.md', 'reprise-codex.md', 'reprise-historique-2026-10.md'];
  for (const name of moved) {
    it(`docs/${name} est archivé`, () => {
      expect(present(`docs/${name}`)).toBe(false);
      expect(present(`docs/archive/circletasks/${name}`)).toBe(true);
    });
  }
  it('aucun document ou source actif ne pointe vers l’ancien emplacement', () => {
    const stale = /docs\/(stories|maquettes-refonte|audits|audit-1\.0\.md|backlog\.md|dettes\.md|essais-iphone(-a9)?\.md|reprise-codex\.md|reprise-historique-2026-10\.md)/;
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter((p) => p && !p.startsWith('docs/archive/') && !p.startsWith('docs/prd/') && !p.endsWith('purge.test.ts') && !/\.(png|ico|icns|jpg|woff2?|wasm|traineddata|gz|zip|svg|lock)$/i.test(p));
    const offenders = files.filter((p) => present(p) && stale.test(read(p).replace(/docs\/archive\/circletasks\/\S*/g, '')));
    expect(offenders).toEqual([]);
  });
});
