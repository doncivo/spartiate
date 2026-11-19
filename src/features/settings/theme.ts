import type { ThemeChoice } from '../../domain/model';

/** Miroir local synchrone du réglage `ui.theme`, lu par `public/theme-init.js` avant le premier rendu (P-02 D3). */
export const THEME_STORAGE_KEY = 'ct.theme';

/** Thème réellement affiché : « système » suit `prefers-color-scheme`. */
export type ResolvedTheme = 'light' | 'dark';

export function systemTheme(media: Pick<MediaQueryList, 'matches'> | null = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null): ResolvedTheme {
  return media?.matches ? 'dark' : 'light';
}

export function resolveTheme(choice: ThemeChoice, system: ResolvedTheme = systemTheme()): ResolvedTheme {
  return choice === 'system' ? system : choice;
}

/**
 * Applique le choix sur la racine du document : `data-theme="light|dark"` pour un choix explicite, aucun attribut pour « Système »
 * (les jetons suivent alors `prefers-color-scheme`, y compris quand Windows ou iOS change pendant que l'app tourne). Mémorise le
 * choix dans le stockage local pour le script de premier affichage. Synchrone : changement immédiat, sans rechargement.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Stockage indisponible : le thème s'applique quand même, le prochain démarrage retombe sur le thème système.
  }
}

/** Port de la barre de titre (Windows) ; absent hors fenêtre Tauri. */
// FIX-0272 (ADR 0001) : la barre de titre Tauri passe par la façade src/platform/windowTheme.ts ; réexportée pour les appelants d'avant.
import type { WindowThemePort } from '../../platform/windowTheme';
export { openWindowThemePort, type WindowThemePort } from '../../platform/windowTheme';

/** Applique le thème à la barre de titre ; sans effet ni erreur si la fenêtre ne l'autorise pas. */
export async function applyWindowTheme(choice: ThemeChoice, port: WindowThemePort | null): Promise<void> {
  if (!port) return;
  try {
    await port.setTheme(choice === 'system' ? null : choice);
  } catch {
    // Permission de fenêtre absente ou plateforme sans barre de titre : aucun effet.
  }
}

/** Lit un choix stocké, valeur inconnue = « Sombre » (défaut de la charte, SPA-009). */
export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}

let windowPort: WindowThemePort | null = null;

/** Enregistre le port de la barre de titre (ouvert une fois au démarrage). */
export function setWindowThemePort(port: WindowThemePort | null): void {
  windowPort = port;
}

/** Thème de l'interface (immédiat) et de la barre de titre (quand la plateforme le permet). « Système » : les deux suivent le système. */
export function applyThemeEverywhere(choice: ThemeChoice): void {
  applyTheme(choice);
  void applyWindowTheme(choice, windowPort);
}
