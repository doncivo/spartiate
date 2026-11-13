/**
 * ERGO-01b (décision d'Ali du 13/11) : icônes Lucide homogènes. Trois tailles nommées et un seul trait pour toute l'app ; les écrans choisissent
 * une taille par son nom (`<Icon icon={Check} size="sm" />`), jamais en pixels. Les icônes des onglets (TabIcon, au départ) reprennent la
 * taille `lg` et le même trait (test ErgoShared).
 */
export const ICON_SIZE = { sm: 16, md: 20, lg: 24 } as const;

export type IconSize = keyof typeof ICON_SIZE;

export const ICON_STROKE = 1.8;
