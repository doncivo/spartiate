import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// I-06 (ADR 0007 avenant I-06 point 1) : version de tauri.conf.json, constante de build lue par src/platform/appVersion.ts (repli quand
// `getVersion()` de Tauri ne répond pas : navigateur de développement, e2e).
const APP_VERSION: string = (JSON.parse(readFileSync(resolve(import.meta.dirname, 'src-tauri', 'tauri.conf.json'), 'utf8')) as { version: string }).version;
// Port partagé avec src-tauri/tauri.conf.json (devUrl, 1420). Seul playwright.config.ts le déplace, par CT_DEV_PORT dans l'environnement
// du serveur qu'il lance (webServer.env) : `npm run dev` et `tauri dev` restent sur 1420, même si CT_E2E_PORT_BASE est posée.
export const DEV_PORT = Number(process.env['CT_DEV_PORT'] ?? 1420);

// Build des mesures de performance (@perf, projet Playwright `perf`) : bundle de PRODUCTION (React en mode production, code minifié) auquel on
// rend les accroches de test de développement (`import.meta.env.DEV` : faux des plateformes, `__ctTest`…). Posé SEULEMENT par la commande de
// build de playwright.config.ts ; jamais dans `npm run build`, `tauri build` ni les workflows de livraison (tests/bundle/startBundle.test.ts).
const E2E_HOOKS = process.env['VITE_CT_E2E_HOOKS'] === '1';

// ERGO-02b (D-287) : blocs JavaScript du départ, graphe statique de l'entrée `main` (index.html), relevés au début de
// generateBundle, avant que vite:build-import-analysis réécrive les préchargements des imports dynamiques (__vite__mapDeps).
const startFiles = new Set<string>();
function startFilesPlugin(): Plugin {
  return {
    name: 'spartiate:start-files',
    apply: 'build',
    generateBundle: {
      order: 'pre',
      handler(_options, bundle) {
        startFiles.clear();
        const entry = Object.values(bundle).find((item) => item.type === 'chunk' && item.isEntry && item.name === 'main');
        const queue = entry ? [entry.fileName] : [];
        while (queue.length > 0) {
          const file = queue.shift() as string;
          if (startFiles.has(file)) continue;
          startFiles.add(file);
          const item = bundle[file];
          if (item?.type === 'chunk') queue.push(...item.imports);
        }
      },
    },
  };
}

export default defineConfig({
  define: { __CT_APP_VERSION__: JSON.stringify(APP_VERSION), ...(E2E_HOOKS ? { 'import.meta.env.DEV': 'true', 'import.meta.env.PROD': 'false' } : {}) },
  plugins: [react(), startFilesPlugin()],
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/.claude/**', '**/coverage*/**', '**/test-results/**', '**/playwright-report/**', '**/dist/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  // Le driver de développement charge son .wasm via import.meta.url : pas de pré-bundling.
  // Le balayage des dépendances ne part que des deux pages de l'app : par défaut Vite parcourt TOUS les .html du dépôt (rapports de
  // couverture, worktrees d'agents : plus de 7 000 fichiers, 12 s au lieu de 2 s) et la première requête attend la fin du balayage.
  optimizeDeps: { entries: ['index.html', 'pairing.html'], exclude: ['@sqlite.org/sqlite-wasm'] },
  build: {
    // WebView2 (Chromium) sur Windows, WKWebView (Safari) sur iOS 17+.
    target: ['es2022', 'chrome120', 'safari17'],
    // ERGO-02b : WebView2 (Chromium 120) et WKWebView (Safari 17+) gèrent <link rel="modulepreload"> : pas de polyfill. Un bloc du départ
    // qui importe à la demande ne précharge plus les blocs du départ, déjà chargés par index.html (préchargement sans effet, ~20 octets
    // chacun dans __vite__mapDeps). Les CSS et les blocs hors du départ restent préchargés ; les blocs à la demande et les liens de
    // index.html gardent la liste complète. pairing.html : un bloc partagé avec main qui importe à la demande (ex. tauriSync vers
    // @tauri-apps/api/core) y perd ce préchargement : le bloc est chargé au moment de l'import, sans erreur ; effet négligeable.
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_file, deps, { hostId, hostType }) => (hostType === 'js' && startFiles.has(hostId) ? deps.filter((dep) => !startFiles.has(dep)) : deps),
    },
    // Deux pages : l'app et la fenêtre de la clé de synchronisation (Y-06,
    // pairing.html : bundle minimal contrôlé par tests/bundle/pairingBundle.test.ts, ADR 0011 section 2.1).
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), pairing: resolve(import.meta.dirname, 'pairing.html') },
    },
    // Cartes de source seulement en debug : l'installeur reste léger (PRD 8 : < 15 Mo).
    sourcemap: !!process.env['TAURI_ENV_DEBUG'] || !process.env['TAURI_ENV_PLATFORM'],
  },
});
