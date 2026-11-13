import './MissingValue.css';

/**
 * ERGO-02 (Degrades-apres.dc.html) : donnée manquante = un tiret « — » (décoratif) et sa raison en plus petit, jamais un faux zéro.
 * Les lecteurs d'écran lisent la raison seule. Hors du barrel `src/ui` : importé directement par les blocs à la demande qui l'emploient
 * (aucun module de plus dans le bundle de départ).
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
