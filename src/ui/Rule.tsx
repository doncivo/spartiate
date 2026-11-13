/** Filet fin entre deux blocs (ERGO-01b : moins de cartes) ; décoratif, masqué aux lecteurs d'écran. Classe globale `.ct-rule` (figures.css). */
export function Rule({ className }: { readonly className?: string }) {
  return <hr aria-hidden="true" className={['ct-rule', className].filter(Boolean).join(' ')} />;
}
