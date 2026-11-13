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

/**
 * ERGO-02 (Degrades-apres.dc.html) : donnée manquante = un tiret « — » (décoratif) et sa raison en plus petit, jamais un faux zéro.
 * Les lecteurs d'écran lisent la raison seule. Défini ici, avec le chiffre héros, pour ne pas créer un bloc de plus (le nom de chaque bloc compte dans le départ) ;
 * importé par `src/ui/MissingValue.tsx`. Styles `.ct-missing` dans src/ui/theme/figures.css.
 *
 * @example
 * <MissingValue reason="pas de nuit importée" />
 */
export function MissingValue({ reason }: { readonly reason: string }) {
  return (
    <span className="ct-missing">
      <span className="ct-missing__dash" aria-hidden="true">
        —
      </span>{' '}
      <span className="ct-missing__reason">{reason}</span>
    </span>
  );
}
