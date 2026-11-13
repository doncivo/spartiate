import { create } from 'zustand';
import type { PlainMessageKey } from '../../i18n';
import type { ShortcutId } from './shortcuts';

/**
 * Coquille et navigation (PRD § 18.2), ADR 0004.
 *
 * Pas de routeur d'URL (fenêtre unique Tauri, pas de lien profond) : un store Zustand en mémoire décrit la section, l'écran interne
 * et les surcouches. Cinq sections fixes (SPA-001b) ; la présentation dépend de `useLayout()` (rupture 1 024 px).
 */
export const TAB_IDS = ['today', 'training', 'nutrition', 'progress', 'more'] as const;
export type TabId = (typeof TAB_IDS)[number];

export interface TabDefinition {
  readonly id: TabId;
  readonly labelKey: PlainMessageKey;
  readonly shortcut: ShortcutId;
}

/** Les cinq sections, dans l'ordre d'affichage (non réordonnables, non masquables). */
export const TABS: readonly TabDefinition[] = [
  { id: 'today', labelKey: 'nav.tabs.today', shortcut: 'app.tab.today' },
  { id: 'training', labelKey: 'nav.tabs.training', shortcut: 'app.tab.training' },
  { id: 'nutrition', labelKey: 'nav.tabs.nutrition', shortcut: 'app.tab.nutrition' },
  { id: 'progress', labelKey: 'nav.tabs.progress', shortcut: 'app.tab.progress' },
  { id: 'more', labelKey: 'nav.tabs.more', shortcut: 'app.tab.more' },
];

/** I1-01 : sections de l'Entraînement ; absent = Routines. I1-02 : `session` = séance active (ou ses options de départ). */
export type TrainingScreenId = 'routines' | 'library' | 'equipment' | 'history' | 'cycle' | 'cardio' | 'session';

/** I4-03 : sections de Nutrition ; absent = Journal. I6-05 : `supplements` = Compléments. */
export type NutritionScreenId = 'journal' | 'dashboard' | 'strategy' | 'checkin' | 'recipes' | 'supplements';

/** Écrans internes de chaque section. Ajouter un écran = ajouter un membre ici. */
export type Route =
  | { readonly tab: 'today' }
  | { readonly tab: 'training'; readonly screen?: TrainingScreenId }
  | { readonly tab: 'nutrition'; readonly screen?: NutritionScreenId; /** ERGO-01b P2 : Journal ouvert recherche active (« Ajouter un repas »). */ readonly search?: boolean }
  | { readonly tab: 'progress' }
  | { readonly tab: 'more'; readonly screen: 'home' | 'general' | 'desktop' | 'about' | 'appearance' | 'body' | 'health' | 'exportimport' | 'reset' | 'sync' | 'logs' };

export const DEFAULT_ROUTES: { readonly [K in TabId]: Extract<Route, { tab: K }> } = {
  today: { tab: 'today' },
  training: { tab: 'training' },
  nutrition: { tab: 'nutrition' },
  progress: { tab: 'progress' },
  more: { tab: 'more', screen: 'home' },
};

/** Élément affiché dans la fiche détail (A-08) : aucun type avant I1. */
export type DetailTarget = never;

/** Surcouches modales, empilées. */
export type Overlay = { readonly kind: 'shortcutsHelp' } | { readonly kind: 'onboarding' };

export interface NavigationState {
  readonly route: Route;
  /** Dernière route visitée par section : revenir sur une section restaure son écran. */
  readonly lastRoutes: { readonly [K in TabId]: Extract<Route, { tab: K }> };
  readonly detail: DetailTarget | null;
  readonly overlays: readonly Overlay[];
  /** Ctrl+1…5 : va sur la section, à son dernier écran ; ferme la fiche détail. */
  goToTab(tab: TabId): void;
  navigate(route: Route): void;
  closeDetail(): void;
  openOverlay(overlay: Overlay): void;
  closeOverlay(): void;
  /** Échap : ferme la surcouche du dessus, sinon la fiche détail ; false si rien à fermer. */
  escape(): boolean;
}

type NavigationData = Pick<NavigationState, 'route' | 'lastRoutes' | 'detail' | 'overlays'>;

export const INITIAL_NAVIGATION: NavigationData = {
  route: DEFAULT_ROUTES.today,
  lastRoutes: DEFAULT_ROUTES,
  detail: null,
  overlays: [],
};

/** État d'interface pur, sans dépendance : store de module (réinitialiser avec INITIAL_NAVIGATION en test). */
export const useNavigationStore = create<NavigationState>()((set, get) => ({
  ...INITIAL_NAVIGATION,
  goToTab: (tab) => set((s) => ({ route: s.lastRoutes[tab], detail: null })),
  navigate: (route) => set((s) => ({ route, lastRoutes: { ...s.lastRoutes, [route.tab]: route }, detail: route.tab === s.route.tab ? s.detail : null })),
  closeDetail: () => set({ detail: null }),
  openOverlay: (overlay) => set((s) => ({ overlays: [...s.overlays, overlay] })),
  closeOverlay: () => set((s) => ({ overlays: s.overlays.slice(0, -1) })),
  escape: () => {
    const { overlays, detail } = get();
    if (overlays.length > 0) {
      set({ overlays: overlays.slice(0, -1) });
      return true;
    }
    if (detail) {
      set({ detail: null });
      return true;
    }
    return false;
  },
}));
