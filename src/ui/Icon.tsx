import type { LucideIcon } from 'lucide-react';
import { ICON_SIZE, ICON_STROKE, type IconSize } from './iconStyle';

export interface IconProps {
  /** Composant d'icône Lucide importé nommément par l'appelant (tree-shaking, ADR 0001). */
  icon: LucideIcon;
  /** Taille nommée de l'échelle partagée (ERGO-01b : sm 16, md 20, lg 24 px) ; `lg` par défaut. Jamais une taille en pixels. */
  size?: IconSize;
  className?: string;
  /**
   * Texte accessible (clé i18n déjà résolue par l'appelant, jamais en dur ici).
   * Fourni : l'icône devient porteuse de sens (`role="img"`, `aria-label`).
   * Omis (par défaut) : l'icône est décorative et masquée aux lecteurs d'écran
   * (`aria-hidden="true"`), le libellé étant porté par un élément voisin.
   */
  label?: string;
}

/**
 * Enveloppe des icônes Lucide au trait, au style des maquettes Spartiate : trait unique (`ICON_STROKE`), couleur du texte ambiant
 * (`currentColor`), taille de l'échelle partagée (ERGO-01b, icônes homogènes).
 */
export function Icon({ icon: LucideIconComponent, size = 'lg', className, label }: IconProps) {
  const px = ICON_SIZE[size];
  return (
    <LucideIconComponent
      width={px}
      height={px}
      color="currentColor"
      strokeWidth={ICON_STROKE}
      className={className}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : 'img'}
    />
  );
}
