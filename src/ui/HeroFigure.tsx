export interface HeroFigureProps {
  /** Chiffre déjà formaté par l'appelant (src/i18n/format.ts). */
  value: string;
  /** Unité, déjà résolue via t() ; absente : le chiffre seul. */
  unit?: string;
  className?: string;
}

/**
 * Chiffre héros (ERGO-01 et ERGO-01b) : un seul par bloc, en capitales romaines bronze (Cinzel, chiffres tabulaires), l'unité à part en texte
 * secondaire. Classes globales `.ct-hero`, `.ct-hero__num`, `.ct-hero__unit` (src/ui/theme/figures.css). Le texte de la ligne se lit d'un
 * trait (« 1 900 kcal par jour ») : une espace sépare le chiffre de l'unité.
 */
export function HeroFigure({ value, unit, className }: HeroFigureProps) {
  return (
    <p className={['ct-hero', className].filter(Boolean).join(' ')}>
      <span className="ct-hero__num">{value}</span>
      {unit === undefined ? null : (
        <>
          {' '}
          <span className="ct-hero__unit">{unit}</span>
        </>
      )}
    </p>
  );
}
