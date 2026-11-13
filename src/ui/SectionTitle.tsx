import type { ReactNode } from 'react';

export interface SectionTitleProps {
  /** Texte déjà résolu par l'appelant via t(), jamais en dur ici. */
  children: ReactNode;
  /** Niveau du titre dans la page (2 par défaut ; 3 ou 4 sous un titre d'écran). */
  level?: 2 | 3 | 4;
  /** Identifiant, pour `aria-labelledby` de la section. */
  id?: string;
  /** Classe de l'écran, ajoutée à la classe partagée (marges propres à l'écran). */
  className?: string;
}

/**
 * Titre de section (ERGO-01b, décision d'Ali du 13/11) : petites capitales bronze espacées, classe globale `.ct-section-title`
 * (src/ui/theme/figures.css). Les titres existants portent la même classe (posée par script, D-51) ; ce composant sert aux blocs neufs.
 *
 * @example
 * <SectionTitle id="ct-nutrition-current">{tNutrition('currentTarget')}</SectionTitle>
 */
export function SectionTitle({ children, level = 2, id, className }: SectionTitleProps) {
  const Tag = `h${String(level)}` as 'h2' | 'h3' | 'h4';
  return (
    <Tag id={id} className={['ct-section-title', className].filter(Boolean).join(' ')}>
      {children}
    </Tag>
  );
}
