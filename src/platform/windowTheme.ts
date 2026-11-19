import { detectRuntime } from './runtime';

/** FIX-0272 (ADR 0001) : thème de la barre de titre de la fenêtre Tauri ; hors Tauri, aucun port. */
export interface WindowThemePort {
  setTheme(theme: 'light' | 'dark' | null): Promise<void>;
}

/** Barre de titre Tauri : suit le thème quand la plateforme le permet ; toute erreur est ignorée (P-02 critère 6). */
export async function openWindowThemePort(): Promise<WindowThemePort | null> {
  if (detectRuntime() !== 'tauri') return null;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    return { setTheme: (theme) => window.setTheme(theme) };
  } catch {
    return null;
  }
}
