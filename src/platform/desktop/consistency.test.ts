import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fr } from '../../i18n/fr';
import {
  CONFIRM_QUIT_COMMAND,
  LATEST_RELEASE_URL,
  QUITTING_EVENT,
  RELEASES_REPOSITORY_URL,
  SET_TRAY_LABELS_COMMAND,
} from './releases';

/**
 * Cohérence entre le TypeScript et la configuration / le Rust, qui dupliquent quelques constantes
 * (ADR 0006) : une divergence casse ce test plutôt que l'app installée.
 */
const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const rust = read('src-tauri/src/desktop.rs');
const conf = JSON.parse(read('src-tauri/tauri.conf.json')) as {
  plugins: { updater: { pubkey: string; endpoints: string[]; requireSignedVersion?: boolean } };
  bundle: { createUpdaterArtifacts?: unknown };
};
const capability = JSON.parse(read('src-tauri/capabilities/desktop.json')) as {
  permissions: Array<string | { identifier: string; allow?: Array<{ url: string }> }>;
};

describe('cohérence TypeScript / Rust / configuration', () => {
  it('la sortie propre : événement et commande de confirmation identiques des deux côtés', () => {
    expect(rust).toContain(`pub const QUITTING_EVENT: &str = "${QUITTING_EVENT}";`);
    expect(rust).toContain(`pub fn ${CONFIRM_QUIT_COMMAND}(`);
    expect(read('src-tauri/build.rs')).toContain(`"${CONFIRM_QUIT_COMMAND}"`);
    expect(capability.permissions).toContain('allow-confirm-quit');
  });

  it('la commande des textes du menu existe et est déclarée dans le manifeste et la capability', () => {
    expect(rust).toContain(`pub fn ${SET_TRAY_LABELS_COMMAND}(`);
    expect(read('src-tauri/build.rs')).toContain(`"${SET_TRAY_LABELS_COMMAND}"`);
    expect(capability.permissions).toContain(`allow-${SET_TRAY_LABELS_COMMAND.replaceAll('_', '-')}`);
  });

  it('les libellés de repli du menu Rust sont égaux au français de src/i18n', () => {
    const fallback = rust.slice(rust.indexOf('pub fn fallback_labels'), rust.indexOf('/// Erreur renvoyée'));
    const field = (name: string): string => new RegExp(`${name}: "([^"]+)"\\.to_owned\\(\\)`).exec(fallback)?.[1] ?? '';
    expect(field('open')).toBe(fr.desktop.tray.open);
    expect(field('sync')).toBe(fr.desktop.tray.sync);
    expect(field('quit')).toBe(fr.desktop.tray.quit);
  });

  it('updater rétabli ensemble (SPA-002) : endpoint exact, clé publique minisign décodable, version signée exigée', () => {
    const updater = conf.plugins.updater;
    expect(updater.endpoints).toEqual(['https://github.com/doncivo/spartiate-releases/releases/latest/download/latest.json']);
    expect(updater.requireSignedVersion).toBe(true);
    const decoded = Buffer.from(updater.pubkey, 'base64').toString('utf8').split('\n');
    expect(decoded[0]).toMatch(/^untrusted comment: minisign public key/);
    const raw = Buffer.from(decoded[1] ?? '', 'base64');
    expect(raw.length).toBe(42);
    expect(raw.subarray(0, 2).toString()).toBe('Ed');
    expect(conf.bundle.createUpdaterArtifacts ?? false).toBe(false);
    expect(rust).toContain('tauri_plugin_updater::Builder::new().build()');
    expect(capability.permissions.filter((p) => typeof p === 'string' && p.startsWith('updater:')).sort()).toEqual([
      'updater:allow-check',
      'updater:allow-download-and-install',
    ]);
    expect(read('src/platform/desktop/tauriDesktop.ts')).toContain('updaterConfigured: true');
  });

  it('le dépôt des versions est le même : lien « À propos » et périmètre de l’opener', () => {
    const opener = capability.permissions.find((p) => typeof p !== 'string' && p.identifier === 'opener:allow-open-url');
    expect(typeof opener === 'object' && opener.allow?.[0]?.url).toBe(`${RELEASES_REPOSITORY_URL}/releases/*`);
    expect(LATEST_RELEASE_URL.startsWith(`${RELEASES_REPOSITORY_URL}/releases/`)).toBe(true);
  });

  it('l’argument de démarrage réduit est le même pour le plugin autostart et la lecture du lancement', () => {
    expect(rust).toContain('pub const MINIMIZED_ARG: &str = "--minimized";');
    expect(rust).toContain('Some(vec![MINIMIZED_ARG])');
  });
});
