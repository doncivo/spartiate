import { useSyncExternalStore } from 'react';

/**
 * Mise en page : 'pc' à partir de 1024 px de large, 'mobile' en dessous. BL-119 (décision d'Ali du 21/11, D-450, D-459) : sur un PC
 * Windows, la disposition reste 'pc' à toute largeur (zoom de 150 % : 1 280 px physiques = 853 px CSS), adaptée à la largeur effective ;
 * jamais la disposition iPhone. L'hôte le déclare au démarrage (`setDesktopLayout`), la couche ui ne détecte pas le système.
 */
export type Layout = 'pc' | 'mobile';

export const PC_MIN_WIDTH_PX = 1024;
export const PC_MEDIA_QUERY = `(min-width: ${PC_MIN_WIDTH_PX}px)`;

/**
 * C-135 (D-480, D-593), § 18.5 b : sur PC, aucune largeur ne change la disposition ; la barre latérale seule se replie en icônes quand la place
 * manque (1 099 px CSS et moins : 256 px de barre contre 64 px : 844 px restent au contenu et au panneau de détail).
 */
export const RAIL_FOLD_MAX_WIDTH_PX = 1099;
export const RAIL_FOLD_MEDIA_QUERY = `(max-width: ${RAIL_FOLD_MAX_WIDTH_PX}px)`;

let desktop = false;
const listeners = new Set<() => void>();

/** Disposition pour une largeur CSS : un PC Windows reste en 'pc' sous la rupture. */
export function layoutFor(widthPx: number, isDesktop: boolean): Layout {
  return isDesktop || widthPx >= PC_MIN_WIDTH_PX ? 'pc' : 'mobile';
}

/** Déclare l'appareil comme PC Windows (bootstrap) ; prévient les abonnés si la disposition change. */
export function setDesktopLayout(value: boolean): void {
  if (desktop === value) return;
  desktop = value;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (typeof window.matchMedia !== 'function') return () => listeners.delete(onChange);
  const mql = window.matchMedia(PC_MEDIA_QUERY);
  mql.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    mql.removeEventListener('change', onChange);
  };
}

/** Disposition courante (relevé synchrone). */
export function currentLayout(): Layout {
  if (desktop) return 'pc';
  if (typeof window.matchMedia !== 'function') return layoutFor(window.innerWidth, false);
  return window.matchMedia(PC_MEDIA_QUERY).matches ? 'pc' : 'mobile';
}

function subscribeFold(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const mql = window.matchMedia(RAIL_FOLD_MEDIA_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function railMustFold(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(RAIL_FOLD_MEDIA_QUERY).matches;
}

/** Vrai quand la barre latérale PC manque de place et doit se replier en icônes (recalculé au redimensionnement). */
export function useRailMustFold(): boolean {
  return useSyncExternalStore(subscribeFold, railMustFold, () => false);
}

/** Mise en page courante, recalculée au redimensionnement (rotation iPhone, fenêtre PC). */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, currentLayout, () => 'pc');
}
